"""Vercel Function that exposes browser-safe runtime configuration only."""

import json
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler

from server import runtime_config


class handler(BaseHTTPRequestHandler):
    def _send(self, head_only=False):
        source = (
            "window.OSSETT_CONFIG = Object.freeze("
            + json.dumps(runtime_config(), separators=(",", ":"))
            + ");\n"
        ).encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/javascript; charset=utf-8")
        self.send_header("Content-Length", str(len(source)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        if not head_only:
            self.wfile.write(source)

    def do_GET(self):
        self._send()

    def do_HEAD(self):
        self._send(head_only=True)

    def log_message(self, _format, *args):
        del args
