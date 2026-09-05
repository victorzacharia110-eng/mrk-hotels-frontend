@echo off
REM ============================================================
REM  MRK Printer Bridge - ONE-CLICK install (no terminal work)
REM
REM  HOW TO USE (on PC-2, Windows):
REM    1. Copy this whole printer-bridge folder somewhere, e.g. C:\mrk-printer-bridge
REM    2. RIGHT-CLICK this file -> Run as administrator
REM    3. That's it. The connector installs to start automatically
REM       with Windows and starts right away.
REM
REM  No commands to type, no Command Prompt needed.
REM ============================================================

REM Make sure we act in this file's own folder (so the user needs to type nothing).
cd /d "%~dp0"

REM Install it as an auto-start background task and start it now.
call "%~dp0setup-service.bat"
