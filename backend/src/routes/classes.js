const express = require("express");
const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const { query, withTransaction, isDuplicateError } = require("../db");
const { signSession, authenticate, requireClassAccess, requireClassAdmin, requireClassAccount } = require("../auth");
const { asyncHandler, publicClass } = require("../http");
const { initialPayload, sanitizePayload, stateSummary } = require("../state");
const { buildGuestPayload } = require("../guest-permissions");
const {
  registerSchema,
  stateSchema,
  tokenCreateSchema,
  changePasswordSchema,
  accountCreateSchema,
  accountUpdateSchema,
  validateBody,
  charLength
} = require("../validation");

const router = express.Router();

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too_many_requests", message: "注册过于频繁，请稍后再试" }
});

function sessionForAdmin(admin, cls) {
  return {
    token: signSession({
      role: "class_admin",
      sub: Number(admin.id),
      classId: Number(cls.id),
      username: admin.username
    }),
    role: "class_admin",
    isMain: true,
    class: publicClass(cls),
    account: { username: admin.username, displayName: admin.display_name || admin.username }
  };
}

router.post(
  "/register",
  registerLimiter,
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const { className, adminUsername, adminPassword, adminDisplayName, registrationCode } = req.validated;
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const code = String(registrationCode || "").trim().toUpperCase();

    const memberDup = await query("SELECT id FROM class_members WHERE username = ? LIMIT 1", [adminUsername]);
    if (memberDup.length) {
      return res.status(409).json({ error: "admin_username_exists", message: "该管理员账号已被使用" });
    }

    let result;
    try {
      result = await withTransaction(async (conn) => {
        const [codeRows] = await conn.execute(
          `SELECT id, code, max_uses, used_count, expires_at, revoked
             FROM registration_codes WHERE code = ? FOR UPDATE`,
          [code]
        );
        const codeRow = codeRows[0];
        if (!codeRow) {
          const error = new Error("注册码无效，请向总管理员获取");
          error.registrationCodeInvalid = true;
          throw error;
        }
        if (codeRow.revoked) {
          const error = new Error("注册码已被撤销");
          error.registrationCodeInvalid = true;
          throw error;
        }
        if (codeRow.expires_at && new Date(codeRow.expires_at).getTime() <= Date.now()) {
          const error = new Error("注册码已过期");
          error.registrationCodeInvalid = true;
          throw error;
        }
        if (Number(codeRow.max_uses) > 0 && Number(codeRow.used_count) >= Number(codeRow.max_uses)) {
          const error = new Error("注册码次数已用完");
          error.registrationCodeInvalid = true;
          throw error;
        }
        const [classResult] = await conn.execute(
          "INSERT INTO classes (name, status) VALUES (?, 'active')",
          [className]
        );
        const classId = classResult.insertId;
        const [adminResult] = await conn.execute(
          "INSERT INTO class_admins (class_id, username, password_hash, display_name, is_main) VALUES (?, ?, ?, ?, 1)",
          [classId, adminUsername, passwordHash, adminDisplayName || adminUsername]
        );
        const payload = JSON.stringify(initialPayload(className));
        await conn.execute("INSERT INTO class_states (class_id, payload, revision) VALUES (?, CAST(? AS JSON), 1)", [
          classId,
          payload
        ]);
        await conn.execute(
          "UPDATE registration_codes SET used_count = used_count + 1, last_used_at = NOW() WHERE id = ?",
          [codeRow.id]
        );
        return {
          classRow: { id: classId, name: className, status: "active" },
          adminRow: {
            id: adminResult.insertId,
            username: adminUsername,
            display_name: adminDisplayName || adminUsername
          }
        };
      });
    } catch (error) {
      if (error && error.registrationCodeInvalid) {
        return res.status(400).json({ error: "invalid_registration_code", message: error.message });
      }
      if (isDuplicateError(error)) {
        const message = String(error.message || "");
        if (message.includes("uk_classes_name")) {
          return res.status(409).json({ error: "class_name_exists", message: "该班级名称已被注册" });
        }
        if (message.includes("uk_class_admins_username")) {
          return res.status(409).json({ error: "admin_username_exists", message: "该管理员账号已被使用" });
        }
        return res.status(409).json({ error: "duplicate", message: "班级或管理员账号已存在" });
      }
      throw error;
    }

    res.status(201).json(sessionForAdmin(result.adminRow, result.classRow));
  })
);

router.get(
  "/:classId/state",
  authenticate,
  requireClassAccess,
  asyncHandler(async (req, res) => {
    const rows = await query(
      "SELECT payload, revision, updated_at FROM class_states WHERE class_id = ? LIMIT 1",
      [req.params.classId]
    );
    if (!rows.length) return res.status(404).json({ error: "state_not_found", message: "班级数据不存在" });
    const row = rows[0];
    res.json({
      revision: Number(row.revision),
      updatedAt: row.updated_at,
      payload: sanitizePayload(row.payload)
    });
  })
);

