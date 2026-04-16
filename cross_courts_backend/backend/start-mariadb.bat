@echo off
REM Starts MariaDB if installed at default path (adjust if yours differs).
set "MYSQLD=C:\Program Files\MariaDB 12.2\bin\mysqld.exe"
set "INI=C:\Program Files\MariaDB 12.2\data\my.ini"
if not exist "%MYSQLD%" (
  echo Edit start-mariadb.bat: mysqld.exe not found at %MYSQLD%
  pause
  exit /b 1
)
echo Starting MariaDB on port 3306 (minimized window)...
start "MariaDB" /MIN "%MYSQLD%" --defaults-file="%INI%"
ping 127.0.0.1 -n 5 >nul
echo Done. Leave the MariaDB window running. For auto-start, install MariaDB as a Windows service.
