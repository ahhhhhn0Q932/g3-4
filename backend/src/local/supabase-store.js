const { Pool } = require("pg");

class SupabaseStore {
  constructor(conn) {
    this.pool = new Pool({
      host: conn.host,
      port: Number(conn.port) || 5432,
      database: conn.database || "postgres",
      user: conn.user,
      password: conn.password,
      ssl: conn.ssl === false ? false : { rejectUnauthorized: false },
      max: 4,
      connectionTimeoutMillis: 8000,
      application_name: "classpanel-local-supabase"
    });
    this.pool.on("error", () => { /* keep the process alive on idle client errors */ });
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS classpanel_class (
        id integer PRIMARY KEY CHECK (id = 1),
        name text NOT NULL,
        status text NOT NULL DEFAULT 'active',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS classpanel_admins (
        id bigserial PRIMARY KEY,
        class_id integer NOT NULL DEFAULT 1 REFERENCES classpanel_class(id) ON DELETE CASCADE,
        username text NOT NULL UNIQUE,
        password_hash text NOT NULL,
        display_name text NOT NULL DEFAULT '',
        is_main boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        last_login_at timestamptz
      );
      CREATE TABLE IF NOT EXISTS classpanel_members (
        id bigserial PRIMARY KEY,
        class_id integer NOT NULL DEFAULT 1 REFERENCES classpanel_class(id) ON DELETE CASCADE,
        username text NOT NULL UNIQUE,
        password_hash text NOT NULL,
        display_name text NOT NULL DEFAULT '',
        created_by bigint REFERENCES classpanel_admins(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        last_login_at timestamptz
      );
      CREATE TABLE IF NOT EXISTS classpanel_state (
        class_id integer PRIMARY KEY REFERENCES classpanel_class(id) ON DELETE CASCADE,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        revision integer NOT NULL DEFAULT 1,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_classpanel_admins_class ON classpanel_admins(class_id);
      CREATE INDEX IF NOT EXISTS idx_classpanel_members_class ON classpanel_members(class_id);
      ALTER TABLE classpanel_class ENABLE ROW LEVEL SECURITY;
      ALTER TABLE classpanel_admins ENABLE ROW LEVEL SECURITY;
      ALTER TABLE classpanel_members ENABLE ROW LEVEL SECURITY;
      ALTER TABLE classpanel_state ENABLE ROW LEVEL SECURITY;
    `);
    return this;
  }

  async ping() {
    await this.pool.query("SELECT 1 AS ok");
    return true;
  }

  async getClass() {
    const { rows } = await this.pool.query("SELECT * FROM classpanel_class WHERE id = 1 LIMIT 1");
    return rows[0] || null;
  }

  async findAccountByUsername(username) {
    let result = await this.pool.query("SELECT * FROM classpanel_admins WHERE username = $1 LIMIT 1", [username]);
    if (result.rows.length) return { role: "class_admin", row: result.rows[0] };
    result = await this.pool.query("SELECT * FROM classpanel_members WHERE username = $1 LIMIT 1", [username]);
    if (result.rows.length) return { role: "class_member", row: result.rows[0] };
    return null;
  }

  async getAccount(type, id) {
    if (type === "admin") {
      const { rows } = await this.pool.query("SELECT * FROM classpanel_admins WHERE id = $1 AND class_id = 1", [id]);
      return rows[0] || null;
    }
    if (type === "member") {
      const { rows } = await this.pool.query("SELECT * FROM classpanel_members WHERE id = $1 AND class_id = 1", [id]);
      return rows[0] || null;
    }
    return null;
  }

  async listAccounts() {
    const [admins, members] = await Promise.all([
      this.pool.query("SELECT * FROM classpanel_admins WHERE class_id = 1 ORDER BY is_main DESC, id ASC"),
      this.pool.query("SELECT * FROM classpanel_members WHERE class_id = 1 ORDER BY id ASC")
    ]);
    return { admins: admins.rows, members: members.rows };
  }

  async usernameTaken(username, excludeType, excludeId) {
    const admin = await this.pool.query("SELECT id FROM classpanel_admins WHERE username = $1 LIMIT 1", [username]);
    if (admin.rows.length && !(excludeType === "admin" && Number(admin.rows[0].id) === Number(excludeId))) return true;
    const member = await this.pool.query("SELECT id FROM classpanel_members WHERE username = $1 LIMIT 1", [username]);
    if (member.rows.length && !(excludeType === "member" && Number(member.rows[0].id) === Number(excludeId))) return true;
    return false;
  }

  async createClass({ className, username, passwordHash, displayName, initialState }) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const exists = await client.query("SELECT id FROM classpanel_class WHERE id = 1");
      if (exists.rows.length) {
        const error = new Error("本机已经创建过班级，不能再创建第二个");
        error.code = "CLASS_EXISTS";
        throw error;
      }
      await client.query("INSERT INTO classpanel_class (id, name, status) VALUES (1, $1, 'active')", [className]);
      const admin = await client.query(
        "INSERT INTO classpanel_admins (class_id, username, password_hash, display_name, is_main) VALUES (1, $1, $2, $3, true) RETURNING *",
        [username, passwordHash, displayName || username]
      );
      await client.query(
        "INSERT INTO classpanel_state (class_id, payload, revision) VALUES (1, $1::jsonb, 1)",
        [JSON.stringify(initialState || {})]
      );
      await client.query("COMMIT");
      return admin.rows[0];
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch (_) { /* ignore */ }
      throw error;
    } finally {
      client.release();
    }
  }

  async createAccount({ role, username, passwordHash, displayName, createdBy }) {
    if (role === "admin") {
      const { rows } = await this.pool.query(
        "INSERT INTO classpanel_admins (class_id, username, password_hash, display_name, is_main) VALUES (1, $1, $2, $3, false) RETURNING *",
        [username, passwordHash, displayName || username]
      );
      return rows[0];
    }
    const { rows } = await this.pool.query(
      "INSERT INTO classpanel_members (class_id, username, password_hash, display_name, created_by) VALUES (1, $1, $2, $3, $4) RETURNING *",
      [username, passwordHash, displayName || username, createdBy]
    );
    return rows[0];
  }

  async updateAccount(type, id, patch) {
    const fields = [], values = [];
    if (patch.username !== undefined) { fields.push(`username = $${fields.length + 1}`); values.push(patch.username); }
    if (patch.displayName !== undefined) { fields.push(`display_name = $${fields.length + 1}`); values.push(patch.displayName); }
    if (patch.passwordHash !== undefined) { fields.push(`password_hash = $${fields.length + 1}`); values.push(patch.passwordHash); }
    if (!fields.length) return this.getAccount(type, id);
    values.push(id);
    const table = type === "admin" ? "classpanel_admins" : "classpanel_members";
    await this.pool.query(`UPDATE ${table} SET ${fields.join(", ")} WHERE id = $${values.length}`, values);
    return this.getAccount(type, id);
  }

  async deleteAccount(type, id) {
    const table = type === "admin" ? "classpanel_admins" : "classpanel_members";
    await this.pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
  }

  async updateLastLogin(type, id) {
    const table = type === "admin" ? "classpanel_admins" : "classpanel_members";
    await this.pool.query(`UPDATE ${table} SET last_login_at = now() WHERE id = $1`, [id]);
  }

  async getState() {
    const { rows } = await this.pool.query("SELECT payload, revision, updated_at FROM classpanel_state WHERE class_id = 1");
    if (!rows.length) return null;
    return { payload: rows[0].payload, revision: Number(rows[0].revision), updatedAt: rows[0].updated_at };
  }

  async saveState({ payload, className }) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      if (className) {
        await client.query("UPDATE classpanel_class SET name = $1, updated_at = now() WHERE id = 1 AND name <> $1", [className]);
      }
      const { rows } = await client.query(
        "UPDATE classpanel_state SET payload = $1::jsonb, revision = revision + 1, updated_at = now() WHERE class_id = 1 RETURNING revision, updated_at, payload",
        [JSON.stringify(payload)]
      );
      if (!rows.length) throw new Error("本机还没有班级数据");
      await client.query("COMMIT");
      return { revision: Number(rows[0].revision), updatedAt: rows[0].updated_at, payload: rows[0].payload };
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch (_) { /* ignore */ }
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    try { await this.pool.end(); } catch (_) { /* ignore */ }
  }
}

module.exports = { SupabaseStore };
