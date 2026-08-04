"""Static-boundary and same-origin lookup tests without binding a socket."""

import io
import json
import unittest
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler
from pathlib import Path
from unittest.mock import Mock, call, patch

from server import (
    API_PATH,
    DVLA_HOST,
    DVLA_PATH,
    MAX_DVLA_RESPONSE,
    MAX_ONEAUTO_RESPONSE,
    MAX_REQUEST_BODY,
    ONEAUTO_HOST,
    ONEAUTO_PATH,
    ApiError,
    Handler,
    LookupCooldown,
    PUBLIC_FILES,
    ROUTES,
    UpstreamError,
    _bounded_response_body,
    canonical_tyre_size,
    lookup_vehicle,
    normalise_lookup_payload,
)


ROOT = Path(__file__).resolve().parent.parent
VALID_PAYLOAD = {
    "registrationNumber": "AB12CDE",
    "customerName": "Ada Lovelace",
    "customerPhone": "07380 439443",
}


class FakeResponse:
    def __init__(self, status=200, body=b"{}", headers=None):
        self.status = status
        self.body = body
        self.headers = {str(key).lower(): str(value) for key, value in (headers or {}).items()}

    def getheader(self, name):
        return self.headers.get(str(name).lower())

    def read(self, size=-1):
        return self.body if size < 0 else self.body[:size]


