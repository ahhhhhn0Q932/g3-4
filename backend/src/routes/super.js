const express = require("express");
const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const { query, withTransaction, isDuplicateError } = require("../db");
const { authenticate, requireRole } = require("../auth");
const { asyncHandler } = require("../http");
const { stateSummary, sanitizePayload } = require("../state");
const { superClassUpdateSchema, resetPasswordSchema, registrationCodeCreateSchema, validateBody } = require("../validation");

const router = express.Router();

router.use(authenticate, requireRole("super_admin"));

router.get(
  "/overview",
  asyncHandler(async (req, res) => {
    const rows = await query(
      `SELECT
         (SELECT COUNT(*) FROM classes) AS classes_total,
         (SELECT COUNT(*) FROM classes WHERE status = 'active') AS classes_active,
         (SELECT COUNT(*) FROM classes WHERE status = 'disabled') AS classes_disabled,
         (SELECT COUNT(*) FROM class_admins) AS admins_total,
         (SELECT COUNT(*) FROM class_members) AS members_total,
         (SELECT COUNT(*) FROM access_tokens
           WHERE revoked = 0 AND (expires_at IS NULL OR expires_at > NOW())) AS tokens_active,
         (SELECT COUNT(*) FROM registration_codes
           WHERE revoked = 0 AND (expires_at IS NULL OR expires_at > NOW())
             AND (max_uses = 0 OR used_count < max_uses)) AS registration_codes_active`
    );
    res.json({ stats: rows[0] });
  })
);

router.get(
  "/classes",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || "").trim();
    const params = [];
    let where = "";
    if (q) {
      where = "WHERE c.name LIKE ? OR ca.username LIKE ? OR ca.display_name LIKE ?";
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    const rows = await query(
      `SELECT c.id, c.name, c.status, c.created_at, c.updated_at,
              ca.username AS admin_username, ca.display_name AS admin_display_name,
              COALESCE(s.revision, 0) AS revision, s.updated_at AS state_updated_at,
              COALESCE(JSON_LENGTH(s.payload->'$.homeworks'), 0) AS homeworks_count,
              COALESCE(JSON_LENGTH(s.payload->'$.birthdays'), 0) AS students_count,
              COALESCE(JSON_LENGTH(s.payload->'$.leaves'), 0) AS leaves_count,
              COALESCE(JSON_LENGTH(s.payload->'$.messages'), 0) AS messages_count,
              (SELECT COUNT(*) FROM access_tokens t
                WHERE t.class_id = c.id AND t.revoked = 0
                  AND (t.expires_at IS NULL OR t.expires_at > NOW())) AS active_tokens
         FROM classes c
         LEFT JOIN class_admins ca ON ca.class_id = c.id AND ca.is_main = 1
         LEFT JOIN class_states s ON s.class_id = c.id
         ${where}
         ORDER BY c.created_at DESC, c.id DESC
         LIMIT 500`,
      params
    );
    res.json({ classes: rows });
  })
);

function codeStatus(row) {
  const now = Date.now();
  if (row.revoked) return "revoked";
  if (row.expires_at && new Date(row.expires_at).getTime() <= now) return "expired";
  if (Number(row.max_uses) > 0 && Number(row.used_count) >= Number(row.max_uses)) return "used_up";
  return "active";
}

router.get(
  "/registration-codes",
  asyncHandler(async (req, res) => {
    const rows = await query(
      `SELECT rc.id, rc.code, rc.note, rc.max_uses, rc.used_count, rc.expires_at,
              rc.revoked, rc.created_at, rc.last_used_at, sa.username AS created_by_username
         FROM registration_codes rc
         LEFT JOIN super_admins sa ON sa.id = rc.created_by
        ORDER BY rc.created_at DESC, rc.id DESC
        LIMIT 300`
    );
    res.json({
      codes: rows.map((row) => ({
        id: Number(row.id),
        code: row.code,
        note: row.note || "",
        maxUses: Number(row.max_uses),
        usedCount: Number(row.used_count),
        remaining: Number(row.max_uses) === 0 ? null : Math.max(0, Number(row.max_uses) - Number(row.used_count)),
        expiresAt: row.expires_at,
        permanent: !row.expires_at,
        revoked: !!row.revoked,
        status: codeStatus(row),
        createdAt: row.created_at,
        lastUsedAt: row.last_used_at,
        createdBy: row.created_by_username || ""
      }))
    });
  })
);

