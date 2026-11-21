#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""班级管理系统 - 本地自动备份小程序
仅监听 127.0.0.1:8765；浏览器把当前数据 POST 到 /save，
程序保存 latest.json 与最多 30 份带时间戳的快照。
"""
import json
import os
import sys
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

HOST = "127.0.0.1"
PORT = int(os.environ.get("CLASS_BACKUP_PORT", "8765"))
BASE_DIR = Path(os.environ.get("CLASS_BACKUP_DIR", str(Path.home() / "ClassManagerBackup")))
MAX_SNAPSHOTS = 30
MAX_BODY = 20 * 1024 * 1024


def ensure_dir():
    BASE_DIR.mkdir(parents=True, exist_ok=True)


def prune_snapshots():
    files = sorted(BASE_DIR.glob("snapshot-*.json"))
    for old in files[:-MAX_SNAPSHOTS]:
        try:
            old.unlink()
        except OSError:
            pass


def write_backup(payload):
    ensure_dir()
    store = payload.get("store", payload) if isinstance(payload, dict) else payload
    now = datetime.now()
    stamp = now.strftime("%Y%m%d-%H%M%S")
    text = json.dumps(store, ensure_ascii=False, indent=2)

    latest = BASE_DIR / "latest.json"
    latest.write_text(text, encoding="utf-8")

    snapshot = BASE_DIR / f"snapshot-{stamp}.json"
    snapshot.write_text(text, encoding="utf-8")

    meta = {
        "savedAt": payload.get("savedAt") if isinstance(payload, dict) else None,
        "receivedAt": now.isoformat(timespec="seconds"),
        "file": snapshot.name,
    }
    (BASE_DIR / "latest-meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    prune_snapshots()
    return snapshot


class Handler(BaseHTTPRequestHandler):
    server_version = "ClassBackup/1.0"

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Cache-Control", "no-store")

    def _json(self, status, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/health":
            self._json(200, {
                "ok": True,
                "service": "class-backup",
                "dir": str(BASE_DIR),
                "time": datetime.now().isoformat(timespec="seconds"),
            })
        elif path == "/latest-meta":
            meta = BASE_DIR / "latest-meta.json"
            if meta.exists():
                self._json(200, json.loads(meta.read_text(encoding="utf-8")))
            else:
                self._json(404, {"ok": False, "error": "no backup yet"})
        else:
            self._json(404, {"ok": False, "error": "not found"})

    def do_POST(self):
        path = urlparse(self.path).path
        if path != "/save":
            self._json(404, {"ok": False, "error": "not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BODY:
                raise ValueError("invalid body size")
            raw = self.rfile.read(length)
            payload = json.loads(raw.decode("utf-8"))
            snapshot = write_backup(payload)
            self._json(200, {
                "ok": True,
                "file": snapshot.name,
                "dir": str(BASE_DIR),
                "time": datetime.now().isoformat(timespec="seconds"),
            })
        except Exception as exc:
            self._json(400, {"ok": False, "error": str(exc)})

    def log_message(self, fmt, *args):
        # 保持窗口安静，只记录错误
        if args and str(args[1] if len(args) > 1 else "").startswith(("4", "5")):
            sys.stderr.write("[backup] " + (fmt % args) + "\n")


def main():
    ensure_dir()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"ClassManager local backup: http://{HOST}:{PORT}")
    print(f"Backup directory: {BASE_DIR}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