class HandlerTests(unittest.TestCase):
    def dispatch(self, request_path, method="GET"):
        handler = object.__new__(Handler)
        handler.path = request_path
        handler.send_error = Mock()
        parent_method = "do_HEAD" if method == "HEAD" else "do_GET"
        with patch.object(SimpleHTTPRequestHandler, parent_method) as parent_call:
            if method == "HEAD":
                Handler.do_HEAD(handler)
            else:
                Handler.do_GET(handler)
        return handler, parent_call

    def api_handler(self, path=API_PATH, body=None, headers=None):
        raw = json.dumps(body if body is not None else VALID_PAYLOAD).encode("utf-8")
        handler = object.__new__(Handler)
        handler.path = path
        handler.headers = {
            "Content-Type": "application/json",
            "Content-Length": str(len(raw)),
            **(headers or {}),
        }
        handler.rfile = io.BytesIO(raw)
        handler.wfile = io.BytesIO()
        handler.send_response = Mock()
        handler.send_header = Mock()
        handler.end_headers = Mock()
        return handler

    def response_json(self, handler):
        return json.loads(handler.wfile.getvalue().decode("utf-8"))

    def assert_serves(self, request_path, expected_path, method="GET"):
        handler, parent_call = self.dispatch(request_path, method=method)
        self.assertEqual(handler.path, expected_path)
        parent_call.assert_called_once_with()
        handler.send_error.assert_not_called()

    def assert_not_found(self, request_path, method="GET"):
        handler, parent_call = self.dispatch(request_path, method=method)
        parent_call.assert_not_called()
        handler.send_error.assert_called_once_with(HTTPStatus.NOT_FOUND)

    def test_route_contract_is_explicit(self):
        self.assertEqual(
            ROUTES,
            {
                "/",
                "/services",
                "/blog",
                "/contact-us",
                "/order-your-tyres-online",
                "/blog-post",
                "/blog-post1",
            },
        )

    def test_known_routes_and_unknown_clean_paths_use_the_spa_document(self):
        self.assert_serves("/services", "/index.html")
        self.assert_serves("/blog-post1?from=test", "/index.html")
        self.assert_serves("/unknown-page", "/index.html")
        self.assert_serves("/future/nested-route", "/index.html")

    def test_only_allowlisted_public_files_are_served(self):
        for public_path in sorted(PUBLIC_FILES):
            with self.subTest(public_path=public_path):
                self.assertTrue((ROOT / public_path.lstrip("/")).is_file())
                self.assert_serves(public_path + "?v=1", public_path)

    def test_repository_files_and_directories_are_not_exposed(self):
        private_paths = (
            "/server.py",
            "/README.md",
            "/tests/",
            "/tests/missing",
            "/tools/",
            "/.git/HEAD",
            "/.omx/",
            "/assets/",
            "/assets/source/",
            "/missing.js",
        )
        for private_path in private_paths:
            with self.subTest(private_path=private_path):
                self.assert_not_found(private_path)

    def test_traversal_and_malformed_paths_are_rejected(self):
        paths = (
            "/../server.py",
            "/%2e%2e/server.py",
            "/%252e%252e/server.py",
            "/assets/../server.py",
            "/assets%2f..%2fserver.py",
            "//server.py",
            "/foo\\..\\server.py",
            "/%00server.py",
        )
        for request_path in paths:
            with self.subTest(request_path=request_path):
                self.assert_not_found(request_path)

    def test_head_uses_the_same_public_boundary(self):
        self.assert_serves("/styles.css", "/styles.css", method="HEAD")
        self.assert_serves("/contact-us", "/index.html", method="HEAD")
        self.assert_not_found("/server.py", method="HEAD")
        self.assert_not_found("/.git/HEAD", method="HEAD")

    def test_api_paths_never_fall_through_to_the_spa(self):
        for method in ("GET", "HEAD"):
            handler = self.api_handler(path=API_PATH)
            parent_method = "do_HEAD" if method == "HEAD" else "do_GET"
            with patch.object(SimpleHTTPRequestHandler, parent_method) as parent_call:
                getattr(Handler, f"do_{method}")(handler)
            parent_call.assert_not_called()
            handler.send_response.assert_called_once_with(HTTPStatus.METHOD_NOT_ALLOWED)
            self.assertIn(call("Allow", "POST"), handler.send_header.call_args_list)
            if method == "HEAD":
                self.assertEqual(handler.wfile.getvalue(), b"")
            else:
                self.assertEqual(self.response_json(handler)["error"], "method_not_allowed")

        unknown = self.api_handler(path="/api/missing")
        Handler.do_GET(unknown)
        unknown.send_response.assert_called_once_with(HTTPStatus.NOT_FOUND)
        self.assertEqual(self.response_json(unknown)["error"], "not_found")

    def test_runtime_config_excludes_provider_secrets(self):
        handler = self.api_handler(path="/config.js?deployment=1")
        sentinel_dvla = "test-only-dvla-secret"
        sentinel_oneauto = "test-only-oneauto-secret"
        env = {
            "DVLA_API_KEY": sentinel_dvla,
            "ONEAUTO_API_KEY": sentinel_oneauto,
            "OSSETT_CONTACT_EMAIL": "team@example.test",
            "OSSETT_PHONE": "0114 123 4567",
        }
        with patch.dict("os.environ", env, clear=False):
            Handler.do_GET(handler)

        body = handler.wfile.getvalue().decode("utf-8")
        prefix = "window.OSSETT_CONFIG = Object.freeze("
        self.assertTrue(body.startswith(prefix))
        payload = json.loads(body[len(prefix) : -3])
        self.assertEqual(
            payload,
            {"contactEmail": "team@example.test", "phone": "0114 123 4567"},
        )
        self.assertNotIn(sentinel_dvla, body)
        self.assertNotIn(sentinel_oneauto, body)
        self.assertNotIn("backendBase", body)
        self.assertIn(call("Cache-Control", "no-store"), handler.send_header.call_args_list)

    def test_post_rejects_bad_content_and_payload_shapes(self):
        cases = [
            ({"Content-Type": "text/plain"}, VALID_PAYLOAD, HTTPStatus.UNSUPPORTED_MEDIA_TYPE),
            ({"Transfer-Encoding": "chunked"}, VALID_PAYLOAD, HTTPStatus.BAD_REQUEST),
            ({"Content-Encoding": "gzip"}, VALID_PAYLOAD, HTTPStatus.BAD_REQUEST),
            ({"Content-Length": "nope"}, VALID_PAYLOAD, HTTPStatus.BAD_REQUEST),
            ({"Content-Length": str(MAX_REQUEST_BODY + 1)}, VALID_PAYLOAD, HTTPStatus.REQUEST_ENTITY_TOO_LARGE),
            ({}, [VALID_PAYLOAD], HTTPStatus.BAD_REQUEST),
            ({}, {**VALID_PAYLOAD, "unexpected": True}, HTTPStatus.BAD_REQUEST),
            ({}, {**VALID_PAYLOAD, "registrationNumber": "../bad"}, HTTPStatus.BAD_REQUEST),
            ({}, {**VALID_PAYLOAD, "customerName": "A" * 81}, HTTPStatus.BAD_REQUEST),
            ({}, {**VALID_PAYLOAD, "customerPhone": "123"}, HTTPStatus.BAD_REQUEST),
        ]
        for headers, payload, expected_status in cases:
            with self.subTest(headers=headers, payload_type=type(payload).__name__):
                handler = self.api_handler(body=payload, headers=headers)
                Handler.do_POST(handler)
                handler.send_response.assert_called_once_with(expected_status)
                self.assertFalse(self.response_json(handler)["ok"])

    def test_post_returns_sanitized_lookup_json(self):
        handler = self.api_handler()
        response = {
            "ok": True,
            "dvla": {"make": "FORD", "colour": "BLUE", "yearOfManufacture": 2020},
            "tyres": {"fitments": [{"front": "225/45R17", "rear": "255/40R17"}]},
        }
        with patch("server.lookup_vehicle", return_value=response) as lookup:
            Handler.do_POST(handler)
        lookup.assert_called_once_with(VALID_PAYLOAD)
        handler.send_response.assert_called_once_with(HTTPStatus.OK)
        self.assertEqual(self.response_json(handler), response)
        self.assertIn(call("Cache-Control", "no-store"), handler.send_header.call_args_list)

    def test_post_sanitizes_unexpected_server_errors(self):
        handler = self.api_handler()
        with patch("server.lookup_cooldown", LookupCooldown(seconds=10)), patch(
            "server.lookup_vehicle",
            side_effect=RuntimeError("private-provider-detail"),
        ):
            Handler.do_POST(handler)

        handler.send_response.assert_called_once_with(HTTPStatus.INTERNAL_SERVER_ERROR)
        body = handler.wfile.getvalue().decode("utf-8")
        self.assertEqual(self.response_json(handler)["error"], "server_error")
        for private_value in (
            "private-provider-detail",
            VALID_PAYLOAD["registrationNumber"],
            VALID_PAYLOAD["customerName"],
            VALID_PAYLOAD["customerPhone"],
        ):
            self.assertNotIn(private_value, body)

    def test_post_applies_concurrency_cap_and_registration_cooldown(self):
        cooldown = LookupCooldown(seconds=10)
        slots = Mock()
        slots.acquire.return_value = False
        first = self.api_handler()
        first.client_address = ("192.0.2.10", 1234)
        with patch("server.lookup_cooldown", cooldown), patch(
            "server.lookup_slots", slots
        ), patch("server.lookup_vehicle") as lookup:
            Handler.do_POST(first)
        first.send_response.assert_called_once_with(HTTPStatus.SERVICE_UNAVAILABLE)
        self.assertEqual(self.response_json(first)["error"], "service_busy")
        slots.acquire.assert_called_once_with(blocking=False)
        slots.release.assert_not_called()
        lookup.assert_not_called()

        slots.reset_mock()
        slots.acquire.return_value = True
        response = {
            "ok": True,
            "dvla": {"make": "FORD", "colour": None, "yearOfManufacture": None},
            "tyres": {"fitments": []},
        }
        successful = self.api_handler()
        successful.client_address = ("192.0.2.10", 5678)
        with patch("server.lookup_cooldown", cooldown), patch(
            "server.lookup_slots", slots
        ), patch("server.lookup_vehicle", return_value=response):
            Handler.do_POST(successful)
        successful.send_response.assert_called_once_with(HTTPStatus.OK)
        slots.release.assert_called_once_with()

        slots.reset_mock()
        slots.acquire.return_value = True
        repeated = self.api_handler()
        repeated.client_address = ("192.0.2.10", 9012)
        with patch("server.lookup_cooldown", cooldown), patch(
            "server.lookup_slots", slots
        ), patch("server.lookup_vehicle") as lookup:
            Handler.do_POST(repeated)
        repeated.send_response.assert_called_once_with(HTTPStatus.TOO_MANY_REQUESTS)
        self.assertEqual(self.response_json(repeated)["error"], "rate_limit")
        self.assertTrue(
            any(
                header == call("Retry-After", "10")
                for header in repeated.send_header.call_args_list
            )
        )
        slots.release.assert_called_once_with()
        lookup.assert_not_called()

        slots.reset_mock()
        slots.acquire.return_value = True
        rotated = self.api_handler(
            body={**VALID_PAYLOAD, "registrationNumber": "XY34ZZZ"}
        )
        rotated.client_address = ("192.0.2.10", 3456)
        with patch("server.lookup_cooldown", cooldown), patch(
            "server.lookup_slots", slots
        ), patch("server.lookup_vehicle") as lookup:
            Handler.do_POST(rotated)
        rotated.send_response.assert_called_once_with(HTTPStatus.TOO_MANY_REQUESTS)
        self.assertEqual(self.response_json(rotated)["error"], "rate_limit")
        self.assertIn(call("Retry-After", "2"), rotated.send_header.call_args_list)
        slots.release.assert_called_once_with()
        lookup.assert_not_called()

    def test_post_uses_json_errors_for_unknown_routes(self):
        handler = self.api_handler(path="/api/missing")
        Handler.do_POST(handler)
        handler.send_response.assert_called_once_with(HTTPStatus.NOT_FOUND)
        self.assertEqual(self.response_json(handler)["error"], "not_found")

    def test_security_headers_are_added(self):
        handler = object.__new__(Handler)
        handler.send_header = Mock()
        with patch.object(SimpleHTTPRequestHandler, "end_headers") as parent_end:
            Handler.end_headers(handler)
        self.assertEqual(
            handler.send_header.call_args_list,
            [
                call("X-Content-Type-Options", "nosniff"),
                call("Referrer-Policy", "strict-origin-when-cross-origin"),
            ],
        )
        parent_end.assert_called_once_with()