router.post(
  "/registration-codes",
  validateBody(registrationCodeCreateSchema),
  asyncHandler(async (req, res) => {
    const { note } = req.validated;
    const maxUses = Number(req.validated.maxUses);
    if (!Number.isInteger(maxUses) || maxUses < 0 || maxUses > 1000) {
      return res.status(400).json({ error: "validation_error", message: "可用次数需为 0-1000，0 表示不限次数" });
    }
    const raw = req.validated.expiresInDays;
    let days = null;
    if (raw !== null && raw !== undefined && String(raw) !== "" && Number(raw) !== 0) {
      days = Number(raw);
      if (!Number.isInteger(days) || days < 1 || days > 3650) {
        return res.status(400).json({ error: "validation_error", message: "有效期需为 1-3650 天，或选择永久" });
      }
    }
    const expiresAt = days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null;
    const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let inserted = null;
    for (let attempt = 0; attempt < 8 && !inserted; attempt += 1) {
      let code = "";
      const bytes = crypto.randomBytes(16);
      for (let i = 0; i < 16; i += 1) code += alphabet[bytes[i] % alphabet.length];
      try {
        const result = await query(
          `INSERT INTO registration_codes (code, note, max_uses, expires_at, created_by)
           VALUES (?, ?, ?, ?, ?)`,
          [code, note || "", maxUses, expiresAt, req.auth.superId]
        );
        inserted = { id: result.insertId, code };
      } catch (error) {
        if (!isDuplicateError(error)) throw error;
      }
    }
    if (!inserted) return res.status(500).json({ error: "code_generation_failed", message: "注册码生成失败，请重试" });
    const rows = await query(
      `SELECT rc.id, rc.code, rc.note, rc.max_uses, rc.used_count, rc.expires_at,
              rc.revoked, rc.created_at, rc.last_used_at, sa.username AS created_by_username
         FROM registration_codes rc
         LEFT JOIN super_admins sa ON sa.id = rc.created_by
        WHERE rc.id = ? LIMIT 1`,
      [inserted.id]
    );
    const row = rows[0];
    res.status(201).json({
      code: {
        id: Number(row.id),
        code: row.code,
        note: row.note || "",
        maxUses: Number(row.max_uses),
        usedCount: Number(row.used_count),
        remaining: Number(row.max_uses) === 0 ? null : Math.max(0, Number(row.max_uses) - Number(row.used_count)),
        expiresAt: row.expires_at,
        permanent: !row.expires_at,
        revoked: false,
        status: "active",
        createdAt: row.created_at,
        lastUsedAt: row.last_used_at,
        createdBy: row.created_by_username || ""
      }
    });
  })
);

router.delete(
  "/registration-codes/:codeId",
  asyncHandler(async (req, res) => {
    const result = await query(
      "UPDATE registration_codes SET revoked = 1 WHERE id = ?",
      [req.params.codeId]
    );
    if (!result.affectedRows) return res.status(404).json({ error: "code_not_found", message: "注册码不存在" });
    res.status(204).end();
  })
);

