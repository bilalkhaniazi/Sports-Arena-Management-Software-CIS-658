$ErrorActionPreference = "Stop"

Write-Host "Installing Cross Courts dependencies..." -ForegroundColor Cyan

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

Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
Push-Location $backendPath
npm install
Pop-Location

Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
Push-Location $frontendPath
npm install
Pop-Location

$envExamplePath = Join-Path $backendPath ".env.example"
$envPath = Join-Path $backendPath ".env"

if ((Test-Path $envExamplePath) -and (-not (Test-Path $envPath))) {
  Copy-Item $envExamplePath $envPath
  Write-Host "Created backend .env from .env.example" -ForegroundColor Green
}

Write-Host ""
Write-Host "Install complete." -ForegroundColor Green
Write-Host "Next steps:"
Write-Host "1) Configure backend environment: cross_courts_backend\backend\.env"
Write-Host "2) Start backend: cd cross_courts_backend\backend ; npm start"
Write-Host "3) Start frontend: cd CrossCourts-main\CrossCourts-main ; npm run dev"
