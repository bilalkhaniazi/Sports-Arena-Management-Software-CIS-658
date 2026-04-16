@echo off
cd /d "%~dp0"
echo === Cross Courts API (port 5000) ===
echo If login fails with database errors, run start-mariadb.bat first (MariaDB on this PC).
echo Keep this window open. Stop with Ctrl+C.
echo.
node server.js
pause
