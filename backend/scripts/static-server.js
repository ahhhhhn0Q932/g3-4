const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const { config } = require("../src/config");

const app = express();
const root = path.join(__dirname, "..", "..", "frontend", "dist");

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  next();
});
if (!fs.existsSync(path.join(root, "index.html"))) {
  console.error("[classpanel] 未找到 frontend/dist/index.html");
  console.error("[classpanel] 请先运行：cd frontend && npm install && npm run build");
  process.exit(1);
}
app.use(express.static(root, { extensions: ["html"], index: "index.html" }));

app.get("*", (req, res) => {
  res.status(404).send("Not found");
});

app.listen(config.frontendPort, "127.0.0.1", () => {
  console.log(`[classpanel] 前端静态服务：http://127.0.0.1:${config.frontendPort}`);
  console.log(`[classpanel] 班级应用：http://127.0.0.1:${config.frontendPort}/index.html`);
  console.log(`[classpanel] 总管理员控制台：http://127.0.0.1:${config.frontendPort}/super.html`);
});
