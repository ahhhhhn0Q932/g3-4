# ClassPanel · 班级管理系统

ClassPanel 是一个面向班级日常管理的多班级系统，包含作业、请假、提醒、班级日志、工具箱、回声洞、设置与反馈。项目已从单文件 HTML 重构为**前后端分离**架构：

- 前端：React 18 + Vite + **MUI（Material UI）**，保留原有暖色主题、圆角、布局和交互风格。
- 后端：Node.js + Express + **MySQL Community 8.4**；另支持 `-local` 单机模式，使用 **SQLite**。
- 账号体系：总管理员 / 班级主账号 / 班级管理员 / 普通账号 / 令牌登录客户端。
- 数据：云端模式保存到 MySQL；本机单机模式保存到 SQLite；浏览器只保留本机缓存，服务器为权威数据源。

> 当前配置面向本机开发环境，使用 HTTP 和本地 MySQL，不是正式生产服务器。正式部署前请更换强密码、HTTPS、反向代理和独立数据库账号。

---

## 目录结构

```text
ClassPanel/
├─ backend/                     # Express + MySQL 后端
│  ├─ src/
│  │  ├─ app.js                # API 入口与中间件
│  │  ├─ server.js             # HTTP 启动
│  │  ├─ auth.js               # JWT / 班级管理员 / 普通账号 / 令牌客户端中间件
│  │  ├─ db.js                 # mysql2 连接池
│  │  ├─ routes/
│  │  │  ├─ auth.js            # 登录、令牌客户端登录、/me
│  │  │  ├─ classes.js         # 班级注册、状态读写、令牌、改密
│  │  │  └─ super.js           # 总管理员跨班级管理
│  │  └─ validation.js         # zod 参数校验
│  ├─ sql/schema.sql           # MySQL 表结构
│  ├─ scripts/
│  │  ├─ init-db.js            # 应用表结构
│  │  ├─ create-super-admin.js # 仅后端可用的总管理员注册
│  │  ├─ static-server.js      # 生产构建静态服务
│  │  └─ mysql-*.sh            # 独立 MySQL Community 8.4 开发实例
│  ├─ .env.example
│  └─ package.json
├─ frontend/                    # React + Vite + MUI
│  ├─ src/
│  │  ├─ App.jsx / main.jsx
│  │  ├─ state/AppContext.jsx  # 登录、服务器同步、全局状态与操作
│  │  ├─ pages/                # 登录、首页、总览、请假、提醒、日志、工具、设置、开发、总管理员
│  │  ├─ components/AppShell.jsx
│  │  ├─ data/                 # 常量、默认数据、课表
│  │  ├─ styles.css            # 从原单文件迁移的视觉样式
│  │  ├─ theme.js              # MUI 主题
│  │  └─ utils.js
│  ├─ index.html
│  └─ package.json
├─ legacy/local-backup/         # 旧版本地备份/Supabase 资料，仅归档
└─ README.md
```

---

## 快速开始（本机开发）

> 需要 Node.js 24+；本机单机模式使用 Node 内置的 `node:sqlite`。

### 1. 准备后端环境

```bash
cd backend
cp .env.example .env
# 编辑 .env：至少修改 JWT_SECRET、DB_PASSWORD
# JWT_SECRET 可用：node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npm install
```

### 2. 安装并启动 MySQL Community

后端附带脚本会下载 **MySQL Community 8.4.5 minimal** 到 `backend/.mysql/`，不需要系统 root 权限，也不会使用系统 MariaDB：

```bash
cd backend
npm run mysql:setup     # 首次：下载、初始化数据目录、启动 3307、创建数据库和账号
npm run db:init         # 应用 schema
```

后续只需要：

```bash
npm run mysql:start     # 启动
npm run mysql:status    # 查看状态
npm run mysql:stop      # 停止
```

如果本机已有 MySQL Community，可跳过 `mysql:*` 脚本，直接在 `.env` 配置 `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME`，然后执行 `npm run db:init`。

### 3. 创建总管理员（只能通过后端）

```bash
cd backend
npm run super:create -- --username superadmin --password '请换成强密码' --name '总管理员'
```

前端没有任何注册总管理员的接口或按钮；该命令直接写入 MySQL。

### 4. 启动后端

```bash
cd backend
npm run dev
# API: http://127.0.0.1:3001/api
# 健康检查: http://127.0.0.1:3001/api/health
```

### 5. 启动前端

另开一个终端：

```bash
cd frontend
npm install
npm run dev
# 班级应用: http://127.0.0.1:5173/index.html
# 总管理员: http://127.0.0.1:5173/index.html#/super
```

首次使用：先打开总管理员控制台（`#/super`）创建注册码，然后在班级登录页进入「注册班级」，填写注册码、班级名称（最多 10 个字符）和管理员账号，注册成功后自动登录。

### 6. 生产式构建（本机）

```bash
cd frontend
npm run build
cd ../backend
npm run static
# 使用 frontend/dist 静态文件：http://127.0.0.1:5173
```

---

## 本机单机模式（SQLite）

适合只在一台电脑上使用的场景，不需要安装 MySQL，也不需要总管理员账号。

