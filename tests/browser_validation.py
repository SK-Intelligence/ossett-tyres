"""Playwright smoke and responsive validation for the Ossett customer site.

Run through the webapp-testing skill's with_server.py helper. The configured
TyreScope frame is fulfilled with a local test document and cannot place orders.
"""

from pathlib import Path
import json
import mimetypes
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "artifacts" / "tyrescope-validation"
MISSING_BASE_URL = "https://ossett.test"
CONFIGURED_BASE_URL = "https://configured.ossett.test"
MANUAL_BASE_URL = "https://manual.ossett.test"
ROUTES = (
    "/",
    "/services",
    "/blog",
    "/contact-us",
    "/tyre-enquiry",
    "/order-your-tyres-online",
    "/blog-post",
    "/blog-post1",
)
VIEWPORTS = (
    (1440, 1000),
    (768, 1024),
    (390, 844),
)


def slug(route):
    return "home" if route == "/" else route.strip("/").replace("/", "-")


def assert_no_overflow(page, label):
    result = page.evaluate(
        """() => ({
          viewport: document.documentElement.clientWidth,
          document: document.documentElement.scrollWidth,
          body: document.body.scrollWidth,
        })"""
    )
    assert result["document"] <= result["viewport"], f"horizontal overflow {label}: {result}"
    assert result["body"] <= result["viewport"], f"body overflow {label}: {result}"


def configured_frame(route):
    route.fulfill(
        status=200,
        content_type="text/html",
        body="""<!doctype html><html lang="en"><body style="margin:0;font:16px sans-serif">
          <main style="min-height:660px;padding:32px;background:#fff">
            <h1>TyreScope test sandbox</h1>
            <p>Mocked browser-validation content. No supplier or purchase connection.</p>
            <label>Registration <input aria-label="Registration" /></label>
            <button type="button">Search test tyres</button>
          </main></body></html>""",
    )


def application_route(route):
    request_url = urlsplit(route.request.url)
    if request_url.hostname == "api.web3forms.com" and route.request.method == "POST":
        route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps({"success": True, "message": "Enquiry sent"}),
        )
        return
    if request_url.hostname == "tyrescope.test":
        if request_url.path == "/unanswered":
            route.abort("timedout")
            return
        configured_frame(route)
        return
    if request_url.hostname not in {"ossett.test", "configured.ossett.test", "manual.ossett.test"}:
        route.abort()
        return

    path = request_url.path
    if path == "/api/dvla" and route.request.method == "POST":
        if request_url.hostname == "manual.ossett.test":
            route.fulfill(
                status=503,
                content_type="application/json",
                body=json.dumps({"ok": False, "error": "service_unavailable"}),
            )
        else:
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({
                    "ok": True,
                    "dvla": {"make": "FORD", "colour": "BLUE", "yearOfManufacture": 2020},
                    "tyres": {"fitments": [{"front": "225/45R17", "rear": "255/40R17"}]},
                }),
            )
        return
    if path == "/config.js":
        embed_url = "https://tyrescope.test/embed" if request_url.hostname == "configured.ossett.test" else ""
        payload = {
            "contactEmail": "ossettwholesale@gmail.com",
            "phone": "07380439443",
            "tyrescopeEmbedUrl": embed_url,
            "web3FormsAccessKey": "123e4567-e89b-42d3-a456-426614174111",
        }
        route.fulfill(
            status=200,
            content_type="application/javascript",
            body=f"window.OSSETT_CONFIG = Object.freeze({json.dumps(payload)});",
        )
        return

    target = ROOT / path.lstrip("/")
    if path == "/" or not target.is_file():
        target = ROOT / "index.html"
    content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
    route.fulfill(status=200, content_type=content_type, body=target.read_bytes())


def validate_all_routes(browser):
    errors = []
    for width, height in VIEWPORTS:
        context = browser.new_context(viewport={"width": width, "height": height})
        context.add_init_script("sessionStorage.setItem('ossett-cookie-choice', 'accepted')")
        context.route("**/*", application_route)
        page = context.new_page()
        page.on("console", lambda message: errors.append(f"console {message.type}: {message.text}") if message.type == "error" else None)
        page.on("pageerror", lambda error: errors.append(f"pageerror: {error}"))
        for route in ROUTES:
            page.goto(f"{MISSING_BASE_URL}{route}", wait_until="networkidle")
            page.locator("#main-content").wait_for(state="visible")
            assert page.locator("header.site-header").count() == 1
            assert page.locator("footer.site-footer").count() == 1
            assert page.locator('a[href="/order-your-tyres-online"]').count() >= 1
            assert_no_overflow(page, f"{route} at {width}px")
            page.screenshot(
                path=OUTPUT / "missing" / f"{slug(route)}-{width}.png",
                full_page=True,
            )

        if width == 390:
            page.goto(f"{MISSING_BASE_URL}/", wait_until="networkidle")
            menu = page.get_by_role("button", name="Open navigation")
            menu.click()
            assert menu.get_attribute("aria-expanded") == "true"
            page.keyboard.press("Escape")
            assert menu.get_attribute("aria-expanded") == "false"
            assert menu.evaluate("element => element === document.activeElement")

            page.goto(f"{MISSING_BASE_URL}/order-your-tyres-online", wait_until="networkidle")
            assert page.locator('[data-tyrescope-state="unavailable"]').count() == 1
            assert page.locator("[data-tyrescope-fallback]").is_visible()
            assert page.get_by_role("button", name="Check availability").is_visible()
        context.close()
    assert not errors, "\n".join(errors)


