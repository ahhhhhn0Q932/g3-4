# 云端同步设置（Supabase）

网页仍放在 GitHub Pages，数据改存 Supabase；本机 localStorage 继续作为缓存和离线备份。

## 第一次使用：先建表

1. 打开 <https://supabase.com/dashboard/project/frovhrrtpkyhhnsozcfk/sql/new>
2. 把仓库里的 [`supabase-schema.sql`](supabase-schema.sql) 整段粘贴进去，点 **Run**。
3. 看到 `Success. No rows returned` 即可。脚本可重复执行，不会清空已有数据，也不会重置已改过的密码。

## 进入系统

- 打开 <https://ahhhhhn0Q932.github.io/g3-4/>，刷新页面。
- 管理员默认密码：`123`。第一次管理员登录时，如果云端还是空的，会把本机现有数据自动上传。
- 其他设备管理员登录后会先从云端拉取；访客只能修改请假、班级日志留言和 Issue 看板，其他内容只读。
- **升级提示**：如果之前已经执行过旧版 `supabase-schema.sql`，为了让访客提交的 Issue 也能同步，请重新执行一次脚本；脚本会 `create or replace` 函数，不会清空数据。

## 修改管理员密码

进入 **设置 → 管理员密码**，输入当前密码和两次新密码。密码只以 bcrypt 哈希保存在 Supabase，页面本地不再保存明文。

## 手动同步与同步时间

- **设置 → 云同步 → 手动云同步**：先选择“本地 → 云端”或“云端 → 本地”，再逐项勾选要同步的数据。管理员可上传完整数据，访客只合并请假、班级日志留言与 Issue 看板。
- **云端 → 本地**时可选择“最新云端数据”，或从下拉框选择最近 5 天内的某个历史备份。
- **首页最下方**会显示「本地保存」和「云端同步」的最近时间；两端相差超过 1 天时会弹出警告并要求确认方向。
- 平时保存仍会自动同步；手动同步用于换设备后或网络恢复时立即刷新。

## 云端每日备份

`supabase-schema.sql` 末尾新增：

- `class_state_backups` 表，每天北京时间 00:00 保存一份 `class_state` 快照；
- `create_class_backup()` 自动清理 5 天前的备份；
- `class_manual_backups` 表保存一次性手动备份，`create_manual_backup(pwd)` 写入快照并设置 1 天过期；
- `pg_cron` 定时任务 `class-daily-backup`（UTC 16:00）。

升级时请重新执行整段 SQL。若提示 `pg_cron` 未启用，先在 Supabase Dashboard → Database → Extensions 打开 `pg_cron`，再重新执行脚本末尾的定时任务部分。

## 本机自动备份

浏览器不能静默写入 `AppData`，所以增加一个本机 Python 小程序：

1. 安装 Python 3；
2. 运行 `install-local-backup.ps1`（右键使用 PowerShell 运行）；
3. 程序监听 `127.0.0.1:8765`，保存到 `%USERPROFILE%\ClassManagerBackup`，保留 `latest.json` 与最近 30 份快照；
4. 手动启动可双击 `START-LOCAL-BACKUP.bat`，设置页会显示连接状态。

## 注意事项

- 发布用 `sb_publishable_...` key 会出现在网页源码里，拿到它的人可以读取云端班级数据；请勿把特别敏感的信息放进来。
- 默认密码 `123` 只是初始化用，部署后请立即修改。
- 如果管理员登录提示「数据库还没初始化」，说明上面的 SQL 还没执行。
- 云端同步为「最后写入覆盖 + 请假/留言服务端合并」；多人同时改同一块内容时，以最后保存的版本为准。
- 本机数据仍可用「设置 → 导出全部数据」备份；云端数据可在 Supabase Table Editor 的 `class_state` 表查看。
