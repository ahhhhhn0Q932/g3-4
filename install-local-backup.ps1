# 班级管理系统 - 本地自动备份安装脚本
# 用法：在 PowerShell 中右键“使用 PowerShell 运行”，或：
#   powershell -ExecutionPolicy Bypass -File .\install-local-backup.ps1
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$server = Join-Path $here "local-backup-server.py"

if (-not (Test-Path $server)) {
  throw "找不到 local-backup-server.py：$server"
}

$python = $null
foreach ($name in @("pythonw.exe", "python.exe")) {
  $cmd = Get-Command $name -ErrorAction SilentlyContinue
  if ($cmd) { $python = $cmd.Source; break }
}
if (-not $python) {
  throw "未找到 Python。请先安装 Python 3，并确保 pythonw.exe 在 PATH 中。"
}

$taskName = "ClassManagerLocalBackup"
$action = "`"$python`" `"$server`""
schtasks /Create /TN $taskName /SC ONLOGON /TR $action /F /RL LIMITED | Out-Null
schtasks /Run /TN $taskName | Out-Null
Start-Sleep -Milliseconds 800

try {
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:8765/health" -TimeoutSec 4
  Write-Host "安装完成，备份服务已启动。" -ForegroundColor Green
  Write-Host "备份目录：$($health.dir)"
  Write-Host "以后登录 Windows 会自动启动；手动启动可运行 START-LOCAL-BACKUP.bat。"
} catch {
  Write-Warning "任务已创建，但健康检查失败。请运行 START-LOCAL-BACKUP.bat 查看错误。"
}
