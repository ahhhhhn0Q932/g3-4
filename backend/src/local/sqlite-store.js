const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

class SqliteStore {
  constructor(dbPath) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec(`
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
  }

  async init() { return this; }
  async ping() { this.db.prepare("SELECT 1 AS ok").get(); return true; }

  async getClass() {
    return this.db.prepare("SELECT * FROM classes WHERE id = 1").get() || null;
  }

  async findAccountByUsername(username) {
    let row = this.db.prepare("SELECT * FROM class_admins WHERE username = ? LIMIT 1").get(username);
    if (row) return { role: "class_admin", row };
    row = this.db.prepare("SELECT * FROM class_members WHERE username = ? LIMIT 1").get(username);
    if (row) return { role: "class_member", row };
    return null;
  }

  async getAccount(type, id) {
    if (type === "admin") return this.db.prepare("SELECT * FROM class_admins WHERE id = ? AND class_id = 1").get(id) || null;
    if (type === "member") return this.db.prepare("SELECT * FROM class_members WHERE id = ? AND class_id = 1").get(id) || null;
    return null;
  }

  async listAccounts() {
    return {
      admins: this.db.prepare("SELECT * FROM class_admins WHERE class_id = 1 ORDER BY is_main DESC, id ASC").all(),
      members: this.db.prepare("SELECT * FROM class_members WHERE class_id = 1 ORDER BY id ASC").all()
    };
  }

  async usernameTaken(username, excludeType, excludeId) {
    const a = this.db.prepare("SELECT id FROM class_admins WHERE username = ?").get(username);
    if (a && !(excludeType === "admin" && Number(a.id) === Number(excludeId))) return true;
    const m = this.db.prepare("SELECT id FROM class_members WHERE username = ?").get(username);
    if (m && !(excludeType === "member" && Number(m.id) === Number(excludeId))) return true;
    return false;
  }

  async createClass({ className, username, passwordHash, displayName, initialState }) {
    const ts = new Date().toISOString();
    this.db.exec("BEGIN");
    try {
      if (this.db.prepare("SELECT id FROM classes WHERE id = 1").get()) {
        const error = new Error("本机已经创建过班级，不能再创建第二个");
        error.code = "CLASS_EXISTS";
        throw error;
      }
      this.db.prepare("INSERT INTO classes (id, name, status, created_at, updated_at) VALUES (1, ?, 'active', ?, ?)").run(className, ts, ts);
      const result = this.db.prepare("INSERT INTO class_admins (class_id, username, password_hash, display_name, is_main, created_at) VALUES (1, ?, ?, ?, 1, ?)").run(username, passwordHash, displayName || username, ts);
      this.db.prepare("INSERT INTO class_state (class_id, payload, revision, updated_at) VALUES (1, ?, 1, ?)").run(JSON.stringify(initialState || {}), ts);
      this.db.exec("COMMIT");
      return { id: Number(result.lastInsertRowid), username, display_name: displayName || username, is_main: 1 };
    } catch (error) {
      try { this.db.exec("ROLLBACK"); } catch (_) { /* ignore */ }
      throw error;
    }
  }

  async createAccount({ role, username, passwordHash, displayName, createdBy }) {
    const ts = new Date().toISOString();
    if (role === "admin") {
      const result = this.db.prepare("INSERT INTO class_admins (class_id, username, password_hash, display_name, is_main, created_at) VALUES (1, ?, ?, ?, 0, ?)").run(username, passwordHash, displayName || username, ts);
      return this.getAccount("admin", Number(result.lastInsertRowid));
    }
    const result = this.db.prepare("INSERT INTO class_members (class_id, username, password_hash, display_name, created_by, created_at) VALUES (1, ?, ?, ?, ?, ?)").run(username, passwordHash, displayName || username, createdBy, ts);
    return this.getAccount("member", Number(result.lastInsertRowid));
  }

  async updateAccount(type, id, patch) {
    const fields = [], params = [];
    if (patch.username !== undefined) { fields.push("username = ?"); params.push(patch.username); }
    if (patch.displayName !== undefined) { fields.push("display_name = ?"); params.push(patch.displayName); }
    if (patch.passwordHash !== undefined) { fields.push("password_hash = ?"); params.push(patch.passwordHash); }
    if (!fields.length) return this.getAccount(type, id);
    params.push(id);
    const table = type === "admin" ? "class_admins" : "class_members";
    this.db.prepare(`UPDATE ${table} SET ${fields.join(", ")} WHERE id = ?`).run(...params);
    return this.getAccount(type, id);
  }

  async deleteAccount(type, id) {
    const table = type === "admin" ? "class_admins" : "class_members";
    this.db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
  }

  async updateLastLogin(type, id) {
    const table = type === "admin" ? "class_admins" : "class_members";
    this.db.prepare(`UPDATE ${table} SET last_login_at = ? WHERE id = ?`).run(new Date().toISOString(), id);
  }

  async getState() {
    const row = this.db.prepare("SELECT payload, revision, updated_at FROM class_state WHERE class_id = 1").get();
    if (!row) return null;
    return { payload: JSON.parse(row.payload), revision: Number(row.revision), updatedAt: row.updated_at };
  }

  async saveState({ payload, className }) {
    const cls = await this.getClass();
    if (!cls) throw new Error("本机还没有班级");
    const ts = new Date().toISOString();
    this.db.exec("BEGIN");
    try {
      if (className && className !== cls.name) {
        this.db.prepare("UPDATE classes SET name = ?, updated_at = ? WHERE id = 1").run(className, ts);
      }
      const current = this.db.prepare("SELECT revision FROM class_state WHERE class_id = 1").get();
      const revision = Number(current ? current.revision : 0) + 1;
      this.db.prepare("UPDATE class_state SET payload = ?, revision = ?, updated_at = ? WHERE class_id = 1").run(JSON.stringify(payload), revision, ts);
      this.db.exec("COMMIT");
      return { revision, updatedAt: ts, payload };
    } catch (error) {
      try { this.db.exec("ROLLBACK"); } catch (_) { /* ignore */ }
      throw error;
    }
  }

  async close() {
    try { this.db.close(); } catch (_) { /* ignore */ }
  }
}

module.exports = { SqliteStore };
