const express = require("express");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const { query } = require("../db");
const { signSession, authenticate } = require("../auth");
const { asyncHandler, publicClass } = require("../http");
const {
  classLoginSchema,
  superLoginSchema,
  guestLoginSchema,
  validateBody
} = require("../validation");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too_many_requests", message: "尝试次数过多，请稍后再试" }
});

router.post(
  "/class/login",
  loginLimiter,
  validateBody(classLoginSchema),
  asyncHandler(async (req, res) => {
    const { username, password } = req.validated;
    let rows = await query(
      `SELECT ca.id, ca.class_id, ca.username, ca.display_name, ca.is_main, ca.password_hash,
              c.name AS class_name, c.status
         FROM class_admins ca
         JOIN classes c ON c.id = ca.class_id
        WHERE ca.username = ? LIMIT 1`,
      [username]
    );
    let accountType = "admin";
    if (!rows.length) {
      rows = await query(
        `SELECT cm.id, cm.class_id, cm.username, cm.display_name, 0 AS is_main, cm.password_hash,
                c.name AS class_name, c.status
           FROM class_members cm
           JOIN classes c ON c.id = cm.class_id
          WHERE cm.username = ? LIMIT 1`,
        [username]
      );
      accountType = "member";
    }
    if (!rows.length) return res.status(401).json({ error: "invalid_credentials", message: "账号或密码不正确" });
    const row = rows[0];
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: "invalid_credentials", message: "账号或密码不正确" });
    if (row.status !== "active") return res.status(403).json({ error: "class_disabled", message: "该班级已被停用" });

    await query(
      accountType === "admin"
        ? "UPDATE class_admins SET last_login_at = NOW() WHERE id = ?"
        : "UPDATE class_members SET last_login_at = NOW() WHERE id = ?",
      [row.id]
    );
    const role = accountType === "admin" ? "class_admin" : "class_member";
    const token = signSession({
      role,
      sub: Number(row.id),
      classId: Number(row.class_id),
      username: row.username
    });

    res.json({
      token,
      role,
      isMain: accountType === "admin" ? !!row.is_main : false,
      expiresAt: null,
      class: publicClass({ id: row.class_id, name: row.class_name, status: row.status }),
      account: { username: row.username, displayName: row.display_name || row.username }
    });
  })
);

router.post(
  "/super/login",
  loginLimiter,
  validateBody(superLoginSchema),
  asyncHandler(async (req, res) => {
    const { username, password } = req.validated;
    const rows = await query(
      "SELECT id, username, display_name, password_hash, is_active FROM super_admins WHERE username = ? LIMIT 1",
      [username]
    );
    if (!rows.length) return res.status(401).json({ error: "invalid_credentials", message: "账号或密码不正确" });
    const row = rows[0];
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: "invalid_credentials", message: "账号或密码不正确" });
    if (!row.is_active) return res.status(403).json({ error: "account_disabled", message: "总管理员账号已停用" });

    await query("UPDATE super_admins SET last_login_at = NOW() WHERE id = ?", [row.id]);
    const token = signSession({
      role: "super_admin",
      sub: Number(row.id),
      username: row.username
    });

    res.json({
      token,
      role: "super_admin",
      expiresAt: null,
      class: null,
      account: { username: row.username, displayName: row.display_name || row.username }
    });
  })
);

router.post(
  ["/token", "/guest"],
  loginLimiter,
  validateBody(guestLoginSchema),
  asyncHandler(async (req, res) => {
    const { accessToken } = req.validated;
    const rows = await query(
      `SELECT t.id, t.class_id, t.label, t.expires_at, t.revoked,
              c.name AS class_name, c.status
         FROM access_tokens t
         JOIN classes c ON c.id = t.class_id
        WHERE t.token = ? LIMIT 1`,
      [accessToken]
    );
    if (!rows.length) return res.status(401).json({ error: "invalid_token", message: "令牌无效" });
    const row = rows[0];
    if (row.revoked) return res.status(401).json({ error: "token_revoked", message: "令牌已被撤销" });
    if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
      return res.status(401).json({ error: "token_expired", message: "令牌已过期" });
    }
    if (row.status !== "active") return res.status(403).json({ error: "class_disabled", message: "该班级已被停用" });

    let expiresIn = "12h";
    if (row.expires_at) {
      const seconds = Math.max(60, Math.floor((new Date(row.expires_at).getTime() - Date.now()) / 1000));
      expiresIn = Math.min(seconds, 12 * 60 * 60);
    }
    const token = signSession(
      {
        role: "class_display",
        sub: Number(row.id),
        classId: Number(row.class_id),
        tokenId: Number(row.id)
      },
      { expiresIn }
    );
    await query("UPDATE access_tokens SET last_used_at = NOW() WHERE id = ?", [row.id]);

    res.json({
      token,
      role: "class_display",
      class: publicClass({ id: row.class_id, name: row.class_name, status: row.status }),
      account: null,
      tokenInfo: {
        id: Number(row.id),
        label: row.label || "",
        expiresAt: row.expires_at
      }
    });
  })
);

router.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const auth = req.auth;
    res.json({
      role: auth.role,
      isMain: !!auth.isMain,
      class: auth.role === "super_admin" ? null : { id: auth.classId, name: auth.className },
      account:
        auth.role === "class_admin"
          ? { username: auth.username, displayName: auth.displayName || auth.username }
          : auth.role === "super_admin" || auth.role === "class_member"
            ? { username: auth.username, displayName: auth.displayName || auth.username }
            : null,
      tokenInfo:
        (auth.role === "class_display" || auth.role === "guest") ? { id: auth.tokenId, expiresAt: auth.expiresAt } : null
    });
  })
);

router.post("/logout", authenticate, (req, res) => {
  res.status(204).end();
});

module.exports = router;
