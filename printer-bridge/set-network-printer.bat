@echo off
REM ============================================================
REM  MRK Printer Bridge - point it at a NETWORK (Ethernet) printer
REM
REM  Use this when the receipt printer is connected with a network
REM  cable instead of USB. You run it once on the printer's
REM  computer; it saves the printer's IP into config.local.json
REM  and restarts the helper.
REM
REM  Before running this, give the printer a fixed IP address
REM  (see the setup guide). Typical printers listen on port 9100.
REM
REM  No administrator rights, no commands to remember.
REM ============================================================
setlocal
cd /d "%~dp0"

echo.
echo MRK Printer Bridge - network printer setup
echo ------------------------------------------
echo.

set "PRINTER_IP="
set /p "PRINTER_IP=Enter the printer's IP address (e.g. 192.168.1.200): "
if "%PRINTER_IP%"=="" (
    echo No IP address entered - nothing was changed.
    echo.
    pause
    exit /b 1
)

set "PRINTER_TCP="
set /p "PRINTER_TCP=Enter the printer's TCP port [press Enter for 9100]: "
if "%PRINTER_TCP%"=="" set "PRINTER_TCP=9100"

>"%~dp0config.local.json" echo {"printerHost":"%PRINTER_IP%","printerPort":%PRINTER_TCP%}

echo.
echo Saved: the helper will print to %PRINTER_IP%:%PRINTER_TCP%
echo.

REM Restart the auto-start task so the new setting takes effect now.
schtasks /end /tn "MRKPrinterBridge" >nul 2>nul
schtasks /run /tn "MRKPrinterBridge" >nul 2>nul

echo Done. The helper is restarting with the new printer address.
echo Check it here: http://localhost:9720/health
echo (It should say "transport: network".)
echo.
pause
endlocal
