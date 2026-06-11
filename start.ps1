# start.ps1 — launch the whole Privoraa stack locally in two windows.
# Backend: Spring Boot API on http://localhost:8099 (your local MySQL, no Redis).
# Frontend: Vite dev server on http://localhost:5173.
#
# Prerequisites: Java 21, Node 18+, and MySQL running locally.
# Usage:  .\start.ps1

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

Write-Host "Launching Privoraa…" -ForegroundColor Cyan

# --- Backend (new PowerShell window) ---
Start-Process powershell -ArgumentList @(
    '-NoExit', '-Command',
    "cd '$root\BackendPrivoraa'; .\run-local.ps1"
)

# --- Frontend (new PowerShell window) ---
if (-not (Test-Path "$root\node_modules")) {
    Write-Host "Installing frontend dependencies…" -ForegroundColor Cyan
    Push-Location $root; npm install; Pop-Location
}
Start-Process powershell -ArgumentList @(
    '-NoExit', '-Command',
    "cd '$root'; npm run dev"
)

Write-Host ""
Write-Host "Backend → http://localhost:8099   (Swagger: http://localhost:8099/swagger-ui.html)" -ForegroundColor Green
Write-Host "Frontend → http://localhost:5173" -ForegroundColor Green
Write-Host "Two windows opened. Close them (Ctrl+C) to stop." -ForegroundColor DarkGray
