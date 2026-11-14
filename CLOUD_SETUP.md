# 云端同步设置（Supabase）

网页仍放在 GitHub Pages，数据改存 Supabase；本机 localStorage 继续作为缓存和离线备份。

## 第一次使用：先建表

1. 打开 <https://supabase.com/dashboard/project/frovhrrtpkyhhnsozcfk/sql/new>
2. 把仓库里的 [`supabase-schema.sql`](supabase-schema.sql) 整段粘贴进去，点 **Run**。
3. 看到 `Success. No rows returned` 即可。脚本可重复执行，不会清空已有数据，也不会重置已改过的密码。

## 进入系统

- 打开 <https://ahhhhhn0Q932.github.io/g3-4/>，刷新页面。
- 管理员默认密码：`123`。第一次管理员登录时，如果云端还是空的，会把本机现有数据自动上传。
- 其他设备管理员登录后会先从云端拉取；访客只能修改请假和班级日志留言，其他内容只读。

## 修改管理员密码

进入 **设置 → 管理员密码**，输入当前密码和两次新密码。密码只以 bcrypt 哈希保存在 Supabase，页面本地不再保存明文。

## 注意事项

- 发布用 `sb_publishable_...` key 会出现在网页源码里，拿到它的人可以读取云端班级数据；请勿把特别敏感的信息放进来。
- 默认密码 `123` 只是初始化用，部署后请立即修改。
- 如果管理员登录提示「数据库还没初始化」，说明上面的 SQL 还没执行。
- 云端同步为「最后写入覆盖 + 请假/留言服务端合并」；多人同时改同一块内容时，以最后保存的版本为准。
- 本机数据仍可用「设置 → 导出全部数据」备份；云端数据可在 Supabase Table Editor 的 `class_state` 表查看。
