#!/usr/bin/env python3
"""Dependency-free site server and same-origin vehicle lookup proxy."""

import http.client
import hashlib
import json
import math
import mimetypes
import os
import re
import socket
import threading
import time
import unicodedata
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlencode, urlsplit

mimetypes.add_type("image/x-icon", ".ico")
mimetypes.add_type("application/manifest+json", ".webmanifest")

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
    "/favicon.ico",
    "/favicon-16x16.png",
    "/favicon-32x32.png",
    "/favicon-192x192.png",
    "/favicon-512x512.png",
    "/apple-touch-icon.png",
    "/site.webmanifest",
    "/assets/tyre-logo.png",
    "/assets/whatsapp-logo.png",
    "/assets/hero-vintage.png",
    "/assets/source/blog-desktop.png",
    "/assets/source/contact-desktop.png",
    "/assets/source/home-desktop.png",
    "/assets/source/order-desktop.png",
    "/assets/source/services-desktop.png",
    "/assets/brands/avon.png",
    "/assets/brands/bridgestone.png",
    "/assets/brands/continental.png",
    "/assets/brands/dunlop.png",
    "/assets/brands/giti.png",
    "/assets/brands/goodyear.png",
    "/assets/brands/hankook.png",
    "/assets/brands/leao.png",
    "/assets/brands/matador.png",
    "/assets/brands/maxxis.png",
    "/assets/brands/michelin.png",
    "/assets/brands/nexen.png",
    "/assets/brands/pirelli.png",
    "/assets/brands/prestivo.png",
    "/assets/brands/riken.png",
    "/assets/brands/roadstone.png",
    "/assets/brands/triangle.png",
    "/assets/brands/uniroyal.png",
    "/assets/brands/west-lake.png",
    "/assets/brands/yokohama.png",
}

API_PATH = "/api/dvla"
MAX_REQUEST_BODY = 4096
MAX_DVLA_RESPONSE = 64 * 1024
MAX_ONEAUTO_RESPONSE = 512 * 1024
REQUEST_TIMEOUT_SECONDS = 8
UPSTREAM_TIMEOUT_SECONDS = 8
LOOKUP_COOLDOWN_SECONDS = 10
CLIENT_COOLDOWN_SECONDS = 2
MAX_CONCURRENT_LOOKUPS = 8
DVLA_HOST = "driver-vehicle-licensing.api.gov.uk"
DVLA_PATH = "/vehicle-enquiry/v1/vehicles"
ONEAUTO_HOST = "api.oneautoapi.com"
ONEAUTO_PATH = "/driverightdata/oetyrefitmentdata/v2"
DEFAULT_CONTACT_EMAIL = "ossettwholesale@gmail.com"
DEFAULT_PHONE = "07380439443"
PHONE_PATTERN = re.compile(r"^[0-9+() .-]+$")
REGISTRATION_PATTERN = re.compile(r"^[A-Z0-9]{1,8}$")
TYRE_SIZE_PATTERN = re.compile(
    r"\b(\d{3})\s*/\s*(\d{2,3})\s*(Z?\s*R)\s*(\d{2}(?:[.,]5)?)\b",
    re.IGNORECASE,
)


class ApiError(Exception):
    """A safe, client-facing API error."""

    def __init__(self, status, code, message, retry_after=None):
        super().__init__(message)
        self.status = HTTPStatus(status)
        self.code = code
        self.message = message
        self.retry_after = retry_after


class UpstreamError(Exception):
    """An upstream transport or response error whose details stay server-side."""

    def __init__(self, kind, status=0):
        super().__init__(kind)
        self.kind = kind
        self.status = int(status or 0)


