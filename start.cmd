@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Bitte zuerst Node.js 20 oder neuer installieren.
 pause
 exit /b 1
)
echo Durak im Browser unter http://localhost:5173 oeffnen.
node server.mjs
pause
