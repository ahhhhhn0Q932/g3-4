# 本机自动保存宏使用教程

本教程对应「班级管理系统」设置 → 同步设置中的 **本机自动备份 / 自动保存宏**。  
宏的作用是：网页每次保存数据后，自动把一份 JSON 备份写到本机用户目录，避免浏览器缓存被清理或换设备后数据丢失。

> 它只在本机运行，不会把数据上传到任何第三方服务器；云端同步仍由 Supabase 负责。

## 一、它保存什么

- 保存位置：`%USERPROFILE%\ClassManagerBackup`
  - 通常是 `C:\Users\你的用户名\ClassManagerBackup`
- 文件说明：
  - `latest.json`：最近一次保存的完整数据，可直接导入系统恢复。
  - `snapshot-日期-时间.json`：历史快照，默认保留最近 30 份。
  - `latest-meta.json`：保存时间、文件大小、是否发生变化等状态信息。
- 内容与「设置 → 导出全部数据」一致，包含学生档案、作业、请假、提醒、日志、Issue、链接等。
- 数据没有变化时只更新 `latest.json`，不会重复生成快照；有新变化才新增快照并自动清理旧快照。

## 二、安装前准备

1. Windows 10/11。
2. 安装 Python 3：
   - 打开 <https://www.python.org/downloads/> 下载安装包；
   - 安装时勾选 **Add Python to PATH**；
   - 安装完成后，在 PowerShell 中运行 `python --version`，能显示版本号即可。
3. 下载自动保存宏压缩包（设置页提供蓝奏云地址与提取密码），解压到一个**固定目录**，例如：
   `D:\ClassManagerBackupTool`

解压后应至少包含：

```text
local-backup-server.py
install-local-backup.ps1
uninstall-local-backup.ps1
START-LOCAL-BACKUP.bat
LOCAL_BACKUP_GUIDE.md
```

> 不要只把 `.py` 文件单独移走；安装脚本需要和它在同一目录。

## 三、安装并启动

1. 进入解压目录。
2. 右键 `install-local-backup.ps1` → **使用 PowerShell 运行**。
3. 如果系统提示脚本执行策略，可在 PowerShell 中执行：

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\install-local-backup.ps1
   ```

4. 看到 `安装完成，自动保存宏已启动` 即成功。
5. 打开班级管理系统 → 设置 → 同步设置：
   - 显示 `程序已连接，等待保存`：宏已启动；
   - 随便修改一次数据后，显示 `已保存 HH:MM`：写入成功。

安装脚本会创建一个名为 `ClassManagerLocalBackup` 的 Windows 登录启动任务，以后开机登录会自动运行。

## 四、手动启动 / 停止

- 手动启动：双击 `START-LOCAL-BACKUP.bat`。
- 停止：在任务管理器中结束 `pythonw.exe` / `python.exe`，或运行 `uninstall-local-backup.ps1`。
- 检查是否在运行：

  ```powershell
  Invoke-RestMethod http://127.0.0.1:8765/health
  ```

  正常会返回 `ok : True`、`version` 和备份目录。

## 五、恢复数据

> 恢复前建议先导出当前数据，避免覆盖错版本。

1. 用管理员进入系统。
2. 打开 `%USERPROFILE%\ClassManagerBackup`。
3. 在「设置 → 同步设置 → 导入数据」选择：
   - `latest.json`：最近一次；
   - 或某个 `snapshot-*.json`：指定历史版本。
4. 导入后检查学生、作业、请假等数据；如需同步到云端，再执行「手动云同步 → 本地 → 云端」。

如果只想恢复单个分类，可先用文本编辑器打开 JSON 查看，但不要手动改坏结构。

## 六、更新宏

1. 退出旧程序（或运行卸载脚本）。
2. 用新压缩包覆盖旧文件。
3. 重新运行 `install-local-backup.ps1`。
4. 备份目录不会被删除，历史快照仍保留。

当前脚本版本：`1.1.0`。设置页的 `/health` 会返回版本号，便于确认是否已更新。

## 七、卸载

1. 右键运行 `uninstall-local-backup.ps1`；
2. 脚本会删除开机任务并停止由它启动的 Python 进程；
3. `ClassManagerBackup` 文件夹不会自动删除，确认不需要后再手动删除。

## 八、常见问题

### 1. 设置页一直显示“未连接”

按顺序检查：

1. 是否安装 Python，`python --version` 是否正常；
2. 是否运行过 `install-local-backup.ps1`；
3. 双击 `START-LOCAL-BACKUP.bat`，看窗口是否报错；
4. 访问 <http://127.0.0.1:8765/health> 是否能打开；
5. 是否被安全软件拦截了本机端口。

### 2. 提示端口 8765 被占用

说明已有程序占用该端口。先结束旧的 Python 进程，或设置环境变量换端口：

```powershell
$env:CLASS_BACKUP_PORT = "8766"
python .\local-backup-server.py
```

但网页端默认连接 `8765`，换端口后需要同步修改网页配置，普通用户不建议改动。

### 3. 安装脚本提示“未找到 Python”

Python 没有加入 PATH。重新安装 Python 并勾选 **Add Python to PATH**，或手动把 Python 安装目录加入环境变量。

### 4. 浏览器提示无法连接本机服务

- 确认宏正在运行；
- 确认地址是 `http://127.0.0.1:8765`，不是 `https`；
- 某些浏览器会拦截 HTTPS 页面访问本机 HTTP 服务，可改用 Edge/Chrome 最新版，或把页面下载到本地打开；
- 公司/学校电脑可能禁用本机端口，需要联系管理员。

### 5. 备份文件会越来越大吗

不会。只保留 `latest.json` 和最近 30 份快照，旧快照会自动删除。若数据量很大，可手动清理 `snapshot-*.json`。

### 6. 换电脑后怎么办

在新电脑重新安装宏即可；旧电脑的 `latest.json` 可复制到新电脑，通过「导入数据」恢复。

## 九、安全说明

- 服务只监听 `127.0.0.1`，局域网内其他电脑无法访问。
- 备份是明文 JSON，包含班级数据；不要把备份目录放到公共网盘或共享文件夹。
- 不要把 `ClassManagerBackup` 目录提交到 GitHub。
- 卸载宏不会删除备份；如需彻底清理，请手动删除该目录。