```bash
# 第一次运行：构建前端并启动本机模式
cd backend
npm run local:build

# 之后前端没有改动时，直接启动
npm run local
```

也可以直接使用参数启动：

```bash
cd backend
node src/server.js -local
```

打开 `http://127.0.0.1:3001`：

- **第一次打开**会显示「本机单机模式 · 首次设置」，只能创建一个班级。
- 创建后本机最多只有一个班级，不再显示注册入口。
- 不显示总管理员控制台、注册码和总管理员相关入口；`/api/super` 在本机模式不可用。
- 班级数据保存在 `backend/data/classpanel-local.sqlite`，令牌登录、云端多班级等功能不参与本机模式。
- 如需重置本机数据，停止服务后删除 `backend/data/classpanel-local.sqlite*`，下次启动可重新首次设置。
- 本机模式仍支持班级主账号、普通管理员、普通账号和只读权限。

云端 MySQL 模式保持不变：`cd backend && npm run dev`。

---

## 账号与权限

| 身份 | 入口 | 注册方式 | 能力 |
| --- | --- | --- | --- |
| 总管理员 | `#/super` | 仅后端 `npm run super:create` | 创建注册码；查看全部班级、搜索、改名、停用/启用、重置班级管理员密码、导出班级数据、删除班级 |
| 班级主账号 | 班级登录 | 注册新班级时创建的第一个班级管理员 | 管理本班全部业务；可注册/删除其他账号，可修改班级内所有账号的用户名、显示名称和密码；不可被删除或被其他管理员修改 |
| 班级管理员 | 班级登录 | 主账号或其他管理员注册 | 管理本班业务；可注册/删除其他管理员和普通账号；只能修改自己的账号信息 |
| 普通账号 | 普通账号登录 | 班级管理员注册 | 只能查看班级信息，不能修改作业、生日、课程表、提醒、请假、日志、设置等任何班级数据 |
| 令牌登录客户端 | 后端令牌 | 后端命令 `npm run token:create` | 仅用于班级电脑显示客户端；只读，不能修改班级数据；网页端不显示登录入口 |

### 班级注册规则

- **必须填写总管理员创建的注册码**；注册码无效、已撤销、已过期或次数用完时不能注册。
- 班级名称必填，长度 1-10 个字符（服务端按 Unicode 字符数校验，数据库 `VARCHAR(10)`）。
- 必须同时填写管理员账号、密码；账号 3-32 位字母/数字/下划线，密码 6-72 位。
- 班级名称和管理员账号均唯一。
- 注册事务同时创建班级、班级管理员、初始班级数据，并原子消耗注册码次数；注册失败不会浪费次数。

### 班级账号体系

- 第一个注册的班级管理员自动成为**主账号**，数据库标记 `is_main = 1`。
- 主账号不可删除；其他管理员不能修改主账号的用户名、显示名称或密码。
- 主账号可以修改班级内所有账号的信息和密码。
- 班级管理员可以在「设置 → 账号管理」注册新的班级管理员或普通账号，并删除非主账号、非当前登录账号。
- 普通账号绑定班级，只能查看班级数据；后端会拒绝普通账号的班级状态写入请求。
- 普通账号使用登录页的「普通账号」入口，输入账号和密码登录。

### 注册码

- 仅总管理员可创建，位于 `#/super` 的「注册码」区域。
- 可设置备注、可用次数（1/2/5/10 次或不限次数）和有效期（1/7/30/90 天或永久）。
- 注册码为 16 位大写字母/数字，创建后可直接复制；可随时撤销。
- 注册码状态包括：可用、已用完、已过期、已撤销。

### 课程表

- 导航新增「课表」页面，包含「时刻表模板」「每周安排」「科目列表」「每日课程」四个部分。
- 时刻表模板可创建多个，每个模板由「课程」「课间」「自习」「午休」四种时刻组成，可自定义开始/结束时间和显示名称。
- 可以为周一至周日分别选择任意一个时刻表模板；默认不预置模板、不预置科目，全部由班级管理员自行创建。
- 科目列表可设置科目名称和授课老师；每日课程按当天模板的「课程」板块选择科目。
- 首页「今日课表」读取自定义课程表；未配置时显示「去课程表设置」入口。
- 课间和午休默认不显示在课程表列表中，只有当前时间进入对应时段时才临时显示。

### 令牌登录（班级电脑客户端）

- 令牌登录**不在网页显示**，登录页和设置页都没有令牌入口或令牌管理卡片。
- 令牌由后端控制台生成，用于后续班级电脑显示客户端；当前不需要开发客户端。
- 生成令牌：

  ```bash
  cd backend
  npm run token:create -- --class "高三(4)班" --label "班级电脑" --days 0
  ```

  - `--days 0` 表示永久有效；也可填 1-3650 天。
  - 查看令牌：`npm run token:create -- --class "高三(4)班" --list`
  - 撤销令牌：`npm run token:create -- --class "高三(4)班" --revoke 令牌ID`

- 未来客户端使用 `POST /api/auth/token`，请求体 `{ "accessToken": "令牌" }`。
- 令牌账号角色为 `class_display`，只能读取班级数据，不能修改作业、生日、课程表等任何内容。