class LookupCooldown:
    """Best-effort client and registration cooldown using keyed digests."""

    def __init__(
        self,
        seconds=LOOKUP_COOLDOWN_SECONDS,
        client_seconds=CLIENT_COOLDOWN_SECONDS,
    ):
        self.seconds = seconds
        self.client_seconds = client_seconds
        self._salt = os.urandom(16)
        self._recent = {}
        self._clients = {}
        self._lock = threading.Lock()

    def check_and_record(self, client_key, registration, now=None):
        timestamp = time.monotonic() if now is None else float(now)
        client_digest = hashlib.blake2s(
            str(client_key).encode("utf-8"),
            key=self._salt,
            digest_size=12,
        ).digest()
        registration_digest = hashlib.blake2s(
            registration.encode("ascii"),
            key=self._salt,
            digest_size=12,
        ).digest()
        registration_key = (client_digest, registration_digest)
        with self._lock:
            registration_cutoff = timestamp - self.seconds
            client_cutoff = timestamp - self.client_seconds
            self._recent = {
                existing_key: seen_at
                for existing_key, seen_at in self._recent.items()
                if seen_at > registration_cutoff
            }
            self._clients = {
                existing_key: seen_at
                for existing_key, seen_at in self._clients.items()
                if seen_at > client_cutoff
            }
            previous_registration = self._recent.get(registration_key)
            if previous_registration is not None:
                remaining = self.seconds - (timestamp - previous_registration)
                if remaining > 0:
                    return max(1, math.ceil(remaining))
            previous_client = self._clients.get(client_digest)
            if previous_client is not None:
                remaining = self.client_seconds - (timestamp - previous_client)
                if remaining > 0:
                    return max(1, math.ceil(remaining))
            self._recent[registration_key] = timestamp
            self._clients[client_digest] = timestamp
        return 0


lookup_cooldown = LookupCooldown()
lookup_slots = threading.BoundedSemaphore(MAX_CONCURRENT_LOOKUPS)


