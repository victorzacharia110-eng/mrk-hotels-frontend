@echo off
REM ============================================================
REM  MRK Printer Bridge - remove the auto-start background task
REM ============================================================
setlocal

set TASK_NAME=MRKPrinterBridge

echo.
echo Removing the auto-start task (%TASK_NAME%)...

schtasks /end /tn "%TASK_NAME%" >nul 2>nul
schtasks /delete /tn "%TASK_NAME%" /f >nul 2>nul

if %errorlevel%==0 (
    echo The connector no longer starts automatically.
) else (
    echo It was either already removed or was never installed.
)

echo.
pause
endlocal