class LookupTests(unittest.TestCase):
    def test_cooldown_hashes_registration_and_scopes_by_client(self):
        cooldown = LookupCooldown(seconds=10, client_seconds=2)
        self.assertEqual(cooldown.check_and_record("192.0.2.1", "AB12CDE", now=100), 0)
        self.assertEqual(cooldown.check_and_record("192.0.2.1", "AB12CDE", now=100), 10)
        self.assertEqual(cooldown.check_and_record("192.0.2.1", "XY34ZZZ", now=100), 2)
        self.assertEqual(cooldown.check_and_record("192.0.2.1", "XY34ZZZ", now=102), 0)
        self.assertEqual(cooldown.check_and_record("192.0.2.1", "AB12CDE", now=109.2), 1)
        self.assertEqual(cooldown.check_and_record("192.0.2.2", "AB12CDE", now=100), 0)
        self.assertEqual(cooldown.check_and_record("192.0.2.1", "AB12CDE", now=110), 0)
        self.assertNotIn("AB12CDE", repr(cooldown._recent))
        self.assertNotIn("192.0.2.1", repr(cooldown._clients))

    def test_normalizes_exact_lookup_contract(self):
        self.assertEqual(
            normalise_lookup_payload(
                {
                    "registrationNumber": " ab12 cde ",
                    "customerName": "  Ada   Lovelace ",
                    "customerPhone": " 07380   439443 ",
                }
            ),
            VALID_PAYLOAD,
        )

    def test_missing_secrets_make_no_upstream_requests(self):
        requester = Mock()
        with patch.dict("os.environ", {}, clear=True):
            with self.assertRaises(ApiError) as caught:
                lookup_vehicle(VALID_PAYLOAD, requester=requester)
        self.assertEqual(caught.exception.status, HTTPStatus.SERVICE_UNAVAILABLE)
        requester.assert_not_called()

    def test_missing_oneauto_key_preserves_sanitized_dvla_result(self):
        requester = Mock(return_value=(200, None, {"make": "FORD"}))
        with patch.dict("os.environ", {"DVLA_API_KEY": "sentinel-a"}, clear=True):
            result = lookup_vehicle(VALID_PAYLOAD, requester=requester)

        requester.assert_called_once()
        self.assertEqual(result["dvla"]["make"], "FORD")
        self.assertEqual(result["tyres"], {"error": "temporarily_unavailable"})

    def test_uses_fixed_hosts_and_returns_only_sanitized_fields(self):
        sentinel_dvla = "test-only-dvla-secret"
        sentinel_oneauto = "test-only-oneauto-secret"
        calls = []
        replies = iter(
            [
                (
                    200,
                    None,
                    {
                        "make": "FORD",
                        "colour": "BLUE",
                        "yearOfManufacture": 2020,
                        "registrationNumber": "AB12CDE",
                    },
                ),
                (
                    200,
                    None,
                    {
                        "success": True,
                        "result": {
                            "dvla_data": {
                                "vehicle_identification_number": "VIN-MUST-NOT-LEAK",
                                "engine_number": "ENGINE-MUST-NOT-LEAK",
                            },
                            "oe_data": {
                                "modelIDs": [
                                    {
                                        "tyre_size_front": "225/45 R17 91W",
                                        "tyre_size_rear": "255/40R17",
                                        "drd_model_name": "provider metadata",
                                    }
                                ]
                            },
                        },
                    },
                ),
            ]
        )

        def requester(*args):
            calls.append(args)
            return next(replies)

        with patch.dict(
            "os.environ",
            {"DVLA_API_KEY": sentinel_dvla, "ONEAUTO_API_KEY": sentinel_oneauto},
            clear=True,
        ):
            result = lookup_vehicle(VALID_PAYLOAD, requester=requester)

        self.assertEqual(len(calls), 2)
        self.assertEqual(calls[0][0:3], (DVLA_HOST, "POST", DVLA_PATH))
        self.assertEqual(calls[0][3]["x-api-key"], sentinel_dvla)
        self.assertEqual(calls[0][4], b'{"registrationNumber":"AB12CDE"}')
        self.assertEqual(calls[0][5], MAX_DVLA_RESPONSE)
        self.assertEqual(calls[1][0:2], (ONEAUTO_HOST, "GET"))
        self.assertEqual(
            calls[1][2],
            ONEAUTO_PATH + "?vehicle_registration_mark=AB12CDE",
        )
        self.assertEqual(calls[1][3]["x-api-key"], sentinel_oneauto)
        self.assertIsNone(calls[1][4])
        self.assertEqual(calls[1][5], MAX_ONEAUTO_RESPONSE)
        self.assertEqual(
            result,
            {
                "ok": True,
                "dvla": {"make": "FORD", "colour": "BLUE", "yearOfManufacture": 2020},
                "tyres": {"fitments": [{"front": "225/45R17", "rear": "255/40R17"}]},
            },
        )
        serialized = json.dumps(result)
        for forbidden in (
            sentinel_dvla,
            sentinel_oneauto,
            "VIN-MUST-NOT-LEAK",
            "ENGINE-MUST-NOT-LEAK",
            VALID_PAYLOAD["customerName"],
            VALID_PAYLOAD["customerPhone"],
            VALID_PAYLOAD["registrationNumber"],
        ):
            self.assertNotIn(forbidden, serialized)

    def test_dvla_timeout_and_invalid_registration_are_safely_mapped(self):
        env = {"DVLA_API_KEY": "sentinel-a", "ONEAUTO_API_KEY": "sentinel-b"}
        with patch.dict("os.environ", env, clear=True):
            with self.assertRaises(ApiError) as timeout:
                lookup_vehicle(
                    VALID_PAYLOAD,
                    requester=lambda *_args: (_ for _ in ()).throw(UpstreamError("timeout")),
                )
            self.assertEqual(timeout.exception.status, HTTPStatus.GATEWAY_TIMEOUT)

            with self.assertRaises(ApiError) as invalid:
                lookup_vehicle(
                    VALID_PAYLOAD,
                    requester=lambda *_args: (404, None, {"message": "raw provider detail"}),
                )
            self.assertEqual(invalid.exception.status, HTTPStatus.BAD_REQUEST)
            self.assertNotIn("raw provider detail", invalid.exception.message)

    def test_oneauto_transport_failure_returns_safe_partial_result(self):
        calls = 0

        def requester(*_args):
            nonlocal calls
            calls += 1
            if calls == 1:
                return 200, None, {"make": "FORD"}
            raise UpstreamError("unavailable")

        with patch.dict(
            "os.environ",
            {"DVLA_API_KEY": "sentinel-a", "ONEAUTO_API_KEY": "sentinel-b"},
            clear=True,
        ):
            result = lookup_vehicle(VALID_PAYLOAD, requester=requester)
        self.assertEqual(result["dvla"]["make"], "FORD")
        self.assertEqual(result["tyres"], {"error": "temporarily_unavailable"})

    def test_oneauto_http_failures_preserve_sanitized_dvla_result(self):
        for oneauto_status in (401, 403, 429, 500):
            with self.subTest(oneauto_status=oneauto_status):
                replies = iter(
                    [
                        (200, None, {"make": "FORD"}),
                        (oneauto_status, "5", {"error": "private-provider-detail"}),
                    ]
                )
                with patch.dict(
                    "os.environ",
                    {"DVLA_API_KEY": "sentinel-a", "ONEAUTO_API_KEY": "sentinel-b"},
                    clear=True,
                ):
                    result = lookup_vehicle(
                        VALID_PAYLOAD,
                        requester=lambda *_args: next(replies),
                    )
                self.assertEqual(result["dvla"]["make"], "FORD")
                self.assertEqual(
                    result["tyres"],
                    {"error": "temporarily_unavailable"},
                )

    def test_upstream_body_limits_and_tyre_canonicalization(self):
        oversized = FakeResponse(body=b"x" * 11)
        with self.assertRaises(UpstreamError) as caught:
            _bounded_response_body(oversized, 10)
        self.assertEqual(caught.exception.kind, "too_large")

        declared = FakeResponse(body=b"{}", headers={"Content-Length": "999"})
        with self.assertRaises(UpstreamError):
            _bounded_response_body(declared, 10)

        compressed = FakeResponse(body=b"{}", headers={"Content-Encoding": "gzip"})
        with self.assertRaises(UpstreamError):
            _bounded_response_body(compressed, 10)

        wrong_media_type = FakeResponse(
            body=b"{}",
            headers={"Content-Type": "text/html"},
        )
        with self.assertRaises(UpstreamError) as wrong_type:
            _bounded_response_body(wrong_media_type, 10)
        self.assertEqual(wrong_type.exception.kind, "malformed")

        valid_json = FakeResponse(
            body=b"{}",
            headers={"Content-Type": "application/json; charset=utf-8"},
        )
        self.assertEqual(_bounded_response_body(valid_json, 10), b"{}")

        self.assertEqual(canonical_tyre_size("225 / 45 R 17 91W"), "225/45R17")
        self.assertIsNone(canonical_tyre_size("999/10R99"))


if __name__ == "__main__":
    unittest.main()
