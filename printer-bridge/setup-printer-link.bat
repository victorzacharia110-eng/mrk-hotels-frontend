@echo off
REM ============================================================
REM  MRK Printer Bridge - direct-cable printer link setup
REM
REM  Use this when the printer is plugged STRAIGHT INTO this PC's
REM  Ethernet port (a "direct cable"), instead of into the router.
REM
REM  It fixes the Windows network so the printer cable is used only
REM  for the printer, and your Wi-Fi keeps working for everything
REM  else. Run it once, as administrator.
REM
REM  No commands to type - just answer the one question.
REM ============================================================
setlocal
cd /d "%~dp0"

echo.
echo MRK Printer Bridge - direct-cable printer setup
echo ----------------------------------------------
echo.
echo Use this when the printer is plugged straight into THIS
echo computer's Ethernet port (not into the router).
echo.

set "PRINTER_IP="
set /p "PRINTER_IP=Enter the printer's IP address [press Enter for 192.168.1.100]: "
if "%PRINTER_IP%"=="" set "PRINTER_IP=192.168.1.100"

echo.
echo Running (needs an Administrator PowerShell)...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-printer-link.ps1" -PrinterIP "%PRINTER_IP%"

echo.
echo If that showed a route and no error, next run set-network-printer.bat
echo and enter the same IP: %PRINTER_IP%
echo.
pause
endlocal