---

## 后端 API 摘要

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/auth/class/login` | 班级管理员 / 普通账号登录 |
| POST | `/api/auth/super/login` | 总管理员登录 |
| POST | `/api/auth/token` | 班级电脑客户端令牌登录（`/auth/guest` 为兼容别名） |
| GET | `/api/auth/me` | 当前会话信息 |
| POST | `/api/classes/register` | 注册班级并创建管理员 |
| GET | `/api/classes/:id/state` | 读取班级数据 |
| PUT | `/api/classes/:id/state` | 保存班级数据（仅班级管理员） |
| GET/POST | `/api/classes/:id/tokens` | 查看 / 生成客户端令牌（网页不展示） |
| DELETE | `/api/classes/:id/tokens/:tokenId` | 撤销令牌 |
| POST | `/api/classes/:id/password` | 修改当前账号密码 |
| GET | `/api/classes/:id/accounts` | 查看班级账号列表（管理员） |
| POST | `/api/classes/:id/accounts` | 注册班级管理员 / 普通账号 |
| PATCH | `/api/classes/:id/accounts/:type/:id` | 修改账号信息或密码（主账号可修改所有） |
| DELETE | `/api/classes/:id/accounts/:type/:id` | 删除账号（主账号不可删除） |
| GET | `/api/super/overview` | 总管理员统计 |
| GET | `/api/super/classes` | 全部班级列表 |
| GET | `/api/super/classes/:id` | 班级详情与令牌概况 |
| PATCH | `/api/super/classes/:id` | 改名 / 停用 / 启用 |
| POST | `/api/super/classes/:id/reset-admin-password` | 重置班级管理员密码 |
| DELETE | `/api/super/classes/:id` | 删除班级及关联数据 |
| GET | `/api/super/registration-codes` | 查看注册码列表 |
| POST | `/api/super/registration-codes` | 创建注册码（次数 / 有效期） |
| DELETE | `/api/super/registration-codes/:id` | 撤销注册码 |

---

## 数据与安全

- 密码使用 `bcryptjs` 哈希保存；总管理员与班级管理员分别存表。
- 登录使用 JWT（Bearer Token）；令牌客户端每次请求额外校验数据库中的令牌状态。
- 总管理员账号只存在于 `super_admins` 表，前端没有注册接口；注册码必须由总管理员创建。
- 令牌客户端只能读取班级数据；普通账号同样只读，所有写接口由后端拒绝。
- 班级状态数据保存在 `class_states.payload`（MySQL JSON），服务端会移除 `adminPassword` 等敏感字段。
- 登录/注册/令牌接口有速率限制；CORS 只允许配置中的前端地址。
- 本机开发环境使用 HTTP 和本地 3307 MySQL；正式环境请使用 HTTPS、反向代理、强 JWT 密钥、独立数据库账号并限制 CORS。

---

## 从旧单文件版本迁移

旧版数据保存在浏览器 `localStorage`（`gaoer3_classroom_v2`）。迁移步骤：

1. 在旧页面「开发 → 导出全部数据」导出 JSON。
2. 注册新班级并以班级管理员登录。
3. 在「开发 → 导入数据」导入 JSON，确认后会自动推送到 MySQL。

旧版本的本地备份/Supabase 资料已归档到 `legacy/local-backup/`，新架构不再使用 Supabase。

---

## 开发说明

- 数据库实例、数据目录和 `.env` 都在 `.gitignore` 中，不会提交。
- `backend/.mysql/` 是独立 MySQL Community 实例，端口 `3307`，不占用系统 MySQL/MariaDB 的 3306。
- 前端开发用 Vite 端口 `5173`，后端端口 `3001`；前端通过 `frontend/src/api.js` 自动推导 API 地址。
- 修改前端后运行 `npm run build`；后端 `npm run static` 只服务构建后的 `frontend/dist`。
- 应用内「开发」页展示版本、服务器状态、数据导入导出与更新日志。

## 更新日志

完整版本记录见应用内「开发」页；当前为 `v2.6`：

- 前后端分离：React + Vite + MUI 前端，Express + MySQL Community 后端。
- 多班级与总管理员控制台。
- 班级注册需要总管理员创建的注册码（次数 / 有效期 / 可撤销）。
- 班级注册（班级名称 ≤ 10 字符，同时创建管理员）。
- 令牌登录改为班级电脑客户端专用，网页不显示；通过后端 CLI 生成/撤销。
- 新增 `-local` 单机模式：SQLite 本地数据库、隐藏总管理员界面、仅允许首次创建一个班级。
- 修复 MUI 输入框被旧版全局样式覆盖、按钮图标不居中及课程表/作业页面文字贴边问题。
- 保留原有暖色主题与主要业务功能。
- 提高次要文字、空状态、提示语和表单占位符对比度，改善浅色背景下的可读性。
- 新增自定义课程表：多模板、每周模板分配、科目与授课老师、每日课程选择；课间/午休仅到达时段时显示。
- 新增班级多账号体系：主账号、普通管理员、普通账号，主账号保护与账号管理。
