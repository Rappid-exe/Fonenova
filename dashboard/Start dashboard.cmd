@echo off
rem Starts the Fone Nova dashboard on this PC only and opens it in the browser.
rem Double-click it, or put a shortcut to it in shell:startup to start at login.
cd /d "%~dp0"
curl.exe -s -o nul http://127.0.0.1:3100 && (start "" http://localhost:3100 & exit /b)
if not exist node_modules call npm.cmd install
start "" cmd /c "timeout /t 8 >nul & start http://localhost:3100"
npm.cmd run dev -- -H 127.0.0.1
