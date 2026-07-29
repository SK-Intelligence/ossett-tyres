"""Route and exposure tests for the SPA server without binding a socket."""

import io
import json
import unittest
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler
from pathlib import Path
from unittest.mock import Mock, call, patch

from server import Handler, PUBLIC_FILES, ROUTES


ROOT = Path(__file__).resolve().parent.parent


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

    def test_runtime_config_uses_environment_and_does_not_write_a_head_body(self):
        handler = object.__new__(Handler)
        handler.path = "/config.js?deployment=1"
        handler.send_response = Mock()
        handler.send_header = Mock()
        handler.end_headers = Mock()
        handler.send_error = Mock()
        handler.wfile = io.BytesIO()

        env = {
            "OSSETT_BACKEND_BASE": " https://api.example.test/ ",
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
            {
                "backendBase": "https://api.example.test",
                "contactEmail": "team@example.test",
                "phone": "0114 123 4567",
            },
        )
        handler.send_response.assert_called_once_with(HTTPStatus.OK)
        self.assertIn(call("Cache-Control", "no-store"), handler.send_header.call_args_list)
        handler.send_error.assert_not_called()

        head_handler = object.__new__(Handler)
        head_handler.path = "/config.js"
        head_handler.send_response = Mock()
        head_handler.send_header = Mock()
        head_handler.end_headers = Mock()
        head_handler.send_error = Mock()
        head_handler.wfile = io.BytesIO()
        Handler.do_HEAD(head_handler)
        self.assertEqual(head_handler.wfile.getvalue(), b"")
        head_handler.send_error.assert_not_called()

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


if __name__ == "__main__":
    unittest.main()
