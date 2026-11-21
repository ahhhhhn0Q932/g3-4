@echo off
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
echo 未找到 Python，请先安装 Python 3。
pause
