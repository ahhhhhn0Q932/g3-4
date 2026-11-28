const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { config } = require("../config");
const { db, getClass } = require("./db");
const { initialPayload, sanitizePayload } = require("../state");
const { validateBody, localRegisterSchema, classLoginSchema, changePasswordSchema, accountCreateSchema, accountUpdateSchema, stateSchema, charLength } = require("../validation");

const router = express.Router();
const now = () => new Date().toISOString();

function sign(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

function publicClass(cls) {
  return cls ? { id: 1, name: cls.name, status: cls.status } : null;
}

function transaction(fn) {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch (_) { /* ignore */ }
    throw error;
  }
}

function auth(req, res, next) {
  const header = String(req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return res.status(401).json({ error: "unauthorized", message: "请先登录" });
  let payload;
  try { payload = jwt.verify(token, config.jwtSecret); }
  catch (e) { return res.status(401).json({ error: "unauthorized", message: "登录已过期，请重新登录" }); }
  const cls = getClass();
  if (!cls || cls.status !== "active") return res.status(403).json({ error: "class_disabled", message: "本机班级不可用" });
  if (payload.role === "class_admin") {
    const row = db.prepare("SELECT id, username, display_name, is_main FROM class_admins WHERE id = ? AND class_id = 1").get(payload.sub);
    if (!row) return res.status(401).json({ error: "unauthorized", message: "账号不存在" });
    req.auth = { role: "class_admin", adminId: row.id, username: row.username, displayName: row.display_name, classId: 1, className: cls.name, isMain: !!row.is_main };
    return next();
  }
  if (payload.role === "class_member") {
    const row = db.prepare("SELECT id, username, display_name FROM class_members WHERE id = ? AND class_id = 1").get(payload.sub);
    if (!row) return res.status(401).json({ error: "unauthorized", message: "账号不存在" });
    req.auth = { role: "class_member", memberId: row.id, username: row.username, displayName: row.display_name, classId: 1, className: cls.name, isMain: false };
    return next();
  }
  return res.status(401).json({ error: "unauthorized", message: "未知身份" });
}

function adminOnly(req, res, next) {
  if (!req.auth || req.auth.role !== "class_admin") return res.status(403).json({ error: "forbidden", message: "仅班级管理员可操作" });
  next();
}

function classAccess(req, res, next) {
  if (!req.auth || Number(req.params.classId) !== 1) return res.status(403).json({ error: "forbidden", message: "本机只有一个班级" });
  next();
}

function accountDto(row, type) {
  return {
    id: Number(row.id), type, username: row.username,
    displayName: row.display_name || row.username,
    isMain: type === "admin" ? !!row.is_main : false,
    createdAt: row.created_at, lastLoginAt: row.last_login_at
  };
}

function loadAccount(type, id) {
  if (type === "admin") return db.prepare("SELECT * FROM class_admins WHERE id = ? AND class_id = 1").get(id) || null;
  if (type === "member") return db.prepare("SELECT * FROM class_members WHERE id = ? AND class_id = 1").get(id) || null;
  return null;
}

function usernameTaken(username, excludeType, excludeId) {
  const a = db.prepare("SELECT id FROM class_admins WHERE username = ?").get(username);
  if (a && !(excludeType === "admin" && Number(a.id) === Number(excludeId))) return true;
  const m = db.prepare("SELECT id FROM class_members WHERE username = ?").get(username);
  if (m && !(excludeType === "member" && Number(m.id) === Number(excludeId))) return true;
  return false;
}

function sessionFor(row, role, cls) {
  return {
    token: sign({ role, sub: Number(row.id), classId: 1, username: row.username }),
    role,
    isMain: role === "class_admin" ? !!row.is_main : false,
    expiresAt: null,
    class: publicClass(cls),
    account: { username: row.username, displayName: row.display_name || row.username }
  };
}

router.post("/auth/class/login", validateBody(classLoginSchema), async (req, res, next) => {
  try {
    const { username, password } = req.validated;
    let row = db.prepare("SELECT * FROM class_admins WHERE username = ? LIMIT 1").get(username);
    let role = "class_admin";
    if (!row) {
      row = db.prepare("SELECT * FROM class_members WHERE username = ? LIMIT 1").get(username);
      role = "class_member";
    }
    if (!row) return res.status(401).json({ error: "invalid_credentials", message: "账号或密码不正确" });
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: "invalid_credentials", message: "账号或密码不正确" });
    const cls = getClass();
    if (!cls) return res.status(404).json({ error: "class_not_found", message: "本机还没有班级" });
    if (cls.status !== "active") return res.status(403).json({ error: "class_disabled", message: "本机班级已停用" });
    const ts = now();
    if (role === "class_admin") db.prepare("UPDATE class_admins SET last_login_at = ? WHERE id = ?").run(ts, row.id);
    else db.prepare("UPDATE class_members SET last_login_at = ? WHERE id = ?").run(ts, row.id);
    res.json(sessionFor(row, role, cls));
  } catch (error) { next(error); }
});