def runtime_config():
    """Return only configuration that is safe to expose to browsers."""

    return {
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

    if "%" in path or "\\" in path or any(
        ord(char) < 32 or ord(char) == 127 for char in path
    ):
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
    """Classify a request as a public file, config, API path, SPA route, or 404."""

    path = normalise_request_path(request_target)
    if path is None:
        return "not_found", None

    if path == API_PATH or path.startswith("/api/"):
        return "api", path

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


def normalise_lookup_payload(payload):
    """Validate and normalize the exact public lookup request contract."""

    if not isinstance(payload, dict):
        raise ApiError(400, "invalid_request", "Enter your tyre lookup details.")

    required = {"registrationNumber", "customerName", "customerPhone"}
    if set(payload) != required or any(
        not isinstance(payload[field], str) for field in required
    ):
        raise ApiError(400, "invalid_request", "Check your details and try again.")

    name = " ".join(
        unicodedata.normalize("NFKC", payload["customerName"]).split()
    )
    phone = " ".join(
        unicodedata.normalize("NFKC", payload["customerPhone"]).split()
    )
    registration = "".join(
        unicodedata.normalize("NFKC", payload["registrationNumber"]).split()
    ).upper()

    if (
        not name
        or len(name) > 80
        or not any(character.isalpha() for character in name)
        or any(unicodedata.category(character).startswith("C") for character in name)
    ):
        raise ApiError(400, "invalid_request", "Enter a valid name.")

    phone_digits = "".join(character for character in phone if character.isdigit())
    if (
        not phone
        or len(phone) > 32
        or not PHONE_PATTERN.fullmatch(phone)
        or not 10 <= len(phone_digits) <= 15
    ):
        raise ApiError(400, "invalid_request", "Enter a valid phone number.")

    if not REGISTRATION_PATTERN.fullmatch(registration):
        raise ApiError(
            400,
            "invalid_request",
            "Check the registration and try again.",
        )

    return {
        "registrationNumber": registration,
        "customerName": name,
        "customerPhone": phone,
    }


def read_request_json(handler):
    """Read a small, uncompressed JSON request body from the handler."""

    transfer_encoding = handler.headers.get("Transfer-Encoding", "").strip()
    content_encoding = handler.headers.get("Content-Encoding", "").strip().lower()
    content_type = handler.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
    if transfer_encoding or content_encoding not in {"", "identity"}:
        raise ApiError(400, "invalid_request", "Unsupported request encoding.")
    if content_type != "application/json":
        raise ApiError(415, "unsupported_media_type", "Send the request as JSON.")

    length_value = handler.headers.get("Content-Length", "").strip()
    try:
        content_length = int(length_value, 10)
    except (TypeError, ValueError):
        raise ApiError(400, "invalid_request", "A valid request body is required.")
    if content_length <= 0:
        raise ApiError(400, "invalid_request", "A valid request body is required.")
    if content_length > MAX_REQUEST_BODY:
        raise ApiError(413, "request_too_large", "The request is too large.")

    try:
        raw = handler.rfile.read(content_length)
    except (TimeoutError, socket.timeout):
        raise ApiError(408, "request_timeout", "The request took too long.")
    if len(raw) != content_length:
        raise ApiError(400, "invalid_request", "The request body was incomplete.")

    try:
        payload = json.loads(raw.decode("utf-8", errors="strict"))
    except (UnicodeDecodeError, json.JSONDecodeError, RecursionError):
        raise ApiError(400, "invalid_request", "Send a valid JSON request.")
    return normalise_lookup_payload(payload)


def _bounded_response_body(response, limit):
    """Read at most ``limit`` bytes from an uncompressed upstream response."""

    encoding = (response.getheader("Content-Encoding") or "").strip().lower()
    if encoding not in {"", "identity"}:
        raise UpstreamError("malformed", response.status)

    declared = response.getheader("Content-Length")
    if declared:
        try:
            declared_length = int(declared, 10)
        except ValueError:
            raise UpstreamError("malformed", response.status)
        if declared_length < 0 or declared_length > limit:
            raise UpstreamError("too_large", response.status)

    raw = response.read(limit + 1)
    if len(raw) > limit:
        raise UpstreamError("too_large", response.status)
    if raw.strip():
        media_type = (response.getheader("Content-Type") or "").split(";", 1)[0]
        media_type = media_type.strip().lower()
        if media_type != "application/json" and not media_type.endswith("+json"):
            raise UpstreamError("malformed", response.status)
    return raw


def request_upstream_json(host, method, path, headers, body, limit):
    """Make one fixed-host HTTPS request without following redirects."""

    connection = http.client.HTTPSConnection(host, timeout=UPSTREAM_TIMEOUT_SECONDS)
    try:
        connection.request(method, path, body=body, headers=headers)
        response = connection.getresponse()
        raw = _bounded_response_body(response, limit)
        if not raw.strip():
            parsed = None
        else:
            try:
                parsed = json.loads(raw.decode("utf-8", errors="strict"))
            except (UnicodeDecodeError, json.JSONDecodeError, RecursionError):
                raise UpstreamError("malformed", response.status)
        return response.status, response.getheader("Retry-After"), parsed
    except (TimeoutError, socket.timeout):
        raise UpstreamError("timeout")
    except UpstreamError:
        raise
    except (OSError, http.client.HTTPException):
        raise UpstreamError("unavailable")
    finally:
        connection.close()


def _clean_text(value, limit=80):
    if not isinstance(value, str):
        return None
    cleaned = " ".join(value.split())[:limit]
    return cleaned or None


def sanitize_dvla_response(payload):
    """Keep only the public vehicle fields used by the UI."""

    if not isinstance(payload, dict):
        raise UpstreamError("malformed", 200)
    year = payload.get("yearOfManufacture")
    if not isinstance(year, (str, int)) or isinstance(year, bool):
        year = None
    elif isinstance(year, str):
        year = year.strip()[:8] or None

    vehicle = {
        "make": _clean_text(payload.get("make")),
        "colour": _clean_text(payload.get("colour")),
        "yearOfManufacture": year,
    }
    if not any(value is not None for value in vehicle.values()):
        raise UpstreamError("malformed", 200)
    return vehicle


def canonical_tyre_size(value):
    if not isinstance(value, str) or len(value) > 48:
        return None
    match = TYRE_SIZE_PATTERN.search(value)
    if not match:
        return None
    width = int(match.group(1))
    aspect = int(match.group(2))
    rim = float(match.group(4).replace(",", "."))
    if not (95 <= width <= 455 and 20 <= aspect <= 100 and 10 <= rim <= 30):
        return None
    construction = match.group(3).upper().replace(" ", "")
    rim_text = str(int(rim)) if rim.is_integer() else str(rim)
    return f"{width}/{aspect}{construction}{rim_text}"


def sanitize_oneauto_response(payload):
    """Return fitment sizes only, excluding VIN, engine and provider metadata."""

    if not isinstance(payload, dict) or payload.get("success") is not True:
        raise UpstreamError("malformed", 200)
    result = payload.get("result")
    oe_data = result.get("oe_data") if isinstance(result, dict) else None
    models = oe_data.get("modelIDs") if isinstance(oe_data, dict) else None
    if models is None:
        models = []
    if not isinstance(models, list):
        raise UpstreamError("malformed", 200)

    fitments = []
    seen = set()
    for model in models[:48]:
        if not isinstance(model, dict):
            continue
        front = canonical_tyre_size(model.get("tyre_size_front"))
        rear = canonical_tyre_size(model.get("tyre_size_rear"))
        if not front and not rear:
            continue
        pair = (front, rear)
        if pair in seen:
            continue
        seen.add(pair)
        fitments.append({"front": front, "rear": rear})
        if len(fitments) >= 24:
            break
    return {"fitments": fitments}


def _parse_retry_after(value):
    try:
        seconds = int(str(value).strip(), 10)
    except (TypeError, ValueError):
        return None
    return min(max(seconds, 1), 300)


def _map_dvla_failure(status, retry_after=None):
    if status in {400, 404}:
        raise ApiError(400, "invalid_request", "Check the registration and try again.")
    if status == 429:
        raise ApiError(
            429,
            "rate_limit",
            "Too many searches were made. Please wait before trying again.",
            _parse_retry_after(retry_after),
        )
    if status in {401, 403}:
        raise ApiError(503, "service_unavailable", "The tyre service is unavailable.")
    raise ApiError(502, "upstream_error", "The tyre service is temporarily unavailable.")


def lookup_vehicle(payload, requester=request_upstream_json):
    """Fetch and combine sanitized DVLA and OE tyre fitment data."""

    dvla_key = os.environ.get("DVLA_API_KEY", "").strip()
    if not dvla_key:
        raise ApiError(503, "service_unavailable", "The tyre service is unavailable.")
    oneauto_key = os.environ.get("ONEAUTO_API_KEY", "").strip()

    registration = payload["registrationNumber"]
    dvla_body = json.dumps(
        {"registrationNumber": registration}, separators=(",", ":")
    ).encode("utf-8")
    try:
        dvla_status, retry_after, dvla_payload = requester(
            DVLA_HOST,
            "POST",
            DVLA_PATH,
            {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "x-api-key": dvla_key,
            },
            dvla_body,
            MAX_DVLA_RESPONSE,
        )
    except UpstreamError as error:
        if error.kind == "timeout":
            raise ApiError(504, "upstream_timeout", "The tyre service took too long.")
        raise ApiError(502, "upstream_error", "The tyre service is temporarily unavailable.")
    if dvla_status != 200:
        _map_dvla_failure(dvla_status, retry_after)
    try:
        vehicle = sanitize_dvla_response(dvla_payload)
    except UpstreamError:
        raise ApiError(502, "upstream_error", "The tyre service returned invalid data.")

    if not oneauto_key:
        return {
            "ok": True,
            "dvla": vehicle,
            "tyres": {"error": "temporarily_unavailable"},
        }

    oneauto_path = ONEAUTO_PATH + "?" + urlencode(
        {"vehicle_registration_mark": registration}
    )
    tyres = {"error": "temporarily_unavailable"}
    try:
        oneauto_status, _oneauto_retry, oneauto_payload = requester(
            ONEAUTO_HOST,
            "GET",
            oneauto_path,
            {"Accept": "application/json", "x-api-key": oneauto_key},
            None,
            MAX_ONEAUTO_RESPONSE,
        )
        if oneauto_status == 200:
            tyres = sanitize_oneauto_response(oneauto_payload)
        elif oneauto_status in {204, 206, 400, 404}:
            tyres = {"fitments": []}
        elif oneauto_status not in {204, 206, 400, 404}:
            tyres = {"error": "temporarily_unavailable"}
    except UpstreamError:
        # Vehicle details remain useful when the optional fitment provider is down.
        tyres = {"error": "temporarily_unavailable"}

    return {"ok": True, "dvla": vehicle, "tyres": tyres}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, directory=None, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def setup(self):
        super().setup()
        self.connection.settimeout(REQUEST_TIMEOUT_SECONDS)

    def _send_json(self, status, payload, head_only=False, retry_after=None):
        source = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(source)))
        self.send_header("Cache-Control", "no-store")
        if retry_after is not None:
            self.send_header("Retry-After", str(retry_after))
        self.end_headers()
        if not head_only:
            self.wfile.write(source)

    def _send_api_error(self, error, head_only=False):
        self._send_json(
            error.status,
            {"ok": False, "error": error.code, "message": error.message},
            head_only=head_only,
            retry_after=error.retry_after,
        )

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
        if kind == "api":
            if public_path == API_PATH:
                self._send_method_not_allowed(head_only=head_only)
            else:
                self._send_api_error(
                    ApiError(404, "not_found", "API route not found."),
                    head_only=head_only,
                )
            return
        if kind == "config":
            self._serve_runtime_config(head_only=head_only)
            return

        self.path = public_path
        if head_only:
            super().do_HEAD()
        else:
            super().do_GET()

    def _send_method_not_allowed(self, head_only=False):
        source = json.dumps(
            {"ok": False, "error": "method_not_allowed", "message": "Use POST."},
            separators=(",", ":"),
        ).encode("utf-8")
        self.send_response(HTTPStatus.METHOD_NOT_ALLOWED)
        self.send_header("Allow", "POST")
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(source)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if not head_only:
            self.wfile.write(source)

    def do_GET(self):
        self._dispatch()

    def do_HEAD(self):
        self._dispatch(head_only=True)

    def do_POST(self):
        path = normalise_request_path(self.path)
        if path != API_PATH:
            self._send_api_error(ApiError(404, "not_found", "API route not found."))
            return
        try:
            request_payload = read_request_json(self)
            client_key = (
                self.client_address[0]
                if getattr(self, "client_address", None)
                else "unknown"
            )
            if not lookup_slots.acquire(blocking=False):
                raise ApiError(
                    503,
                    "service_busy",
                    "The tyre service is busy. Please try again shortly.",
                )
            try:
                retry_after = lookup_cooldown.check_and_record(
                    client_key, request_payload["registrationNumber"]
                )
                if retry_after:
                    raise ApiError(
                        429,
                        "rate_limit",
                        "Please wait before searching for this registration again.",
                        retry_after,
                    )
                response_payload = lookup_vehicle(request_payload)
            finally:
                lookup_slots.release()
        except ApiError as error:
            self._send_api_error(error)
            return
        except Exception:
            # Never expose exception details, request data, or provider responses.
            self._send_api_error(
                ApiError(500, "server_error", "The tyre service is temporarily unavailable.")
            )
            return
        self._send_json(HTTPStatus.OK, response_payload)

    def do_OPTIONS(self):
        path = normalise_request_path(self.path)
        if path == API_PATH:
            self._send_method_not_allowed()
        else:
            self._send_api_error(ApiError(404, "not_found", "API route not found."))

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        super().end_headers()


class Server(ThreadingHTTPServer):
    daemon_threads = True
    request_queue_size = 64


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "4173"))
    print(f"Ossett Tyres: http://0.0.0.0:{port}")
    Server(("0.0.0.0", port), Handler).serve_forever()
