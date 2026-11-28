const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { config } = require("../config");
const { getStore, getLocalStatus, configureStorage } = require("./store");
const { initialPayload, sanitizePayload } = require("../state");
const {
  validateBody,
  localStorageSetupSchema,
  localRegisterSchema,
  classLoginSchema,
  changePasswordSchema,
  accountCreateSchema,
  accountUpdateSchema,
  stateSchema,
  charLength
} = require("../validation");

const router = express.Router();

function sign(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

function publicClass(cls) {
  return cls ? { id: 1, name: cls.name, status: cls.status } : null;
}

function accountDto(row, type) {
  return {
    id: Number(row.id), type, username: row.username,
    displayName: row.display_name || row.username,
    isMain: type === "admin" ? !!row.is_main : false,
    createdAt: row.created_at, lastLoginAt: row.last_login_at
  };
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

async function loadStore(res) {
  try {
    const store = await getStore();
    if (!store) {
      res.status(409).json({ error: "storage_not_configured", message: "请先选择 Supabase 或本地 SQLite 存储方式" });
      return null;
    }
    return store;
  } catch (error) {
    res.status(503).json({ error: "storage_unavailable", message: "数据库连接失败：" + String((error && error.message) || error) });
    return null;
  }
}

async function auth(req, res, next) {
  try {
    const header = String(req.headers.authorization || "");
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!token) return res.status(401).json({ error: "unauthorized", message: "请先登录" });
    let payload;
    try { payload = jwt.verify(token, config.jwtSecret); }
    catch (e) { return res.status(401).json({ error: "unauthorized", message: "登录已过期，请重新登录" }); }
    const store = await loadStore(res);
    if (!store) return null;
    const cls = await store.getClass();
    if (!cls || cls.status !== "active") return res.status(403).json({ error: "class_disabled", message: "本机班级不可用" });
    if (payload.role === "class_admin") {
      const row = await store.getAccount("admin", payload.sub);
      if (!row) return res.status(401).json({ error: "unauthorized", message: "账号不存在" });
      req.auth = { role: "class_admin", adminId: row.id, username: row.username, displayName: row.display_name, classId: 1, className: cls.name, isMain: !!row.is_main };
      req.store = store;
      return next();
    }
    if (payload.role === "class_member") {
      const row = await store.getAccount("member", payload.sub);
      if (!row) return res.status(401).json({ error: "unauthorized", message: "账号不存在" });
      req.auth = { role: "class_member", memberId: row.id, username: row.username, displayName: row.display_name, classId: 1, className: cls.name, isMain: false };
      req.store = store;
      return next();
    }
    return res.status(401).json({ error: "unauthorized", message: "未知身份" });
  } catch (error) {
    next(error);
  }
}

function adminOnly(req, res, next) {
  if (!req.auth || req.auth.role !== "class_admin") return res.status(403).json({ error: "forbidden", message: "仅班级管理员可操作" });
  next();
}

function classAccess(req, res, next) {
  if (!req.auth || Number(req.params.classId) !== 1) return res.status(403).json({ error: "forbidden", message: "本机只有一个班级" });
  next();
}

router.post("/local/storage", validateBody(localStorageSetupSchema), async (req, res, next) => {
  try {
    const result = await configureStorage(req.validated);
    res.status(201).json({ ok: true, storage: result.storage, locked: true });
  } catch (error) {
    if (error.code === "STORAGE_LOCKED") {
      return res.status(409).json({ error: "storage_locked", message: "存储方式已经锁定，不能再次更改" });
    }
    return res.status(400).json({ error: "storage_connection_failed", message: "连接失败：" + String((error && error.message) || error) });
  }
});

router.post("/auth/class/login", validateBody(classLoginSchema), async (req, res, next) => {
  try {
    const store = await loadStore(res);
    if (!store) return null;
    const { username, password } = req.validated;
    const found = await store.findAccountByUsername(username);
    if (!found) return res.status(401).json({ error: "invalid_credentials", message: "账号或密码不正确" });
    const { role, row } = found;
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: "invalid_credentials", message: "账号或密码不正确" });
    const cls = await store.getClass();
    if (!cls) return res.status(404).json({ error: "class_not_found", message: "本机还没有班级" });
    if (cls.status !== "active") return res.status(403).json({ error: "class_disabled", message: "本机班级已停用" });
    await store.updateLastLogin(role === "class_admin" ? "admin" : "member", row.id);
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
    const store = await loadStore(res);
    if (!store) return null;
    if (await store.getClass()) return res.status(409).json({ error: "local_class_exists", message: "本机已经创建过班级，不能再创建第二个" });
    const { className, adminUsername, adminPassword, adminDisplayName } = req.validated;
    if (await store.usernameTaken(adminUsername)) return res.status(409).json({ error: "username_exists", message: "该账号已被使用" });
    const hash = await bcrypt.hash(adminPassword, 10);
    let admin;
    try {
      admin = await store.createClass({
        className,
        username: adminUsername,
        passwordHash: hash,
        displayName: adminDisplayName || adminUsername,
        initialState: initialPayload(className)
      });
    } catch (error) {
      if (error.code === "CLASS_EXISTS" || error.code === "23505") {
        return res.status(409).json({ error: "local_class_exists", message: "本机已经创建过班级，不能再创建第二个" });
      }
      throw error;
    }
    res.status(201).json(sessionFor(admin, "class_admin", await store.getClass()));
  } catch (error) { next(error); }
});