router.get(
  "/classes/:classId",
  asyncHandler(async (req, res) => {
    const rows = await query(
      `SELECT c.id, c.name, c.status, c.created_at, c.updated_at,
              ca.id AS admin_id, ca.username AS admin_username,
              ca.display_name AS admin_display_name, ca.created_at AS admin_created_at,
              ca.last_login_at AS admin_last_login_at,
              s.payload, s.revision, s.updated_at AS state_updated_at
         FROM classes c
         LEFT JOIN class_admins ca ON ca.class_id = c.id AND ca.is_main = 1
         LEFT JOIN class_states s ON s.class_id = c.id
        WHERE c.id = ? LIMIT 1`,
      [req.params.classId]
    );
    if (!rows.length) return res.status(404).json({ error: "class_not_found", message: "班级不存在" });
    const row = rows[0];
    const tokens = await query(
      `SELECT id, label, expires_at, revoked, created_at, last_used_at
         FROM access_tokens WHERE class_id = ? ORDER BY created_at DESC, id DESC LIMIT 100`,
      [req.params.classId]
    );
    const payload = sanitizePayload(row.payload || {});
    const settings = payload.settings || {};
    res.json({
      class: {
        id: Number(row.id),
        name: row.name,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      },
      admin: row.admin_id
        ? {
            id: Number(row.admin_id),
            username: row.admin_username,
            displayName: row.admin_display_name,
            createdAt: row.admin_created_at,
            lastLoginAt: row.admin_last_login_at
          }
        : null,
      revision: Number(row.revision || 0),
      stateUpdatedAt: row.state_updated_at,
      summary: stateSummary(payload),
      settings: {
        className: settings.className || row.name,
        examDate: settings.examDate || "",
        classSize: settings.classSize || 0,
        homeSubjects: settings.homeSubjects || [],
        guestPerms: settings.guestPerms || {}
      },
      tokens: tokens.map((token) => ({
        id: Number(token.id),
        label: token.label || "",
        expiresAt: token.expires_at,
        permanent: !token.expires_at,
        revoked: !!token.revoked,
        expired: !!token.expires_at && new Date(token.expires_at).getTime() <= Date.now(),
        createdAt: token.created_at,
        lastUsedAt: token.last_used_at
      }))
    });
  })
);

router.patch(
  "/classes/:classId",
  validateBody(superClassUpdateSchema),
  asyncHandler(async (req, res) => {
    const { name, status } = req.validated;
    try {
      await withTransaction(async (conn) => {
        const updates = [];
        const params = [];
        if (name !== undefined) {
          updates.push("name = ?");
          params.push(name);
        }
        if (status !== undefined) {
          updates.push("status = ?");
          params.push(status);
        }
        params.push(req.params.classId);
        const [result] = await conn.execute(`UPDATE classes SET ${updates.join(", ")} WHERE id = ?`, params);
        if (!result.affectedRows) {
          const error = new Error("class_not_found");
          error.status = 404;
          throw error;
        }
        if (name !== undefined) {
          await conn.execute(
            "UPDATE class_states SET payload = JSON_SET(payload, '$.settings.className', ?) WHERE class_id = ?",
            [name, req.params.classId]
          );
        }
      });
    } catch (error) {
      if (error.status === 404) return res.status(404).json({ error: "class_not_found", message: "班级不存在" });
      if (isDuplicateError(error)) {
        return res.status(409).json({ error: "class_name_exists", message: "该班级名称已被注册" });
      }
      throw error;
    }
    res.json({ ok: true });
  })
);

router.post(
  "/classes/:classId/reset-admin-password",
  validateBody(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const hash = await bcrypt.hash(req.validated.password, 10);
    const result = await query("UPDATE class_admins SET password_hash = ? WHERE class_id = ? AND is_main = 1", [
      hash,
      req.params.classId
    ]);
    if (!result.affectedRows) {
      return res.status(404).json({ error: "admin_not_found", message: "该班级还没有管理员账号" });
    }
    res.json({ ok: true });
  })
);

router.delete(
  "/classes/:classId",
  asyncHandler(async (req, res) => {
    const result = await query("DELETE FROM classes WHERE id = ?", [req.params.classId]);
    if (!result.affectedRows) return res.status(404).json({ error: "class_not_found", message: "班级不存在" });
    res.status(204).end();
  })
);

module.exports = router;
