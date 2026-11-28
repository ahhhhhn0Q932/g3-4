const mysql = require("mysql2/promise");
const { config } = require("./config");

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4",
  timezone: "Z",
  decimalNumbers: true,
  supportBigNumbers: true,
  bigNumberStrings: false
});

// 数据库统一使用 UTC，避免 MySQL 服务器本地时区与 Node 解析时区不一致
pool.on("connection", (conn) => {
  conn.query("SET time_zone = '+00:00'", () => {});
});

async function query(sql, params) {
  const [rows] = await pool.execute(sql, params || []);
  return rows;
}

async function withTransaction(handler) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await handler(conn);
    await conn.commit();
    return result;
  } catch (error) {
    try {
      await conn.rollback();
    } catch (_) {
      /* ignore rollback errors */
    }
    throw error;
  } finally {
    conn.release();
  }
}

function isDuplicateError(error) {
  return error && (error.code === "ER_DUP_ENTRY" || error.errno === 1062);
}

module.exports = { pool, query, withTransaction, isDuplicateError };
