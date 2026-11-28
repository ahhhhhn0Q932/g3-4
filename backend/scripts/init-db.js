const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");
const { config } = require("../src/config");

async function migrateAccountSchema(conn) {
  // 旧版 class_admins 每个班级只允许一个管理员；升级为多账号体系
  const [mainCol] = await conn.query(
    "SELECT COLUMN_NAME FROM information_schema.columns WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'class_admins' AND COLUMN_NAME = 'is_main'",
    [config.db.database]
  );
  if (!mainCol.length) {
    await conn.query("ALTER TABLE class_admins ADD COLUMN is_main TINYINT(1) NOT NULL DEFAULT 0 AFTER display_name");
    console.log("[db:init] 已增加 class_admins.is_main");
  }
  const [classIdx] = await conn.query(
    "SELECT INDEX_NAME FROM information_schema.statistics WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'class_admins' AND INDEX_NAME = 'idx_class_admins_class'",
    [config.db.database]
  );
  if (!classIdx.length) {
    await conn.query("ALTER TABLE class_admins ADD INDEX idx_class_admins_class (class_id)");
  }
  const [uniqueIdx] = await conn.query(
    "SELECT INDEX_NAME FROM information_schema.statistics WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'class_admins' AND INDEX_NAME = 'uk_class_admins_class'",
    [config.db.database]
  );
  if (uniqueIdx.length) {
    await conn.query("ALTER TABLE class_admins DROP INDEX uk_class_admins_class");
    console.log("[db:init] 已移除 class_admins 单管理员唯一约束");
  }
  // 每个班级保留最早的管理员作为主账号
  const [classes] = await conn.query("SELECT class_id, MIN(id) AS id FROM class_admins GROUP BY class_id");
  for (const row of classes) {
    await conn.query(
      "UPDATE class_admins SET is_main = 1 WHERE id = ? AND NOT EXISTS (SELECT 1 FROM (SELECT 1 FROM class_admins m WHERE m.class_id = ? AND m.is_main = 1) x)",
      [row.id, row.class_id]
    );
  }
}

async function main() {
  const schemaPath = path.join(__dirname, "..", "sql", "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf8");
  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    multipleStatements: true,
    charset: "utf8mb4"
  });
  try {
    await conn.query(schema);
    await migrateAccountSchema(conn);
    console.log(`[db:init] schema 已应用到 ${config.db.host}:${config.db.port}/${config.db.database}`);
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error("[db:init] 失败：", error.message);
  console.error("请确认 MySQL Community 已启动，且 backend/.env 数据库配置正确。");
  process.exit(1);
});
