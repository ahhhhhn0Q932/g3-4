const readline = require("node:readline/promises");
const { stdin, stdout } = require("node:process");
const bcrypt = require("bcryptjs");
const { query, pool } = require("../src/db");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function validate(username, password) {
  if (!/^[A-Za-z0-9_]{3,32}$/.test(username)) {
    throw new Error("账号需为 3-32 位字母、数字或下划线");
  }
  if (password.length < 8 || password.length > 72) {
    throw new Error("密码需为 8-72 个字符");
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let username = String(args.username || "").trim();
  let password = String(args.password || "");
  let displayName = String(args.name || "").trim();

  if (!username || !password) {
    if (!stdin.isTTY) {
      throw new Error("非交互环境请使用 --username 和 --password 参数");
    }
    const rl = readline.createInterface({ input: stdin, output: stdout });
    try {
      if (!username) username = String(await rl.question("总管理员账号：")).trim();
      if (!password) password = String(await rl.question("总管理员密码（至少 8 位）：")).trim();
      if (!displayName) displayName = String(await rl.question("显示名称（可选）：")).trim();
    } finally {
      rl.close();
    }
  }

  validate(username, password);
  if (!displayName) displayName = username;

  const existing = await query("SELECT id FROM super_admins WHERE username = ? LIMIT 1", [username]);
  if (existing.length) {
    throw new Error(`总管理员账号 ${username} 已存在；如需重置密码请先删除后重新注册`);
  }

  const hash = await bcrypt.hash(password, 12);
  const result = await query(
    "INSERT INTO super_admins (username, password_hash, display_name) VALUES (?, ?, ?)",
    [username, hash, displayName]
  );
  console.log(`[super:create] 已创建总管理员 #${result.insertId}：${username}`);
  console.log("账号只能在数据库/后端控制台创建，前端没有任何注册总管理员的接口。");
}

main()
  .catch((error) => {
    console.error("[super:create] 失败：", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