router.get("/classes/:classId/state", auth, classAccess, async (req, res, next) => {
  try {
    const state = await req.store.getState();
    if (!state) return res.status(404).json({ error: "state_not_found", message: "班级数据不存在" });
    res.json({ revision: Number(state.revision), updatedAt: state.updatedAt, payload: sanitizePayload(state.payload) });
  } catch (error) { next(error); }
});

router.put("/classes/:classId/state", auth, classAccess, async (req, res, next) => {
  try {
    if (req.auth.role === "class_member") return res.status(403).json({ error: "forbidden", message: "普通账号只能查看，不能修改班级信息" });
    const validation = stateSchema.safeParse(req.body || {});
    if (!validation.success) return res.status(400).json({ error: "validation_error", message: validation.error.issues[0]?.message || "数据格式不正确" });
    const payload = sanitizePayload(validation.data.payload);
    const cls = await req.store.getClass();
    if (!cls) return res.status(404).json({ error: "class_not_found", message: "本机还没有班级" });
    let className = cls.name;
    if (payload.settings && typeof payload.settings.className === "string") {
      const wanted = payload.settings.className.trim();
      if (wanted && charLength(wanted) <= 10) className = wanted;
    }
    if (!payload.settings || typeof payload.settings !== "object") payload.settings = {};
    payload.settings.className = className;
    const saved = await req.store.saveState({ payload, className });
    res.json({ revision: Number(saved.revision), updatedAt: saved.updatedAt, payload: saved.payload });
  } catch (error) { next(error); }
});

router.get("/classes/:classId/accounts", auth, classAccess, adminOnly, async (req, res, next) => {
  try {
    const accounts = await req.store.listAccounts();
    res.json({ accounts: [...accounts.admins.map((r) => accountDto(r, "admin")), ...accounts.members.map((r) => accountDto(r, "member"))] });
  } catch (error) { next(error); }
});

router.post("/classes/:classId/accounts", auth, classAccess, adminOnly, validateBody(accountCreateSchema), async (req, res, next) => {
  try {
    const { role, username, password, displayName } = req.validated;
    if (await req.store.usernameTaken(username)) return res.status(409).json({ error: "username_exists", message: "该账号已被使用" });
    const hash = await bcrypt.hash(password, 10);
    const row = await req.store.createAccount({
      role,
      username,
      passwordHash: hash,
      displayName: displayName || username,
      createdBy: req.auth.adminId
    });
    res.status(201).json({ account: accountDto(row, role) });
  } catch (error) { next(error); }
});

router.patch("/classes/:classId/accounts/:type/:id", auth, classAccess, adminOnly, validateBody(accountUpdateSchema), async (req, res, next) => {
  try {
    const type = req.params.type === "admin" || req.params.type === "member" ? req.params.type : "";
    if (!type) return res.status(400).json({ error: "invalid_type", message: "账号类型不正确" });
    const target = await req.store.getAccount(type, req.params.id);
    if (!target) return res.status(404).json({ error: "account_not_found", message: "账号不存在" });
    if (type === "admin" && target.is_main && !req.auth.isMain) return res.status(403).json({ error: "forbidden", message: "主账号信息只能由主账号修改" });
    if (!req.auth.isMain && !(type === "admin" && Number(target.id) === Number(req.auth.adminId))) return res.status(403).json({ error: "forbidden", message: "只有主账号可以修改其他账号信息" });
    const { username, displayName, password } = req.validated;
    if (username && await req.store.usernameTaken(username, type, req.params.id)) return res.status(409).json({ error: "username_exists", message: "该账号已被使用" });
    const patch = {};
    if (username !== undefined) patch.username = username;
    if (displayName !== undefined) patch.displayName = displayName || username || target.username;
    if (password !== undefined) patch.passwordHash = await bcrypt.hash(password, 10);
    if (!Object.keys(patch).length) return res.status(400).json({ error: "validation_error", message: "没有需要修改的字段" });
    const updated = await req.store.updateAccount(type, req.params.id, patch);
    res.json({ account: accountDto(updated, type) });
  } catch (error) { next(error); }
});

router.delete("/classes/:classId/accounts/:type/:id", auth, classAccess, adminOnly, async (req, res, next) => {
  try {
    const type = req.params.type === "admin" || req.params.type === "member" ? req.params.type : "";
    if (!type) return res.status(400).json({ error: "invalid_type", message: "账号类型不正确" });
    const target = await req.store.getAccount(type, req.params.id);
    if (!target) return res.status(404).json({ error: "account_not_found", message: "账号不存在" });
    if (type === "admin" && target.is_main) return res.status(403).json({ error: "forbidden", message: "主账号不可删除" });
    if (type === "admin" && Number(target.id) === Number(req.auth.adminId)) return res.status(400).json({ error: "cannot_delete_self", message: "不能删除当前登录账号" });
    await req.store.deleteAccount(type, req.params.id);
    res.status(204).end();
  } catch (error) { next(error); }
});

router.post("/classes/:classId/password", auth, classAccess, validateBody(changePasswordSchema), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.validated;
    const isMember = req.auth.role === "class_member";
    const type = isMember ? "member" : "admin";
    const id = isMember ? req.auth.memberId : req.auth.adminId;
    const row = await req.store.getAccount(type, id);
    if (!row) return res.status(404).json({ error: "account_not_found", message: "账号不存在" });
    const ok = await bcrypt.compare(currentPassword, row.password_hash);
    if (!ok) return res.status(400).json({ error: "invalid_password", message: "当前密码不正确" });
    if (currentPassword === newPassword) return res.status(400).json({ error: "same_password", message: "新密码不能与当前密码相同" });
    await req.store.updateAccount(type, id, { passwordHash: await bcrypt.hash(newPassword, 10) });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

module.exports = { router, getLocalStatus, getStore };
