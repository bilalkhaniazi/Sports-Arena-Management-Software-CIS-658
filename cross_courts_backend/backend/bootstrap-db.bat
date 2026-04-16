@echo off
cd /d "%~dp0"
echo === Cross Courts: database bootstrap ===
echo Creates DB, imports crosscourts.sql if needed, applies migrations.
echo.
node scripts\bootstrapDb.js
if errorlevel 1 (
  echo.
  echo FAILED. Start MySQL first (XAMPP / MySQL service), then run this again.
  pause
  exit /b 1
)
echo.
echo Optional USA demo seed + Password123! accounts:
echo   node scripts\bootstrapDb.js --usa-seed
echo.
pause
