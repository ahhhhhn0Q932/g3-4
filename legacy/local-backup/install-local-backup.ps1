# 班级管理系统 - 本机自动保存宏安装脚本
# 用法（二选一）：
#   右键 -> 使用 PowerShell 运行
#   powershell -ExecutionPolicy Bypass -File .\install-local-backup.ps1
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$server = Join-Path $here "local-backup-server.py"
$taskName = "ClassManagerLocalBackup"
$healthUrl = "http://127.0.0.1:8765/health"

if (-not (Test-Path $server)) {
  throw "找不到 local-backup-server.py：$server"
}

function Find-Python {
  foreach ($name in @("pythonw.exe", "python.exe")) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if ($cmd) { return @{ Exe = $cmd.Source; Args = "" } }
  }
  foreach ($name in @("pyw.exe", "py.exe")) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if ($cmd) { return @{ Exe = $cmd.Source; Args = "-3" } }
  }
  return $null
}

$python = Find-Python
if (-not $python) {
  throw "未找到 Python 3。请先安装 Python，并勾选 Add Python to PATH。"
}

# 结束旧任务，避免重复启动
# 首次安装时任务不存在，schtasks 会输出“系统找不到指定的文件”并返回非零码；
# 在 $ErrorActionPreference="Stop" 下这会中断脚本，因此临时改为 SilentlyContinue 并加 try/catch。
$prevEap = $ErrorActionPreference
$ErrorActionPreference = "SilentlyContinue"
try {
  schtasks /End /TN $taskName 2>$null | Out-Null
  schtasks /Delete /TN $taskName /F 2>$null | Out-Null
} catch { }
$ErrorActionPreference = $prevEap

$action = '"' + $python.Exe + '"'
if ($python.Args) { $action += ' ' + $python.Args }
$action += ' "' + $server + '"'
schtasks /Create /TN $taskName /SC ONLOGON /TR $action /F /RL LIMITED | Out-Null
schtasks /Run /TN $taskName | Out-Null

$ok = $false
for ($i = 0; $i -lt 12; $i++) {
  Start-Sleep -Milliseconds 500
  try {
    $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2
    if ($health.ok) { $ok = $true; break }
  } catch { }
}

if ($ok) {
  Write-Host "安装完成，自动保存宏已启动。" -ForegroundColor Green
  Write-Host "版本：$($health.version)"
  Write-Host "备份目录：$($health.dir)"
  Write-Host "以后登录 Windows 会自动启动。"
  Write-Host "手动启动：双击 START-LOCAL-BACKUP.bat"
} else {
  Write-Warning "任务已创建，但 6 秒内未连上 127.0.0.1:8765。"
  Write-Host "请双击 START-LOCAL-BACKUP.bat 查看错误；常见原因是 Python 未安装或 8765 端口被占用。"
}
