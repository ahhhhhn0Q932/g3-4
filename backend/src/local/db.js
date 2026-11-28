const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { config } = require("../config");

fs.mkdirSync(path.dirname(config.localDbPath), { recursive: true });
const db = new DatabaseSync(config.localDbPath);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");
db.exec(`
  CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS class_admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL DEFAULT 1,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    is_main INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    last_login_at TEXT,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS class_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL DEFAULT 1,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    created_by INTEGER,
    created_at TEXT NOT NULL,
    last_login_at TEXT,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES class_admins(id) ON DELETE SET NULL
  );
  CREATE TABLE IF NOT EXISTS class_state (
    class_id INTEGER PRIMARY KEY,
    payload TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_local_admins_class ON class_admins(class_id);
  CREATE INDEX IF NOT EXISTS idx_local_members_class ON class_members(class_id);
`);

function getClass() {
  return db.prepare("SELECT * FROM classes WHERE id = 1").get() || null;
}

function close() {
  try { db.close(); } catch (_) { /* ignore */ }
}

module.exports = { db, getClass, close };
