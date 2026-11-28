#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/mysql-env.sh"

if [ -f "$PID_FILE" ]; then
  PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    echo "[mysql:status] 运行中：PID $PID · 127.0.0.1:${DB_PORT} · 数据库 ${DB_NAME}"
    "$BASE_DIR/bin/mysql" --no-defaults --protocol=socket --socket="$SOCKET" -uroot -e "SELECT VERSION() AS version" 2>/dev/null || true
    exit 0
  fi
fi
echo "[mysql:status] 未运行（端口 ${DB_PORT}）"
exit 1