router.get(
  "/:classId/summary",
  authenticate,
  requireClassAccess,
  asyncHandler(async (req, res) => {
    const rows = await query(
      `SELECT c.id, c.name, c.status, c.created_at, c.updated_at,
              s.payload, s.revision, s.updated_at AS state_updated_at,
              ca.username AS admin_username, ca.display_name AS admin_display_name
         FROM classes c
         LEFT JOIN class_states s ON s.class_id = c.id
         LEFT JOIN class_admins ca ON ca.class_id = c.id
        WHERE c.id = ? LIMIT 1`,
      [req.params.classId]
    );
    if (!rows.length) return res.status(404).json({ error: "class_not_found", message: "班级不存在" });
    const row = rows[0];
    res.json({
      class: {
        id: Number(row.id),
        name: row.name,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      },
      admin: { username: row.admin_username, displayName: row.admin_display_name },
      revision: Number(row.revision || 0),
      stateUpdatedAt: row.state_updated_at,
      summary: stateSummary(row.payload)
    });
  })
);

router.put(
  "/:classId/state",
  authenticate,
  requireClassAccess,
  asyncHandler(async (req, res) => {
    if (req.auth.role === "super_admin") {
      return res.status(403).json({ error: "forbidden", message: "总管理员不能修改班级业务数据" });
    }
    if (req.auth.role === "class_member" || req.auth.role === "class_display" || req.auth.role === "guest") {
      return res.status(403).json({ error: "forbidden", message: "当前账号只能查看，不能修改班级信息" });
    }
    const validation = stateSchema.safeParse(req.body || {});
    if (!validation.success) {
      const first = validation.error.issues[0];
      return res.status(400).json({ error: "validation_error", message: first ? first.message : "数据格式不正确" });
    }

    const incoming = validation.data.payload;
    const rows = await query(
      `SELECT c.name AS class_name, s.payload, s.revision
         FROM classes c
         LEFT JOIN class_states s ON s.class_id = c.id
        WHERE c.id = ? LIMIT 1`,
      [req.params.classId]
    );
    if (!rows.length) return res.status(404).json({ error: "class_not_found", message: "班级不存在" });
    const current = rows[0];
    const currentPayload = sanitizePayload(current.payload || {});

    let nextPayload;
    if (req.auth.role === "guest") {
      nextPayload = sanitizePayload(buildGuestPayload(currentPayload, incoming));
    } else {
      nextPayload = sanitizePayload(incoming);
    }

    // 班级名称以 classes 表为权威数据源；管理员修改时同步更新，非法或重名则回退
    let className = String(current.class_name || "");
    if (req.auth.role === "class_admin") {
      const wanted = String((nextPayload.settings && nextPayload.settings.className) || "").trim();
      if (wanted && charLength(wanted) <= 10 && wanted !== className) {
        try {
          await query("UPDATE classes SET name = ? WHERE id = ?", [wanted, req.params.classId]);
          className = wanted;
        } catch (error) {
          if (!isDuplicateError(error)) throw error;
        }
      }
    }
    if (!nextPayload.settings || typeof nextPayload.settings !== "object") nextPayload.settings = {};
    nextPayload.settings.className = className;

    const serialized = JSON.stringify(nextPayload);
    if (Buffer.byteLength(serialized, "utf8") > 8 * 1024 * 1024) {
      return res.status(413).json({ error: "payload_too_large", message: "班级数据超过 8MB，无法保存" });
    }

    await query(
      `INSERT INTO class_states (class_id, payload, revision)
       VALUES (?, CAST(? AS JSON), 1)
       ON DUPLICATE KEY UPDATE payload = VALUES(payload), revision = revision + 1`,
      [req.params.classId, serialized]
    );
    const updated = await query(
      "SELECT payload, revision, updated_at FROM class_states WHERE class_id = ? LIMIT 1",
      [req.params.classId]
    );
    const row = updated[0];
    res.json({
      revision: Number(row.revision),
      updatedAt: row.updated_at,
      payload: sanitizePayload(row.payload)
    });
  })
);

