'use strict';

/**
 * One-double-click installer for the single-file .exe (Windows).
 *
 * Everything here is designed to need NO administrator rights:
 *   - copy the exe  -> %LOCALAPPDATA%\MRKPrinterBridge (per-user, no admin)
 *   - auto-start    -> HKCU\...\Run (per-user registry, no admin)
 *   - open browser  -> no admin
 *
 * The ONE thing that can need admin is the direct-cable network fix (giving the
 * wired port a /32 + a host route), because that changes adapter config. That is
 * only triggered on demand from the setup page's "Fix direct-cable connection"
 * button, which elevates via a single UAC prompt.
 *
 * Zero dependencies so it bundles into the .exe unchanged.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, exec, execFileSync } = require('child_process');

const APP_DIR_NAME = 'MRKPrinterBridge';
const EXE_NAME = 'mrk-printer-bridge.exe';
const RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const RUN_NAME = 'MRKPrinterBridge';

/** Where the installed copy lives (per-user, no admin needed). */
function installDir() {
  return path.join(os.homedir(), 'AppData', 'Local', APP_DIR_NAME);
}

function installedExePath() {
  return path.join(installDir(), EXE_NAME);
}

/**
 * First-run install: copy the exe into %LOCALAPPDATA% and register per-user
 * auto-start. Safe to call on every launch — it is a no-op once installed.
 *
 * @returns {{needsRestart: boolean, target?: string, error?: string}}
 */
function ensureInstalled() {
  if (process.platform !== 'win32') return { needsRestart: false };
  if (process.env.MRK_SKIP_INSTALL === '1') return { needsRestart: false };

  const target = installedExePath();
  const running = path.resolve(process.execPath);

  // Already running the installed copy (normal case after install).
  if (running === target) return { needsRestart: false };

  // Installed copy already exists: don't reinstall, just don't restart either —
  // the user double-clicked the Downloads copy, but the installed one is current.
  if (fs.existsSync(target)) return { needsRestart: false };

  // First run: copy + set auto-start, then relaunch from the installed path.
  try {
    fs.mkdirSync(installDir(), { recursive: true });
    fs.copyFileSync(process.execPath, target);
    setAutoStart(target);
    return { needsRestart: true, target };
  } catch (e) {
    // Copy can fail if the source is on a locked/odd location. Not fatal:
    // fall through and just run from wherever the user launched it (no auto-start).
    return { needsRestart: false, error: e.message };
  }
}

/** Registers the installed copy to start with Windows (per-user, no admin). */
function setAutoStart(target) {
  try {
    // --serve starts the bridge silently (no wizard) at login.
    execFileSync(
      'reg',
      ['add', RUN_KEY, '/v', RUN_NAME, '/t', 'REG_SZ', '/d', `"${target}" --serve`, '/f'],
      { stdio: 'ignore', windowsHide: true }
    );
  } catch {
    // Auto-start is a convenience, not required for the app to work.
  }
}

