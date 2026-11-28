#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/mysql-env.sh"

if [ -f "$PID_FILE" ]; then
  PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    echo "[mysql:stop] 停止 PID $PID …"
    kill -TERM "$PID"
    for i in $(seq 1 30); do
      if ! kill -0 "$PID" 2>/dev/null; then
        rm -f "$PID_FILE"
        echo "[mysql:stop] 已停止"
        exit 0
      fi
      sleep 1
    done
    echo "[mysql:stop] 进程未退出，请手动检查 PID $PID"
    exit 1
  fi
  rm -f "$PID_FILE"
fi
echo "[mysql:stop] 当前未运行"
