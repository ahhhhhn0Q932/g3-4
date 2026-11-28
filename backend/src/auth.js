const jwt = require("jsonwebtoken");
const { config } = require("./config");
const { query } = require("./db");

function signSession(payload, options) {
  return jwt.sign(payload, config.jwtSecret, Object.assign({ expiresIn: config.jwtExpiresIn }, options || {}));
}

function bearerToken(req) {
  const header = String(req.headers.authorization || "");
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

function unauthorized(res, message) {
  return res.status(401).json({ error: "unauthorized", message: message || "请先登录" });
}

async function authenticate(req, res, next) {
  const token = bearerToken(req);
  if (!token) return unauthorized(res, "缺少登录凭证");

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch (error) {
    return unauthorized(res, "登录已过期，请重新登录");
  }

  try {
    if (payload.role === "class_admin") {
      const rows = await query(
        `SELECT ca.id, ca.username, ca.display_name, ca.is_main, c.id AS class_id, c.name AS class_name, c.status
           FROM class_admins ca
           JOIN classes c ON c.id = ca.class_id
          WHERE ca.id = ? AND ca.class_id = ? LIMIT 1`,
        [payload.sub, payload.classId]
      );
      if (!rows.length) return unauthorized(res, "班级管理员账号不存在");
      const row = rows[0];
      if (row.status !== "active") return res.status(403).json({ error: "class_disabled", message: "该班级已被停用" });
      req.auth = {
        role: "class_admin",
        adminId: row.id,
        username: row.username,
        displayName: row.display_name,
        classId: row.class_id,
        className: row.class_name,
        isMain: !!row.is_main
      };
      return next();
    }

    if (payload.role === "class_member") {
      const rows = await query(
        `SELECT cm.id, cm.username, cm.display_name, c.id AS class_id, c.name AS class_name, c.status
           FROM class_members cm
           JOIN classes c ON c.id = cm.class_id
          WHERE cm.id = ? AND cm.class_id = ? LIMIT 1`,
        [payload.sub, payload.classId]
      );
      if (!rows.length) return unauthorized(res, "普通账号不存在");
      const row = rows[0];
      if (row.status !== "active") return res.status(403).json({ error: "class_disabled", message: "该班级已被停用" });
      req.auth = {
        role: "class_member",
        memberId: row.id,
        username: row.username,
        displayName: row.display_name,
        classId: row.class_id,
        className: row.class_name,
        isMain: false
      };
      return next();
    }

    if (payload.role === "guest" || payload.role === "class_display") {
      const rows = await query(
        `SELECT t.id AS token_id, t.class_id, t.expires_at, t.revoked,
                c.name AS class_name, c.status
           FROM access_tokens t
           JOIN classes c ON c.id = t.class_id
          WHERE t.id = ? AND t.class_id = ? LIMIT 1`,
        [payload.sub, payload.classId]
      );
      if (!rows.length) return unauthorized(res, "访客令牌不存在");
      const row = rows[0];
      if (row.revoked) return unauthorized(res, "访客令牌已被撤销");
      if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
        return unauthorized(res, "访客令牌已过期");
      }
      if (row.status !== "active") return res.status(403).json({ error: "class_disabled", message: "该班级已被停用" });
      req.auth = {
        role: payload.role,
        tokenId: row.token_id,
        classId: row.class_id,
        className: row.class_name,
        expiresAt: row.expires_at
      };
      // 记录最后使用时间；失败不影响请求
      query("UPDATE access_tokens SET last_used_at = NOW() WHERE id = ?", [row.token_id]).catch(() => {});
      return next();
    }

    if (payload.role === "super_admin") {
      const rows = await query(
        "SELECT id, username, display_name, is_active FROM super_admins WHERE id = ? LIMIT 1",
        [payload.sub]
      );
      if (!rows.length || !rows[0].is_active) return unauthorized(res, "总管理员账号不可用");
      req.auth = {
        role: "super_admin",
        superId: rows[0].id,
        username: rows[0].username,
        displayName: rows[0].display_name
      };
      return next();
    }

    return unauthorized(res, "未知的登录身份");
  } catch (error) {
    return next(error);
  }
}

function requireRole(...roles) {
  return function roleGuard(req, res, next) {
    if (!req.auth || roles.indexOf(req.auth.role) < 0) {
      return res.status(403).json({ error: "forbidden", message: "没有权限执行此操作" });
    }
    next();
  };
}

function requireClassAdmin(req, res, next) {
  if (!req.auth || req.auth.role !== "class_admin") {
    return res.status(403).json({ error: "forbidden", message: "仅班级管理员可操作" });
  }
  if (Number(req.params.classId) !== Number(req.auth.classId)) {
    return res.status(403).json({ error: "forbidden", message: "不能操作其他班级" });
  }
  next();
}

function requireClassAccount(req, res, next) {
  if (!req.auth || (req.auth.role !== "class_admin" && req.auth.role !== "class_member")) {
    return res.status(403).json({ error: "forbidden", message: "仅班级账号可操作" });
  }
  if (Number(req.params.classId) !== Number(req.auth.classId)) {
    return res.status(403).json({ error: "forbidden", message: "不能操作其他班级" });
  }
  next();
}

function requireClassAccess(req, res, next) {
  if (!req.auth) return unauthorized(res);
  if (req.auth.role === "super_admin") return next();
  if (Number(req.params.classId) !== Number(req.auth.classId)) {
    return res.status(403).json({ error: "forbidden", message: "不能访问其他班级" });
  }
  next();
}

module.exports = {
  signSession,
  authenticate,
  requireRole,
  requireClassAdmin,
  requireClassAccount,
  requireClassAccess,
  unauthorized
};
