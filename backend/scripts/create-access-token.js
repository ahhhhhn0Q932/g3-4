const crypto = require("node:crypto");
const { query, pool } = require("../src/db");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) args[key] = true;
    else { args[key] = next; i += 1; }
  }
  return args;
}

async function findClass(value) {
  if (!value) return null;
  const rows = await query("SELECT id, name FROM classes WHERE id = ? OR name = ? LIMIT 1", [value, value]);
  return rows[0] || null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cls = await findClass(args.class || args.id);
  if (!cls) {
    console.error("请使用 --class 指定班级名称或 ID。例如：npm run token:create -- --class 高三(4)班 --label 班级电脑 --days 0");
    process.exitCode = 1;
    return;
  }

  if (args.list) {
    const rows = await query(
      `SELECT id, label, expires_at, revoked, created_at, last_used_at
         FROM access_tokens WHERE class_id = ? ORDER BY created_at DESC, id DESC`,
      [cls.id]
    );
    if (!rows.length) {
      console.log(`班级「${cls.name}」还没有令牌。`);
      return;
    }
    console.log(`班级「${cls.name}」的令牌：`);
    rows.forEach((row) => {
      console.log(`#${row.id}  ${row.label || "未命名"}  过期：${row.expires_at ? new Date(row.expires_at).toISOString() : "永久"}  撤销：${row.revoked ? "是" : "否"}  创建：${row.created_at}`);
    });
    return;
  }

  if (args.revoke) {
    const id = Number(args.revoke);
    const result = await query("UPDATE access_tokens SET revoked = 1 WHERE id = ? AND class_id = ?", [id, cls.id]);
    console.log(result.affectedRows ? `已撤销令牌 #${id}` : `未找到班级「${cls.name}」的令牌 #${id}`);
    return;
  }

  const label = String(args.label || "班级电脑显示客户端").trim().slice(0, 64);
  const days = Number(args.days === undefined ? 0 : args.days);
  if (!Number.isInteger(days) || days < 0 || days > 3650) {
    console.error("--days 需为 0-3650，0 表示永久。");
    process.exitCode = 1;
    return;
  }
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null;
  const result = await query(
    "INSERT INTO access_tokens (class_id, token, label, expires_at, created_by) VALUES (?, ?, ?, ?, NULL)",
    [cls.id, token, label, expiresAt]
  );
  console.log("令牌登录仅用于班级电脑显示客户端，不会在网页展示。");
  console.log(`班级：${cls.name}（#${cls.id}）`);
  console.log(`令牌 ID：${result.insertId}`);
  console.log(`令牌：${token}`);
  console.log(`有效期：${expiresAt ? expiresAt.toISOString() : "永久"}`);
  console.log("请妥善保存；客户端后续通过 /api/auth/token 使用该令牌登录。");
}

main()
  .catch((error) => { console.error("[token:create] 失败：", error.message); process.exitCode = 1; })
  .finally(async () => { await pool.end().catch(() => {}); });
