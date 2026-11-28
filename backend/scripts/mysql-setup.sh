#!/usr/bin/env bash
# 下载并初始化本地开发用 MySQL Community 8.4，不依赖系统 MariaDB/root 权限。
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/mysql-env.sh"

mkdir -p "$MYSQL_ROOT" "$DIST_DIR" "$RUN_DIR"

if [ ! -x "$BASE_DIR/bin/mysqld" ]; then
  if [ ! -f "$ARCHIVE" ]; then
    echo "[mysql:setup] 下载 MySQL Community ${MYSQL_VERSION}（约 63MB）…"
    curl -fL --retry 3 --retry-delay 2 -o "$ARCHIVE.part" "$MYSQL_URL"
    mv "$ARCHIVE.part" "$ARCHIVE"
  fi
  echo "[mysql:setup] 解压到 $DIST_DIR …"
  tar -xJf "$ARCHIVE" -C "$DIST_DIR"
fi

"$BASE_DIR/bin/mysqld" --version

if [ ! -d "$DATA_DIR/mysql" ]; then
  echo "[mysql:setup] 初始化数据目录 $DATA_DIR …"
  mkdir -p "$DATA_DIR" "$RUN_DIR"
  "$BASE_DIR/bin/mysqld" \
    --no-defaults \
    --initialize-insecure \
    --basedir="$BASE_DIR" \
    --datadir="$DATA_DIR" \
    --log-error="$MYSQL_ROOT/initialize.log"
fi

bash "$SCRIPT_DIR/mysql-start.sh"

echo "[mysql:setup] 创建数据库与开发账号…"
SQL_ESCAPED_PASSWORD="${DB_PASSWORD//\'/\'\'}"
"$BASE_DIR/bin/mysql" --no-defaults --protocol=socket --socket="$SOCKET" -uroot <<SQL
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'127.0.0.1' IDENTIFIED BY '$SQL_ESCAPED_PASSWORD';
ALTER USER '$DB_USER'@'127.0.0.1' IDENTIFIED BY '$SQL_ESCAPED_PASSWORD';
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$SQL_ESCAPED_PASSWORD';
ALTER USER '$DB_USER'@'localhost' IDENTIFIED BY '$SQL_ESCAPED_PASSWORD';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'127.0.0.1';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'localhost';
FLUSH PRIVILEGES;
SQL

echo "[mysql:setup] 完成。MySQL Community 监听 127.0.0.1:${DB_PORT}，数据库：${DB_NAME}"
echo "[mysql:setup] 下一步：cd backend && npm run db:init && npm run super:create"
