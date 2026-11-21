# 班级管理系统 - 本机自动保存宏卸载脚本
# 用法：右键 -> 使用 PowerShell 运行
$ErrorActionPreference = "Stop"
$taskName = "ClassManagerLocalBackup"

schtasks /End /TN $taskName 2>$null | Out-Null
schtasks /Delete /TN $taskName /F 2>$null | Out-Null

try {
  $conn = Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($conn) {
    $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
    if ($proc -and $proc.ProcessName -match '^(python|pythonw|py|pyw)$') {
      Stop-Process -Id $proc.Id -Force
      Write-Host "已停止自动保存宏进程。"
    } else {
      Write-Warning "8765 端口被其他程序占用，未自动结束：$($proc.ProcessName)"
    }
  }
} catch { }

Write-Host "已删除开机启动任务 ClassManagerLocalBackup。" -ForegroundColor Green
Write-Host "备份文件不会被删除，仍在：$env:USERPROFILE\ClassManagerBackup"