router.get(
  "/:classId/tokens",
  authenticate,
  requireClassAdmin,
  asyncHandler(async (req, res) => {
    const rows = await query(
      `SELECT id, token, label, expires_at, revoked, created_at, last_used_at
         FROM access_tokens WHERE class_id = ? ORDER BY created_at DESC, id DESC`,
      [req.params.classId]
    );
    const now = Date.now();
    res.json({
      tokens: rows.map((row) => ({
        id: Number(row.id),
        token: row.token,
        label: row.label || "",
        expiresAt: row.expires_at,
        permanent: !row.expires_at,
        revoked: !!row.revoked,
        expired: !!row.expires_at && new Date(row.expires_at).getTime() <= now,
        createdAt: row.created_at,
        lastUsedAt: row.last_used_at
      }))
    });
  })
);

router.post(
  "/:classId/tokens",
  authenticate,
  requireClassAdmin,
  validateBody(tokenCreateSchema),
  asyncHandler(async (req, res) => {
    const { label, expiresInDays } = req.validated;
    let days = null;
    if (expiresInDays !== null && expiresInDays !== undefined && String(expiresInDays) !== "" && Number(expiresInDays) !== 0) {
      days = Number(expiresInDays);
      if (!Number.isInteger(days) || days < 1 || days > 3650) {
        return res.status(400).json({ error: "validation_error", message: "有效期需为 1-3650 天，或选择永久" });
      }
    }
    const token = crypto.randomBytes(32).toString("base64url");
    const expiresAt = days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null;
    const result = await query(
      `INSERT INTO access_tokens (class_id, token, label, expires_at, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [req.params.classId, token, label || "", expiresAt, req.auth.adminId]
    );
    const rows = await query(
      "SELECT id, token, label, expires_at, revoked, created_at FROM access_tokens WHERE id = ?",
      [result.insertId]
    );
    const row = rows[0];
    res.status(201).json({
      token: {
        id: Number(row.id),
        token: row.token,
        label: row.label || "",
        expiresAt: row.expires_at,
        permanent: !row.expires_at,
        revoked: false,
        expired: false,
        createdAt: row.created_at,
        lastUsedAt: null
      }
    });
  })
);

router.delete(
  "/:classId/tokens/:tokenId",
  authenticate,
  requireClassAdmin,
  asyncHandler(async (req, res) => {
    const result = await query(
      "UPDATE access_tokens SET revoked = 1 WHERE id = ? AND class_id = ?",
      [req.params.tokenId, req.params.classId]
    );
    if (!result.affectedRows) return res.status(404).json({ error: "token_not_found", message: "令牌不存在" });
    res.status(204).end();
  })
);

function accountDto(row, type) {
  return {
    id: Number(row.id),
    type,
    username: row.username,
    displayName: row.display_name || row.username,
    isMain: type === "admin" ? !!row.is_main : false,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at
  };
}

async function loadClassAccount(classId, type, id) {
  const table = type === "admin" ? "class_admins" : "class_members";
  const mainColumn = type === "admin" ? "is_main" : "0 AS is_main";
  const rows = await query(
    `SELECT id, class_id, username, display_name, ${mainColumn}, created_at, last_login_at
       FROM ${table} WHERE id = ? AND class_id = ? LIMIT 1`,
    [id, classId]
  );
  return rows.length ? { ...rows[0], type } : null;
}

async function usernameTaken(username, excludeType, excludeId) {
  const admin = await query("SELECT id FROM class_admins WHERE username = ? LIMIT 1", [username]);
  if (admin.length && !(excludeType === "admin" && Number(admin[0].id) === Number(excludeId))) return true;
  const member = await query("SELECT id FROM class_members WHERE username = ? LIMIT 1", [username]);
  if (member.length && !(excludeType === "member" && Number(member[0].id) === Number(excludeId))) return true;
  return false;
}

router.get(
  "/:classId/accounts",
  authenticate,
  requireClassAdmin,
  asyncHandler(async (req, res) => {
    const admins = await query(
      "SELECT id, username, display_name, is_main, created_at, last_login_at FROM class_admins WHERE class_id = ? ORDER BY is_main DESC, id ASC",
      [req.params.classId]
    );
    const members = await query(
      "SELECT id, username, display_name, created_at, last_login_at FROM class_members WHERE class_id = ? ORDER BY id ASC",
      [req.params.classId]
    );
    const accounts = [
      ...admins.map((row) => accountDto(row, "admin")),
      ...members.map((row) => accountDto(row, "member"))
    ];
    res.json({ accounts });
  })
);

router.post(
  "/:classId/accounts",
  authenticate,
  requireClassAdmin,
  validateBody(accountCreateSchema),
  asyncHandler(async (req, res) => {
    const { role, username, password, displayName } = req.validated;
    if (await usernameTaken(username)) {
      return res.status(409).json({ error: "username_exists", message: "该账号已被使用" });
    }
    const hash = await bcrypt.hash(password, 10);
    if (role === "admin") {
      const result = await query(
        "INSERT INTO class_admins (class_id, username, password_hash, display_name, is_main) VALUES (?, ?, ?, ?, 0)",
        [req.params.classId, username, hash, displayName || username]
      );
      const rows = await query(
        "SELECT id, username, display_name, is_main, created_at, last_login_at FROM class_admins WHERE id = ?",
        [result.insertId]
      );
      return res.status(201).json({ account: accountDto(rows[0], "admin") });
    }
    const result = await query(
      "INSERT INTO class_members (class_id, username, password_hash, display_name, created_by) VALUES (?, ?, ?, ?, ?)",
      [req.params.classId, username, hash, displayName || username, req.auth.adminId]
    );
    const rows = await query(
      "SELECT id, username, display_name, created_at, last_login_at FROM class_members WHERE id = ?",
      [result.insertId]
    );
    return res.status(201).json({ account: accountDto(rows[0], "member") });
  })
);

router.patch(
  "/:classId/accounts/:type/:id",
  authenticate,
  requireClassAdmin,
  validateBody(accountUpdateSchema),
  asyncHandler(async (req, res) => {
    const type = req.params.type === "admin" ? "admin" : req.params.type === "member" ? "member" : "";
    if (!type) return res.status(400).json({ error: "invalid_type", message: "账号类型不正确" });
    const target = await loadClassAccount(req.params.classId, type, req.params.id);
    if (!target) return res.status(404).json({ error: "account_not_found", message: "账号不存在" });
    if (target.is_main && !req.auth.isMain) {
      return res.status(403).json({ error: "forbidden", message: "主账号信息只能由主账号修改" });
    }
    if (!req.auth.isMain && !(type === "admin" && Number(target.id) === Number(req.auth.adminId))) {
      return res.status(403).json({ error: "forbidden", message: "只有主账号可以修改其他账号信息" });
    }
    const { username, displayName, password } = req.validated;
    if (username && await usernameTaken(username, type, req.params.id)) {
      return res.status(409).json({ error: "username_exists", message: "该账号已被使用" });
    }
    const fields = [];
    const params = [];
    if (username !== undefined) { fields.push("username = ?"); params.push(username); }
    if (displayName !== undefined) { fields.push("display_name = ?"); params.push(displayName || username || target.username); }
    if (password !== undefined) { fields.push("password_hash = ?"); params.push(await bcrypt.hash(password, 10)); }
    if (!fields.length) return res.status(400).json({ error: "validation_error", message: "没有需要修改的字段" });
    params.push(req.params.id, req.params.classId);
    const table = type === "admin" ? "class_admins" : "class_members";
    await query(`UPDATE ${table} SET ${fields.join(", ")} WHERE id = ? AND class_id = ?`, params);
    const updated = await loadClassAccount(req.params.classId, type, req.params.id);
    res.json({ account: accountDto(updated, type) });
  })
);

router.delete(
  "/:classId/accounts/:type/:id",
  authenticate,
  requireClassAdmin,
  asyncHandler(async (req, res) => {
    const type = req.params.type === "admin" ? "admin" : req.params.type === "member" ? "member" : "";
    if (!type) return res.status(400).json({ error: "invalid_type", message: "账号类型不正确" });
    const target = await loadClassAccount(req.params.classId, type, req.params.id);
    if (!target) return res.status(404).json({ error: "account_not_found", message: "账号不存在" });
    if (target.is_main) return res.status(403).json({ error: "forbidden", message: "主账号不可删除" });
    if (type === "admin" && Number(target.id) === Number(req.auth.adminId)) {
      return res.status(400).json({ error: "cannot_delete_self", message: "不能删除当前登录账号" });
    }
    const table = type === "admin" ? "class_admins" : "class_members";
    await query(`DELETE FROM ${table} WHERE id = ? AND class_id = ?`, [req.params.id, req.params.classId]);
    res.status(204).end();
  })
);

router.post(
  "/:classId/password",
  authenticate,
  requireClassAccount,
  validateBody(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.validated;
    const isMember = req.auth.role === "class_member";
    const table = isMember ? "class_members" : "class_admins";
    const id = isMember ? req.auth.memberId : req.auth.adminId;
    const rows = await query(`SELECT password_hash FROM ${table} WHERE id = ? LIMIT 1`, [id]);
    if (!rows.length) return res.status(404).json({ error: "account_not_found", message: "账号不存在" });
    const ok = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!ok) return res.status(400).json({ error: "invalid_password", message: "当前密码不正确" });
    if (currentPassword === newPassword) {
      return res.status(400).json({ error: "same_password", message: "新密码不能与当前密码相同" });
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await query(`UPDATE ${table} SET password_hash = ? WHERE id = ?`, [hash, id]);
    res.json({ ok: true });
  })
);

module.exports = router;
