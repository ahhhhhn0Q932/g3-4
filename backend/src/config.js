const path = require("node:path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`缺少环境变量 ${name}，请复制 backend/.env.example 为 backend/.env 并填写`);
  return value;
}

const isProd = process.env.NODE_ENV === "production";
const isLocal = process.argv.includes("-local") || process.argv.includes("--local") || process.env.CLASSPANEL_LOCAL === "1";
const jwtSecret = String(process.env.JWT_SECRET || "").trim()
  || (isLocal ? "classpanel-local-single-machine-dev-secret-change-me" : "");

if (!jwtSecret) {
  throw new Error("缺少 JWT_SECRET，请复制 backend/.env.example 为 backend/.env 并生成随机密钥");
}
if (isProd && jwtSecret.length < 32) {
  throw new Error("生产环境 JWT_SECRET 至少需要 32 个字符");
}

const config = {
  env: process.env.NODE_ENV || "development",
  isProd,
  local: isLocal,
  localDbPath: process.env.LOCAL_DB_PATH || path.join(__dirname, "..", "data", "classpanel-local.sqlite"),
  localConfigPath: process.env.LOCAL_CONFIG_PATH || path.join(__dirname, "..", "data", "local-storage.json"),
  frontendDist: path.join(__dirname, "..", "..", "frontend", "dist"),
  port: Number(process.env.PORT || (isLocal ? 3001 : 3001)),
  frontendPort: Number(process.env.FRONTEND_PORT || 5173),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "12h",
  db: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3307),
    user: process.env.DB_USER || "classpanel",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "classpanel"
  },
  corsOrigins: String(process.env.CORS_ORIGINS || "http://127.0.0.1:5173,http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
};

module.exports = { config, required };
