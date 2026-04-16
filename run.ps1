$ErrorActionPreference = "Stop"

Write-Host "Starting Cross Courts apps..." -ForegroundColor Cyan

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendPath = Join-Path $root "CrossCourts-main\CrossCourts-main"
$backendPath = Join-Path $root "cross_courts_backend\backend"

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "npm is not installed. Please install Node.js LTS first: https://nodejs.org/"
}

if (-not (Test-Path $frontendPath)) {
  throw "Frontend directory not found: $frontendPath"
}

if (-not (Test-Path $backendPath)) {
  throw "Backend directory not found: $backendPath"
}

$backendNodeModules = Join-Path $backendPath "node_modules"
$frontendNodeModules = Join-Path $frontendPath "node_modules"

if ((-not (Test-Path $backendNodeModules)) -or (-not (Test-Path $frontendNodeModules))) {
  Write-Host "Dependencies appear missing. Running install first..." -ForegroundColor Yellow
  $installScript = Join-Path $root "install.ps1"
  if (-not (Test-Path $installScript)) {
    throw "install.ps1 not found at project root."
  }
  & powershell -ExecutionPolicy Bypass -File $installScript
}

$backendEnv = Join-Path $backendPath ".env"
if (-not (Test-Path $backendEnv)) {
  Write-Host "Warning: backend .env not found at $backendEnv" -ForegroundColor Yellow
  Write-Host "Create it from .env.example before using backend integrations." -ForegroundColor Yellow
}

$backendCommand = "Set-Location '$backendPath'; npm start"
$frontendCommand = "Set-Location '$frontendPath'; npm run dev"

Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCommand | Out-Null
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCommand | Out-Null

Write-Host "Launched backend and frontend in separate terminals." -ForegroundColor Green
Write-Host "Backend default: http://localhost:5000"
Write-Host "Frontend default: http://localhost:5173"
