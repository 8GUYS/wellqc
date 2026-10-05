# WellQC+ Development Server Launcher
$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

# Ensure tools are prioritized on PATH
$ToolsNode = "$env:USERPROFILE\.tools\nodejs"
$ToolsPython = "$env:USERPROFILE\.tools\python314"
$ToolsPythonScripts = "$env:USERPROFILE\.tools\python314\Scripts"

$env:PATH = "$ToolsNode;$ToolsPython;$ToolsPythonScripts;" + $env:PATH

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Starting WellQC+ Development Servers   " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Start Python Backend Engine
Write-Host "[1/2] Launching Python FastAPI Backend on http://127.0.0.1:8000..." -ForegroundColor Yellow
$BackendProcess = Start-Process -FilePath ".\.venv\Scripts\python.exe" -ArgumentList "start_engine.py" -PassThru -NoNewWindow

Start-Sleep -Seconds 2

# 2. Start Next.js Frontend
Write-Host "[2/2] Launching Next.js Frontend on http://localhost:3000..." -ForegroundColor Yellow
& "$ToolsNode\node.exe" ./node_modules/next/dist/bin/next dev --port 3000
