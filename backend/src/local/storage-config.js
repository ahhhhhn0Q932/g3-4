const fs = require("node:fs");
const path = require("node:path");
const { config } = require("../config");

const CONFIG_PATH = config.localConfigPath;

function readStorageConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return null;
  const raw = fs.readFileSync(CONFIG_PATH, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || (parsed.mode !== "sqlite" && parsed.mode !== "supabase")) {
    throw new Error("本机存储配置文件格式不正确");
  }
  return parsed;
}

function writeStorageConfig(value) {
  if (fs.existsSync(CONFIG_PATH)) {
    const error = new Error("存储方式已经锁定，不能再次更改");
    error.code = "STORAGE_LOCKED";
    throw error;
  }
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  const body = {
    mode: value.mode === "supabase" ? "supabase" : "sqlite",
    supabase: value.mode === "supabase" ? {
      host: String(value.supabase.host || "").trim(),
      port: Number(value.supabase.port) || 5432,
      database: String(value.supabase.database || "postgres").trim(),
      user: String(value.supabase.user || "").trim(),
      password: String(value.supabase.password || ""),
      ssl: value.supabase.ssl !== false
    } : null,
    createdAt: new Date().toISOString()
  };
  const tmp = CONFIG_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(body, null, 2), { mode: 0o600 });
  try { fs.chmodSync(tmp, 0o600); } catch (_) { /* ignore */ }
  fs.renameSync(tmp, CONFIG_PATH);
  return body;
}

function publicStorageConfig(value) {
  if (!value) return null;
  return {
    mode: value.mode,
    supabase: value.mode === "supabase" ? {
      host: value.supabase.host,
      port: value.supabase.port,
      database: value.supabase.database,
      user: value.supabase.user,
      ssl: value.supabase.ssl !== false
    } : null
  };
}

module.exports = { CONFIG_PATH, readStorageConfig, writeStorageConfig, publicStorageConfig };