/** True when per-user auto-start is registered. */
function isAutoStartRegistered() {
  try {
    execFileSync('reg', ['query', RUN_KEY, '/v', RUN_NAME], { stdio: 'ignore', windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

/** Starts a detached copy of the exe (used to hand off to the installed one). */
function relaunch(exePath, args = []) {
  const child = spawn(exePath, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true, // the app is windowless (GUI subsystem); no console flash
  });
  child.unref();
}

/**
 * Opens the native Windows setup wizard (PowerShell WinForms). The wizard script
 * is embedded in the bundle (see build-sea.sh --loader:.ps1=text), written to a
 * temp file and launched with a hidden console so only the dialog window shows.
 *
 * @returns {boolean} true if the wizard process was launched.
 */
function openWizard() {
  if (process.platform !== 'win32') return false;
  let script;
  try {
    // esbuild inlines the file contents as a string in the packaged exe.
    script = require('./wizard.ps1');
  } catch {
    return false;
  }
  if (typeof script !== 'string' || !script.trim()) return false;

  const scriptPath = path.join(os.tmpdir(), 'mrk-printer-wizard.ps1');
  try {
    fs.writeFileSync(scriptPath, script, 'utf8');
  } catch {
    return false;
  }

  try {
    const child = spawn(
      'powershell.exe',
      ['-STA', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', scriptPath],
      { detached: true, stdio: 'ignore', windowsHide: true }
    );
    child.unref();
    return true;
  } catch {
    return false;
  }
}

/** Opens a URL in the default browser (cross-platform). */
function openBrowser(url) {
  const cmd =
    process.platform === 'win32'
      ? `start "" "${url}"`
      : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

/**
 * Runs the direct-cable network fix in an ELEVATED PowerShell (single UAC
 * prompt). Gives the wired port a /32 and adds a host route for the printer's
 * IP only, so the PC's Wi-Fi keeps working. See setup-printer-link.ps1.
 *
 * @param {string} printerIP  The printer's IP (e.g. 192.168.1.100).
 * @param {string} [localIP]  /32 address to give the wired port.
 * @returns {{ok: boolean, message: string}}
 */
function runElevatedNetworkFix(printerIP, localIP = '192.168.1.10') {
  if (process.platform !== 'win32') return { ok: false, message: 'Windows only.' };
  if (!printerIP) return { ok: false, message: 'No printer address set.' };

  const resultPath = path.join(os.tmpdir(), 'mrk-printer-link-result.txt');
  try {
    if (fs.existsSync(resultPath)) fs.unlinkSync(resultPath);
  } catch { /* ignore */ }

  const ps = [
    `$PrinterIP = '${String(printerIP).replace(/'/g, "''")}'`,
    `$LocalIP   = '${String(localIP).replace(/'/g, "''")}'`,
    `$ResultPath = '${resultPath.replace(/'/g, "''")}'`,
    `function Log($m){ Add-Content -Path $ResultPath -Value $m }`,
    `try {`,
    `  $nic = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' -and $_.InterfaceDescription -notmatch 'Wi-?Fi|Wireless|802\\.11' } | Select-Object -First 1`,
    `  if (-not $nic) { Log 'ERROR: No wired Ethernet adapter is Up. Plug the printer cable into this PC, wait ~10 seconds, and try again.'; exit 1 }`,
    `  Get-NetIPAddress -InterfaceIndex $nic.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue | ForEach-Object { Remove-NetIPAddress -IPAddress $_.IPAddress -InterfaceIndex $nic.ifIndex -Confirm:$false -ErrorAction SilentlyContinue }`,
    `  Get-NetRoute -InterfaceIndex $nic.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue | ForEach-Object { Remove-NetRoute -DestinationPrefix $_.DestinationPrefix -InterfaceIndex $nic.ifIndex -Confirm:$false -ErrorAction SilentlyContinue }`,
    `  New-NetIPAddress -InterfaceIndex $nic.ifIndex -IPAddress $LocalIP -PrefixLength 32 -ErrorAction Stop | Out-Null`,
    `  New-NetRoute -InterfaceIndex $nic.ifIndex -DestinationPrefix "$PrinterIP/32" -NextHop $LocalIP -ErrorAction Stop | Out-Null`,
    `  Log "OK: Routed $PrinterIP through $($nic.Name) ($LocalIP/32)."` ,
    `  exit 0`,
    `} catch {`,
    `  Log ("ERROR: " + $_.Exception.Message)`,
    `  exit 1`,
    `}`,
  ].join('\n');

  const scriptPath = path.join(os.tmpdir(), 'mrk-printer-link.ps1');
  fs.writeFileSync(scriptPath, ps, 'utf8');

  try {
    // Outer (non-elevated) PowerShell just launches the elevated one and waits.
    const quoted = scriptPath.replace(/'/g, "''");
    execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        `Start-Process -FilePath powershell.exe -Verb RunAs -Wait -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','${quoted}'`,
      ],
      { stdio: 'ignore', windowsHide: true, timeout: 90000 }
    );
  } catch {
    // The user cancelled the UAC prompt, or PowerShell failed to launch.
    return { ok: false, message: 'The Windows permission prompt was cancelled or failed.' };
  }

  // Read the elevated script's result file.
  try {
    if (fs.existsSync(resultPath)) {
      const text = fs.readFileSync(resultPath, 'utf8').trim();
      if (text.startsWith('OK:')) return { ok: true, message: text.slice(3).trim() };
      return { ok: false, message: text };
    }
  } catch { /* fall through */ }

  return { ok: false, message: 'The network fix did not report a result. Try again.' };
}

/** True when the printer's IP is reachable on TCP 9100 (quick reachability probe). */
function canReachPrinter(ip, port = 9100, timeout = 1500) {
  return new Promise((resolve) => {
    if (!ip) return resolve(false);
    const net = require('net');
    const socket = new net.Socket();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeout);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    try {
      socket.connect(port, ip);
    } catch {
      finish(false);
    }
  });
}

module.exports = {
  ensureInstalled,
  isAutoStartRegistered,
  relaunch,
  openBrowser,
  openWizard,
  runElevatedNetworkFix,
  canReachPrinter,
  installDir,
  installedExePath,
};
