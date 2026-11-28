const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { config } = require("./config");

const localMode = !!config.local;
let query = null;
let localRouter = null;
let localStatus = null;
if (localMode) {
  const local = require("./local/routes");
  localRouter = local.router;
  localStatus = local.getLocalStatus;
} else {
  ({ query } = require("./db"));
}

function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: false
    })
  );
  app.use(
    cors({
      origin(origin, callback) {
        if (config.local || !origin || config.corsOrigins.indexOf(origin) >= 0) return callback(null, true);
        return callback(new Error(`CORS origin not allowed: ${origin}`));
      },
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      maxAge: 86400
    })
  );
  app.use(express.json({ limit: "10mb" }));
  app.use(morgan(config.isProd ? "combined" : "dev"));

  app.get("/api/health", async (req, res, next) => {
    try {
      if (localMode) {
        const status = await localStatus();
        return res.json({ ok: true, service: "classpanel-local", mode: "local", storageMode: status.storageMode, classExists: status.classExists, storageError: status.storageError, time: new Date().toISOString() });
      }
      await query("SELECT 1 AS ok");
      res.json({ ok: true, service: "classpanel-backend", mode: "cloud", time: new Date().toISOString() });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/config", async (req, res, next) => {
    try {
      if (!localMode) return res.json({ mode: "cloud", classExists: null, className: null });
      const status = await localStatus();
      return res.json({ mode: "local", ...status });
    } catch (error) {
      next(error);
    }
  });

  if (localMode) {
    app.use("/api", localRouter);
  } else {
    app.use("/api/auth", require("./routes/auth"));
    app.use("/api/classes", require("./routes/classes"));
    app.use("/api/super", require("./routes/super"));
  }

  app.use("/api", (req, res) => {
    res.status(404).json({ error: "not_found", message: "接口不存在" });
  });

  if (localMode) {
    const indexPath = path.join(config.frontendDist, "index.html");
    if (fs.existsSync(indexPath)) {
      app.use(express.static(config.frontendDist));
      app.get("*", (req, res) => res.sendFile(indexPath));
    } else {
      app.get("/", (req, res) => {
        res.status(503).type("text/plain").send("前端尚未构建。请先在 frontend 目录运行 npm run build，然后重新启动本机模式。");
      });
    }
  }

  app.use((req, res) => {
    res.status(404).json({ error: "not_found", message: "接口不存在" });
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error && error.type === "entity.too.large") {
      return res.status(413).json({ error: "payload_too_large", message: "请求数据超过 10MB" });
    }
    if (error && String(error.message || "").startsWith("CORS origin not allowed")) {
      return res.status(403).json({ error: "cors_forbidden", message: "前端地址未被允许" });
    }
    console.error("[api-error]", error && (error.stack || error.message || error));
    res.status(500).json({ error: "internal_error", message: "服务器内部错误" });
  });

  return app;
}

module.exports = { createApp };
