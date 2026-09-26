@echo off
echo Starting local web server on port 8080...
start "" "http://localhost:8080/"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
