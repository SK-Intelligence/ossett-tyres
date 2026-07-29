#!/usr/bin/env python3
"""Dependency-free static server with a strict public-file boundary."""

import json
import os
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parent

ROUTES = {
    "/",
    "/services",
    "/blog",
    "/contact-us",
    "/order-your-tyres-online",
    "/blog-post",
    "/blog-post1",
}

PUBLIC_FILES = {
    "/index.html",
    "/styles.css",
    "/app.js",
    "/site-utils.js",
    "/tyre-api.js",
    "/assets/hero-vintage.png",
    "/assets/source/blog-desktop.png",
    "/assets/source/contact-desktop.png",
    "/assets/source/home-desktop.png",
    "/assets/source/order-desktop.png",
    "/assets/source/services-desktop.png",
}

DEFAULT_CONTACT_EMAIL = "ossettwholesale@gmail.com"
DEFAULT_PHONE = "07380439443"


def runtime_config():
    """Return deployment configuration without requiring source-file edits."""

    return {
        "backendBase": os.environ.get("OSSETT_BACKEND_BASE", "").strip().rstrip("/"),
        "contactEmail": os.environ.get(
            "OSSETT_CONTACT_EMAIL", DEFAULT_CONTACT_EMAIL
        ).strip()
        or DEFAULT_CONTACT_EMAIL,
        "phone": os.environ.get("OSSETT_PHONE", DEFAULT_PHONE).strip()
        or DEFAULT_PHONE,
    }


def normalise_request_path(request_target):
    """Return a safe, canonical URL path or ``None`` for malformed input."""

    parsed = urlsplit(request_target)
    if parsed.netloc or not parsed.path.startswith("/") or parsed.path.startswith("//"):
        return None

    try:
        path = unquote(parsed.path, errors="strict")
    except (UnicodeDecodeError, ValueError):
        return None

    if "%" in path or "\\" in path or any(ord(char) < 32 or ord(char) == 127 for char in path):
        return None

    parts = [part for part in path.split("/") if part]
    if any(part in {".", ".."} or part.startswith(".") for part in parts):
        return None

    return "/" + "/".join(parts) if parts else "/"


def filesystem_target(path):
    """Resolve a URL path inside the repository root, rejecting escapes."""

    target = (ROOT / path.lstrip("/")).resolve()
    try:
        target.relative_to(ROOT)
    except ValueError:
        return None
    return target


def classify_request(request_target):
    """Classify a request as a public file, runtime config, SPA route, or 404."""

    path = normalise_request_path(request_target)
    if path is None:
        return "not_found", None

    route = path.rstrip("/") or "/"
    if route in ROUTES:
        return "file", "/index.html"

    if path == "/config.js":
        return "config", None

    if path in PUBLIC_FILES:
        target = filesystem_target(path)
        if target is not None and target.is_file():
            return "file", path
        return "not_found", None

    target = filesystem_target(path)
    if target is None or target.exists():
        return "not_found", None

    parts = PurePosixPath(path).parts[1:]
    if not parts or any("." in part for part in parts):
        return "not_found", None

    # A nonexistent child of a real repository entry (for example /tests/missing)
    # is still private rather than an application route.
    if (ROOT / parts[0]).exists():
        return "not_found", None

    return "file", "/index.html"


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, directory=None, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def _serve_runtime_config(self, head_only=False):
        source = (
            "window.OSSETT_CONFIG = Object.freeze("
            + json.dumps(runtime_config(), separators=(",", ":"))
            + ");\n"
        ).encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/javascript; charset=utf-8")
        self.send_header("Content-Length", str(len(source)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if not head_only:
            self.wfile.write(source)

    def _dispatch(self, head_only=False):
        kind, public_path = classify_request(self.path)
        if kind == "not_found":
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        if kind == "config":
            self._serve_runtime_config(head_only=head_only)
            return

        self.path = public_path
        if head_only:
            super().do_HEAD()
        else:
            super().do_GET()

    def do_GET(self):
        self._dispatch()

    def do_HEAD(self):
        self._dispatch(head_only=True)

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        super().end_headers()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "4173"))
    print(f"Ossett Tyres: http://0.0.0.0:{port}")
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