def validate_configured_and_error_states(browser):
    errors = []
    for width, height in VIEWPORTS:
        context = browser.new_context(viewport={"width": width, "height": height})
        context.add_init_script("sessionStorage.setItem('ossett-cookie-choice', 'accepted')")
        context.route("**/*", application_route)
        page = context.new_page()
        page.on("console", lambda message: errors.append(f"console {message.type}: {message.text}") if message.type == "error" else None)
        page.on("pageerror", lambda error: errors.append(f"pageerror: {error}"))
        page.goto(f"{CONFIGURED_BASE_URL}/order-your-tyres-online", wait_until="networkidle")
        page.locator('[data-tyrescope-state="ready"]').wait_for()
        frame = page.frame_locator("[data-tyrescope-frame]")
        assert frame.get_by_role("heading", name="TyreScope test sandbox").is_visible()
        assert page.locator("[data-tyrescope-fallback]").is_hidden()
        assert_no_overflow(page, f"configured order page at {width}px")
        page.screenshot(
            path=OUTPUT / "configured" / f"order-{width}.png",
            full_page=True,
        )
        context.close()

    context = browser.new_context(viewport={"width": 390, "height": 844})
    context.add_init_script("sessionStorage.setItem('ossett-cookie-choice', 'accepted')")
    context.route("**/*", application_route)
    page = context.new_page()
    page.goto(f"{CONFIGURED_BASE_URL}/order-your-tyres-online", wait_until="networkidle")
    page.locator('[data-tyrescope-state="ready"]').wait_for()
    page.locator("[data-tyrescope-frame]").evaluate("frame => frame.dispatchEvent(new Event('error'))")
    # The real error listener is once-only and removed after load; remount into the
    # same DOM against an intentionally failed mock request to exercise fallback.
    page.evaluate(
        """() => {
          const container = document.querySelector('[data-tyrescope-embed]');
          const frame = container.querySelector('[data-tyrescope-frame]');
          frame.removeAttribute('src');
          window.OssettTyreScope.mount(container, { tyrescopeEmbedUrl: 'https://tyrescope.test/unanswered' }, { timeoutMs: 20 });
        }"""
    )
    page.locator('[data-tyrescope-state="error"]').wait_for()
    assert page.locator("[data-tyrescope-fallback]").is_visible()
    assert page.get_by_role("button", name="Check availability").is_visible()
    assert_no_overflow(page, "TyreScope error fallback at 390px")
    page.screenshot(path=OUTPUT / "error" / "order-390.png", full_page=True)
    context.close()
    assert not errors, "\n".join(errors)


def validate_enquiry_flow(browser):
    errors = []
    for width, height in VIEWPORTS:
        context = browser.new_context(viewport={"width": width, "height": height})
        context.add_init_script("sessionStorage.setItem('ossett-cookie-choice', 'accepted')")
        context.route("**/*", application_route)
        page = context.new_page()
        page.on("console", lambda message: errors.append(f"console {message.type}: {message.text}") if message.type == "error" else None)
        page.on("pageerror", lambda error: errors.append(f"pageerror: {error}"))
        page.goto(f"{MISSING_BASE_URL}/tyre-enquiry", wait_until="networkidle")
        assert page.locator('[data-enquiry-step="2"]').is_hidden()
        page.get_by_label("Full name").fill("Ada Lovelace")
        page.get_by_label("Phone number").fill("07380 439443")
        page.get_by_label("Registration").fill("AB12CDE")
        page.get_by_role("button", name="Find vehicle").click()
        page.locator('[data-enquiry-step="2"]').wait_for(state="visible")
        assert "FORD" in page.locator("[data-enquiry-vehicle-summary]").inner_text()
        assert page.get_by_label("Suggested size").count() == 2
        page.get_by_label("Quantity").nth(0).fill("2")
        page.get_by_label("Quantity").nth(1).fill("0")
        page.get_by_label("Email address").fill("ada@example.test")
        page.get_by_role("button", name="Send tyre enquiry").click()
        page.locator("[data-enquiry-submit-status]").wait_for(state="visible")
        assert "Enquiry sent" in page.locator("[data-enquiry-submit-status]").inner_text()
        assert_no_overflow(page, f"completed enquiry at {width}px")
        page.screenshot(path=OUTPUT / "enquiry" / f"completed-{width}.png", full_page=True)
        context.close()

    context = browser.new_context(viewport={"width": 390, "height": 844})
    context.add_init_script("sessionStorage.setItem('ossett-cookie-choice', 'accepted')")
    context.route("**/*", application_route)
    page = context.new_page()
    page.goto(f"{MANUAL_BASE_URL}/tyre-enquiry", wait_until="networkidle")
    page.get_by_label("Full name").fill("Ada Lovelace")
    page.get_by_label("Phone number").fill("07380 439443")
    page.get_by_label("Registration").fill("AB12CDE")
    page.get_by_role("button", name="Find vehicle").click()
    page.get_by_role("button", name="Continue by entering tyre sizes manually").wait_for()
    page.get_by_role("button", name="Continue by entering tyre sizes manually").click()
    assert page.locator('[data-enquiry-step="2"]').is_visible()
    assert "manually" in page.locator("[data-enquiry-fitment-note]").inner_text().lower()
    assert_no_overflow(page, "manual enquiry fallback at 390px")
    page.screenshot(path=OUTPUT / "enquiry" / "manual-390.png", full_page=True)
    context.close()
    assert not errors, "\n".join(errors)


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        validate_all_routes(browser)
        validate_configured_and_error_states(browser)
        validate_enquiry_flow(browser)
        browser.close()
    print("Browser validation passed: 8 routes x 3 viewports plus TyreScope and enquiry interaction states")


if __name__ == "__main__":
    main()
