#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/mysql-env.sh"

if [ ! -x "$BASE_DIR/bin/mysqld" ]; then
  echo "[mysql:start] 尚未安装 MySQL Community，请先运行 npm run mysql:setup"
  exit 1
fi

if [ -f "$PID_FILE" ]; then
  PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    echo "[mysql:start] 已在运行（PID $PID，127.0.0.1:${DB_PORT}）"
    exit 0
  fi
  rm -f "$PID_FILE"
fi

mkdir -p "$RUN_DIR"
echo "[mysql:start] 启动 MySQL Community 127.0.0.1:${DB_PORT} …"
# --daemonize 让数据库进程脱离当前 shell，避免终端结束后被回收。
"$BASE_DIR/bin/mysqld" \
  --no-defaults \
  --daemonize \
  --basedir="$BASE_DIR" \
  --datadir="$DATA_DIR" \
  --port="$DB_PORT" \
  --bind-address=127.0.0.1 \
  --default-time-zone=+00:00 \
  --socket="$SOCKET" \
  --pid-file="$PID_FILE" \
  --log-error="$LOG_FILE" \
  --skip-log-bin \
  --character-set-server=utf8mb4 \
  --collation-server=utf8mb4_0900_ai_ci \
  --max-connections=80 \
  >"$STDOUT_LOG" 2>&1

for i in $(seq 1 60); do
  if "$BASE_DIR/bin/mysql" --no-defaults --protocol=socket --socket="$SOCKET" -uroot -e "SELECT 1" >/dev/null 2>&1; then
    echo "[mysql:start] 已启动（socket: $SOCKET）"
    exit 0
  fi
  sleep 1
done

echo "[mysql:start] 启动超时，请查看 $LOG_FILE"
tail -20 "$LOG_FILE" 2>/dev/null || true
exit 1
