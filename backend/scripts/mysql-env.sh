#!/usr/bin/env bash
# 被其他 mysql-*.sh 引入的公共路径与环境变量
set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MYSQL_ROOT="$BACKEND_DIR/.mysql"
DIST_DIR="$MYSQL_ROOT/dist"
MYSQL_VERSION="8.4.5"
MYSQL_PLATFORM="linux-glibc2.28-x86_64-minimal"
MYSQL_DIR_NAME="mysql-${MYSQL_VERSION}-${MYSQL_PLATFORM}"
BASE_DIR="$DIST_DIR/$MYSQL_DIR_NAME"
ARCHIVE="$DIST_DIR/mysql-${MYSQL_VERSION}-${MYSQL_PLATFORM}.tar.xz"
MYSQL_URL="https://cdn.mysql.com/archives/mysql-8.4/mysql-${MYSQL_VERSION}-${MYSQL_PLATFORM}.tar.xz"
DATA_DIR="$MYSQL_ROOT/data"
RUN_DIR="$MYSQL_ROOT/run"
SOCKET="$RUN_DIR/mysql.sock"
PID_FILE="$RUN_DIR/mysqld.pid"
LOG_FILE="$MYSQL_ROOT/mysqld.log"
STDOUT_LOG="$MYSQL_ROOT/mysqld.stdout.log"

# MySQL Community minimal 客户端链接的是 libncurses.so.6；部分发行版只提供宽字符版。
# 在项目私有目录建立兼容链接，不修改系统库。
mkdir -p "$MYSQL_ROOT/lib"
if [ ! -e "$MYSQL_ROOT/lib/libncurses.so.6" ] && [ -e /usr/lib/libncursesw.so.6 ]; then
  ln -sf /usr/lib/libncursesw.so.6 "$MYSQL_ROOT/lib/libncurses.so.6"
fi
export LD_LIBRARY_PATH="$MYSQL_ROOT/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"

if [ -f "$BACKEND_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$BACKEND_DIR/.env"
  set +a
fi

DB_PORT="${DB_PORT:-3307}"
DB_USER="${DB_USER:-classpanel}"
DB_PASSWORD="${DB_PASSWORD:-classpanel_dev_pwd}"
DB_NAME="${DB_NAME:-classpanel}"
