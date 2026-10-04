@echo off
setlocal
cd /d "%~dp0\.."

set "PATH=%USERPROFILE%\.tools\nodejs;%USERPROFILE%\.tools\python314;%USERPROFILE%\.tools\python314\Scripts;%PATH%"

echo =========================================
echo   Starting WellQC+ Development Servers   
echo =========================================

echo [1/2] Launching Python FastAPI Backend on http://127.0.0.1:8000...
start "WellQC Backend Engine" ".\.venv\Scripts\python.exe" start_engine.py

timeout /t 2 /nobreak >nul

echo [2/2] Launching Next.js Frontend on http://localhost:3000...
"%USERPROFILE%\.tools\nodejs\node.exe" ./node_modules/next/dist/bin/next dev --port 3000
