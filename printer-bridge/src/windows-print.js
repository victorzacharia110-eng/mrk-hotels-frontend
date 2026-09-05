'use strict';

const { execFile } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');
const config = require('./config');

/**
 * Spool raw ESC/POS bytes to the Windows printer.
 *
 * The raw bytes must reach the driver un-touched (no text re-interpretation)
 * or the thermal receipt printer will print garbage. We achieve this with the
 * classic Win32 RawPrinterHelper (CreateDC -> StartDocPrinter -> WritePrinter),
 * invoked through PowerShell -NoProfile so nothing in the user's profile can
 * interfere.
 *
 * @param {Buffer} bytes  Raw ESC/POS bytes to print.
 * @param {string} [printerName] Windows printer name; defaults to system default.
 * @returns {Promise<string>} The printer name actually used.
 */
function printRawToWindowsDefault(bytes, printerName) {
  const tmpFile = fs.mkdtempSync(path.join(os.tmpdir(), 'mrk-print-'));
  const dataPath = path.join(tmpFile, 'data.bin');
  const scriptPath = path.join(tmpFile, 'print.ps1');

  // Build the PowerShell script that spools the raw bytes.
  const script = [
    '$ErrorActionPreference = "Stop"',
    'Add-Type -AssemblyName System.Drawing',
    '',
    'Add-Type @"',
    'using System;',
    'using System.Runtime.InteropServices;',
    'public class RawPrinterHelper',
    '{',
    '    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]',
    '    public class DOCINFOA',
    '    {',
    '        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;',
    '        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;',
    '        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;',
    '    }',
    '    [DllImport("winspool.drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]',
    '    public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);',
    '',
    '    [DllImport("winspool.drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]',
    '    public static extern bool ClosePrinter(IntPtr hPrinter);',
    '',
    '    [DllImport("winspool.drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]',
    '    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);',
    '',
    '    [DllImport("winspool.drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]',
    '    public static extern bool EndDocPrinter(IntPtr hPrinter);',
    '',
    '    [DllImport("winspool.drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]',
    '    public static extern bool StartPagePrinter(IntPtr hPrinter);',
    '',
    '    [DllImport("winspool.drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]',
    '    public static extern bool EndPagePrinter(IntPtr hPrinter);',
    '',
    '    [DllImport("winspool.drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]',
    '    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);',
    '}',
    '"@',
    '',
    '$DocName = "MRK-POS" + [DateTime]::Now.ToString("yyyyMMddHHmmss")',
    '$bytes = [System.IO.File]::ReadAllBytes("' + dataPath + '")',
    'if ($bytes.Length -eq 0) { throw "Empty print data" }',
    '',
    '$hPrinter = [IntPtr]::Zero',
    '$printer = "' + (printerName || '').replace(/"/g, '`"') + '"',
    'if ([string]::IsNullOrWhiteSpace($printer)) { $printer = (Get-CimInstance -ClassName Win32_Printer -Filter "Default=True").Name }',
    'if ([string]::IsNullOrWhiteSpace($printer)) { throw "No default printer found" }',
    '',
    '$ok = [RawPrinterHelper]::OpenPrinter($printer, [ref]$hPrinter, [IntPtr]::Zero)',
    'if (-not $ok) { throw "OpenPrinter failed: " + $printer }',
    '',
    'try',
    '{',
    '    $di = New-Object RawPrinterHelper+DOCINFOA',
    '    $di.pDocName = $DocName',
    '    $di.pDataType = "RAW"',
    '    if (-not [RawPrinterHelper]::StartDocPrinter($hPrinter, 1, $di)) { throw "StartDocPrinter failed" }',
    '    if (-not [RawPrinterHelper]::StartPagePrinter($hPrinter)) { throw "StartPagePrinter failed" }',
    '',
    '    $buf = [System.Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)',
    '    [System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $buf, $bytes.Length)',
    '    $written = 0',
    '    if (-not [RawPrinterHelper]::WritePrinter($hPrinter, $buf, $bytes.Length, [ref]$written)) { throw "WritePrinter failed" }',
    '    [System.Runtime.InteropServices.Marshal]::FreeHGlobal($buf)',
    '    [RawPrinterHelper]::EndPagePrinter($hPrinter)',
    '    [RawPrinterHelper]::EndDocPrinter($hPrinter)',
    '    Write-Output "OK:$printer:$($bytes.Length)bytes:$written"',
    '}',
    'finally',
    '{',
    '    [RawPrinterHelper]::ClosePrinter($hPrinter)',
    '}',
  ].join('\n');

  fs.writeFileSync(scriptPath, script, 'utf8');
  fs.writeFileSync(dataPath, bytes);

  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
      { windowsHide: true, timeout: 30000, maxBuffer: 8 * 1024 * 1024 },
      (err, stdout, stderr) => {
        try {
          fs.rmSync(tmpFile, { recursive: true, force: true });
        } catch {
          /* best effort cleanup */
        }
        if (err) {
          const detail = (stderr || '') + (stdout || '');
          return reject(new Error('PowerShell print failed: ' + detail.trim()));
        }
        const line = (stdout || '').split('\n').find((l) => l.startsWith('OK:'));
        if (!line) return reject(new Error('Print job did not report success'));
        const [, usedPrinter] = line.split(':');
        resolve(usedPrinter);
      }
    );
  });
}

/**
 * Print a raw byte buffer on Windows. Thin wrapper that also handles the
 * non-Windows case with a clear, useful error.
 */
async function rawPrint(bytes) {
  if (process.platform !== 'win32') {
    throw new Error(
      'This agent must run on the Windows machine that owns the printer ' +
        '(PC-2). Current platform: ' + process.platform
    );
  }
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
    throw new Error('No print data supplied');
  }
  return printRawToWindowsDefault(bytes, config.printerName);
}

module.exports = { rawPrint, printRawToWindowsDefault };
