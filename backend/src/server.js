const { config } = require("./config");
const { createApp } = require("./app");

let closeDatabase = async () => {};
if (config.local) {
  const local = require("./local/store");
  closeDatabase = async () => local.closeLocalStore();
} else {
  const { pool } = require("./db");
  closeDatabase = async () => pool.end();
}

const app = createApp();
const server = app.listen(config.port, "127.0.0.1", () => {
  if (config.local) {
    console.log(`[classpanel] 本机单机模式已启动：http://127.0.0.1:${config.port}`);
    console.log(`[classpanel] 存储：首次打开选择 SQLite 或 Supabase · 配置 ${config.localConfigPath}`);
    console.log(`[classpanel] 前端目录：${config.frontendDist}`);
  } else {
    console.log(`[classpanel] API 已启动：http://127.0.0.1:${config.port}/api`);
    console.log(`[classpanel] 环境：${config.env} · MySQL ${config.db.host}:${config.db.port}/${config.db.database}`);
  }
});

async function shutdown(signal) {
  console.log(`\n[classpanel] 收到 ${signal}，正在关闭…`);
  server.close(async () => {
    try {
      await closeDatabase();
    } catch (_) {
      /* ignore */
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
