@echo off
REM ============================================================
REM  MRK Printer Bridge - install as an auto-start background task
REM
REM  Run ONCE (as Administrator) so the connector starts
REM  automatically every time Windows boots. After this, you
REM  never need to open a Command Prompt or run node again.
REM
REM  To remove it later, run:  uninstall-service.bat
REM ============================================================
setlocal

set TASK_NAME=MRKPrinterBridge
set SCRIPT_PATH=%~dp0src\server.js
set NODE_PATH=

echo.
echo Checking for Node.js...

REM Locate node.exe (whichever is available)
where node >nul 2>nul
if %errorlevel%==0 (
    for /f "delims=" %%i in ('where node') do set "NODE_PATH=%%i" & goto :found
)
for /f "delims=" %%i in ('where node.exe') do set "NODE_PATH=%%i" & goto :found

:found
if not defined NODE_PATH (
    echo [ERROR] Node.js was not found. Install it first from https://nodejs.org
    pause
    exit /b 1
)
echo Found Node.js at: %NODE_PATH%
echo Script: %SCRIPT_PATH%
echo.

REM Delete any previous task with the same name (ignore failure)
schtasks /delete /tn "%TASK_NAME%" /f >nul 2>nul

REM Create a scheduled task that runs the connector at startup,
REM hidden (no console window) and logged on regardless of user.
schtasks /create /tn "%TASK_NAME%" /tr "\"%NODE_PATH%\" \"%SCRIPT_PATH%\"" ^
    /sc onstart /ru SYSTEM /rl highest /f

if %errorlevel% neq 0 (
    echo [ERROR] Could not create the startup task. Try again with 'Run as administrator'.
    pause
    exit /b 1
)

echo.
echo Starting the connector now (background)...
REM Start it right away without waiting for a reboot.
schtasks /run /tn "%TASK_NAME%" >nul 2>nul

echo.
echo Done.
echo The connector is now installed and starts automatically with Windows.
echo It is currently running on port 9720.
echo You can verify here: http://localhost:9720/health
echo To stop it later, run:  uninstall-service.bat
echo.
pause
endlocal
