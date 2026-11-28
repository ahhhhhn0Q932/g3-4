@echo off
chcp 65001 >nul
cd /d "%~dp0"
where pythonw.exe >nul 2>nul
if %errorlevel%==0 (
  start "" /min pythonw.exe "local-backup-server.py"
  exit /b
)
where python.exe >nul 2>nul
if %errorlevel%==0 (
  start "" /min python.exe "local-backup-server.py"
  exit /b
)
where pyw.exe >nul 2>nul
if %errorlevel%==0 (
  start "" /min pyw.exe -3 "local-backup-server.py"
  exit /b
)
where py.exe >nul 2>nul
if %errorlevel%==0 (
  start "" /min py.exe -3 "local-backup-server.py"
  exit /b
)
echo 未找到 Python，请先安装 Python 3。
pause