router.get("/auth/me", auth, (req, res) => {
  res.json({
    role: req.auth.role, isMain: !!req.auth.isMain,
    class: { id: 1, name: req.auth.className },
    account: { username: req.auth.username, displayName: req.auth.displayName || req.auth.username },
    tokenInfo: null
  });
});

router.post("/classes/register", validateBody(localRegisterSchema), async (req, res, next) => {
  try {
    if (getClass()) return res.status(409).json({ error: "local_class_exists", message: "本机已经创建过班级，不能再创建第二个" });
    const { className, adminUsername, adminPassword, adminDisplayName } = req.validated;
    if (usernameTaken(adminUsername)) return res.status(409).json({ error: "username_exists", message: "该账号已被使用" });
    const hash = await bcrypt.hash(adminPassword, 10);
    const ts = now();
    const result = transaction(() => {
      db.prepare("INSERT INTO classes (id, name, status, created_at, updated_at) VALUES (1, ?, 'active', ?, ?)").run(className, ts, ts);
      const admin = db.prepare("INSERT INTO class_admins (class_id, username, password_hash, display_name, is_main, created_at) VALUES (1, ?, ?, ?, 1, ?)").run(adminUsername, hash, adminDisplayName || adminUsername, ts);
      const payload = JSON.stringify(initialPayload(className));
      db.prepare("INSERT INTO class_state (class_id, payload, revision, updated_at) VALUES (1, ?, 1, ?)").run(payload, ts);
      return { id: Number(admin.lastInsertRowid), username: adminUsername, display_name: adminDisplayName || adminUsername, is_main: 1 };
    });
    res.status(201).json(sessionFor(result, "class_admin", getClass()));
  } catch (error) { next(error); }
});

router.get("/classes/:classId/state", auth, classAccess, (req, res) => {
  const row = db.prepare("SELECT payload, revision, updated_at FROM class_state WHERE class_id = 1").get();
  if (!row) return res.status(404).json({ error: "state_not_found", message: "班级数据不存在" });
  res.json({ revision: Number(row.revision), updatedAt: row.updated_at, payload: sanitizePayload(JSON.parse(row.payload)) });
});

router.put("/classes/:classId/state", auth, classAccess, (req, res, next) => {
  try {
    if (req.auth.role === "class_member") return res.status(403).json({ error: "forbidden", message: "普通账号只能查看，不能修改班级信息" });
    const validation = stateSchema.safeParse(req.body || {});
    if (!validation.success) return res.status(400).json({ error: "validation_error", message: validation.error.issues[0]?.message || "数据格式不正确" });
    const payload = sanitizePayload(validation.data.payload);
    const cls = getClass();
    if (!cls) return res.status(404).json({ error: "class_not_found", message: "本机还没有班级" });
    let className = cls.name;
    if (payload.settings && typeof payload.settings.className === "string") {
      const wanted = payload.settings.className.trim();
      if (wanted && charLength(wanted) <= 10) {
        className = wanted;
        if (wanted !== cls.name) db.prepare("UPDATE classes SET name = ?, updated_at = ? WHERE id = 1").run(className, now());
      }
    }
    if (!payload.settings || typeof payload.settings !== "object") payload.settings = {};
    payload.settings.className = className;
    const current = db.prepare("SELECT revision FROM class_state WHERE class_id = 1").get();
    const revision = Number(current ? current.revision : 0) + 1;
    db.prepare("UPDATE class_state SET payload = ?, revision = ?, updated_at = ? WHERE class_id = 1").run(JSON.stringify(payload), revision, now());
    res.json({ revision, updatedAt: now(), payload });
  } catch (error) { next(error); }
});

router.get("/classes/:classId/accounts", auth, classAccess, adminOnly, (req, res) => {
  const admins = db.prepare("SELECT * FROM class_admins WHERE class_id = 1 ORDER BY is_main DESC, id ASC").all();
  const members = db.prepare("SELECT * FROM class_members WHERE class_id = 1 ORDER BY id ASC").all();
  res.json({ accounts: [...admins.map((r) => accountDto(r, "admin")), ...members.map((r) => accountDto(r, "member"))] });
});

