@echo off
REM Double-click this file to start the local development server.
REM It installs whatever is missing on first run and opens the browser for you.

cd /d "%~dp0"

call npm run dev

echo.
pause