router.post("/classes/:classId/accounts", auth, classAccess, adminOnly, validateBody(accountCreateSchema), async (req, res, next) => {
  try {
    const { role, username, password, displayName } = req.validated;
    if (usernameTaken(username)) return res.status(409).json({ error: "username_exists", message: "该账号已被使用" });
    const hash = await bcrypt.hash(password, 10);
    const ts = now();
    let row;
    if (role === "admin") {
      const result = db.prepare("INSERT INTO class_admins (class_id, username, password_hash, display_name, is_main, created_at) VALUES (1, ?, ?, ?, 0, ?)").run(username, hash, displayName || username, ts);
      row = loadAccount("admin", Number(result.lastInsertRowid));
      return res.status(201).json({ account: accountDto(row, "admin") });
    }
    const result = db.prepare("INSERT INTO class_members (class_id, username, password_hash, display_name, created_by, created_at) VALUES (1, ?, ?, ?, ?, ?)").run(username, hash, displayName || username, req.auth.adminId, ts);
    row = loadAccount("member", Number(result.lastInsertRowid));
    res.status(201).json({ account: accountDto(row, "member") });
  } catch (error) { next(error); }
});

router.patch("/classes/:classId/accounts/:type/:id", auth, classAccess, adminOnly, validateBody(accountUpdateSchema), async (req, res, next) => {
  try {
    const type = req.params.type === "admin" || req.params.type === "member" ? req.params.type : "";
    if (!type) return res.status(400).json({ error: "invalid_type", message: "账号类型不正确" });
    const target = loadAccount(type, req.params.id);
    if (!target) return res.status(404).json({ error: "account_not_found", message: "账号不存在" });
    if (type === "admin" && target.is_main && !req.auth.isMain) return res.status(403).json({ error: "forbidden", message: "主账号信息只能由主账号修改" });
    if (!req.auth.isMain && !(type === "admin" && Number(target.id) === Number(req.auth.adminId))) return res.status(403).json({ error: "forbidden", message: "只有主账号可以修改其他账号信息" });
    const { username, displayName, password } = req.validated;
    if (username && usernameTaken(username, type, req.params.id)) return res.status(409).json({ error: "username_exists", message: "该账号已被使用" });
    const fields = [], params = [];
    if (username !== undefined) { fields.push("username = ?"); params.push(username); }
    if (displayName !== undefined) { fields.push("display_name = ?"); params.push(displayName || username || target.username); }
    if (password !== undefined) { fields.push("password_hash = ?"); params.push(await bcrypt.hash(password, 10)); }
    if (!fields.length) return res.status(400).json({ error: "validation_error", message: "没有需要修改的字段" });
    params.push(req.params.id);
    db.prepare(`UPDATE ${type === "admin" ? "class_admins" : "class_members"} SET ${fields.join(", ")} WHERE id = ?`).run(...params);
    res.json({ account: accountDto(loadAccount(type, req.params.id), type) });
  } catch (error) { next(error); }
});

router.delete("/classes/:classId/accounts/:type/:id", auth, classAccess, adminOnly, (req, res) => {
  const type = req.params.type === "admin" || req.params.type === "member" ? req.params.type : "";
  if (!type) return res.status(400).json({ error: "invalid_type", message: "账号类型不正确" });
  const target = loadAccount(type, req.params.id);
  if (!target) return res.status(404).json({ error: "account_not_found", message: "账号不存在" });
  if (type === "admin" && target.is_main) return res.status(403).json({ error: "forbidden", message: "主账号不可删除" });
  if (type === "admin" && Number(target.id) === Number(req.auth.adminId)) return res.status(400).json({ error: "cannot_delete_self", message: "不能删除当前登录账号" });
  db.prepare(`DELETE FROM ${type === "admin" ? "class_admins" : "class_members"} WHERE id = ?`).run(req.params.id);
  res.status(204).end();
});

router.post("/classes/:classId/password", auth, classAccess, validateBody(changePasswordSchema), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.validated;
    const isMember = req.auth.role === "class_member";
    const table = isMember ? "class_members" : "class_admins";
    const id = isMember ? req.auth.memberId : req.auth.adminId;
    const row = db.prepare(`SELECT password_hash FROM ${table} WHERE id = ?`).get(id);
    if (!row) return res.status(404).json({ error: "account_not_found", message: "账号不存在" });
    const ok = await bcrypt.compare(currentPassword, row.password_hash);
    if (!ok) return res.status(400).json({ error: "invalid_password", message: "当前密码不正确" });
    if (currentPassword === newPassword) return res.status(400).json({ error: "same_password", message: "新密码不能与当前密码相同" });
    db.prepare(`UPDATE ${table} SET password_hash = ? WHERE id = ?`).run(await bcrypt.hash(newPassword, 10), id);
    res.json({ ok: true });
  } catch (error) { next(error); }
});

module.exports = { router, getClass };
