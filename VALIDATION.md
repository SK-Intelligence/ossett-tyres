# Validation

## TyreScope and procurement integration — 30 August 2026

The `/order-your-tyres-online` route now has four explicit TyreScope states:
loading, ready, error, and unavailable. The official embed URL is not present,
so production-safe fallback behavior remains the active state. The existing
DVLA/One Auto vehicle enquiry, call, and email paths remain available.

Fresh WebKit full-page captures cover all seven routes at 1440px, 768px, and
390px under `artifacts/tyrescope-validation/missing/`. Every capture reported:

- document width equal to viewport width;
- no page-level horizontal overflow;
- no JavaScript errors;
- no broken images or internal links;
- no dead hash links or duplicate IDs;
- correct active navigation.

Additional non-purchasing layout fixtures captured the configured TyreScope
surface at 1440px, 768px, and 390px and the error/fallback surface at 390px.
These fixtures validate responsive composition only; they are not an official
TyreScope sandbox and cannot place an order.

The repository includes `tests/browser_validation.py`, a native Playwright
suite for all routes plus configured/missing/error iframe behavior. Playwright
and Chromium are installed, but the managed macOS sandbox blocked Chromium at
process startup (`MachPortRendezvousServer: Permission denied`) and also blocks
new listening sockets. The suite therefore remains ready to run in a normal
local/CI environment, while rendered evidence in this environment was produced
with the repository's WebKit harness.

`npm run check` passes JavaScript syntax checks and Python compilation,
including both Vercel functions and all tyre-domain modules. `npm test` passes
12 existing Node assertions, the tyre-enquiry and TyreScope behavioral suites,
and 47 Python tests.
Procurement coverage includes all required shortfall cases, invalid input,
inventory unavailability, supplier out-of-stock/wrong-SKU/price failure,
wrong currency, automatic procurement disabled, atomic/concurrent duplicate
blocking, timeouts, ambiguous or mismatched supplier confirmations, explicit
unconfigured production adapters, and a test-only success.

`git diff --check` passes. No formatter, formal linter, static typechecker, or
compile build command exists in this dependency-free repository. The Vercel CLI
is not installed in the managed environment, so `vercel build` could not be run;
`vercel.json` parsing and Python Function imports were checked directly instead.

The completed implementation was rechecked on 4 August 2026 after the cookie,
brand-logo, interactive-map, and same-origin tyre-lookup changes.

## Visual and responsive results

The post-edit Visual Ralph verdict passed at 95/100. Fresh full-page captures
covered every primary route at 1440, 768, and 390 CSS pixels:

- `/`
- `/services`
- `/blog`
- `/contact-us`
- `/order-your-tyres-online`

All 15 route/viewport audits reported the document width equal to the viewport,
no page-level horizontal overflow, no JavaScript errors, no broken images, no
broken internal links, no dead hashes, no duplicate IDs, and the correct active
navigation item. The offscreen Home review cards reported at 768px and 390px are
intentional clipped carousel children; the document itself does not overflow.

The Home page was also captured at 390px after accepting the cookie notice. All
20 local logo images were visible and resolved, with no text-only substitutes.
Initial desktop and mobile captures confirmed the cookie panel remains fixed at
the viewport bottom; accepting it persisted the session choice and removed it.

The Services and Contact pages use an interactive Google Maps iframe, with the
owned map crop and a direct Google Maps link as progressive fallbacks. The
managed WebKit harness cannot load the third-party iframe, so its captures show
the fallback. The iframe markup, accessible title, lazy loading, responsive
dimensions, and direct link were verified; live pan and zoom need a final smoke
check in a normal networked browser.

## Interaction results

The 390px interaction harness verified:

- cookie acceptance stores `accepted` and removes the notice;
- the menu opens with `aria-expanded="true"` and locks page scrolling;
- selecting Services closes the menu, restores scrolling, and focuses the main
  landmark;
- the skip link focuses `#main-content`;
- review next/pause controls update the track and accessible label.

## Automated and security checks

`npm run check` passes JavaScript syntax checks and Python byte compilation.
`npm test` passes the 12-test site suite, the tyre-enquiry and TyreScope
behavioral suites, and 47 Python tests. Coverage includes:

- exact same-origin `POST /api/dvla` browser requests;
- input validation, request-size/media-type limits, aligned timeouts,
  per-client and per-registration cooldowns, and the concurrent lookup cap;
- exact fixed DVLA and One Auto `/v2` provider destinations;
- bounded upstream bodies and strict JSON media types;
- sanitized make, colour, year, and tyre fitments;
- preservation of sanitized DVLA results when One Auto is absent, rate-limited,
  misconfigured, or unavailable;
- exclusion of credentials, VIN, engine number, registration, name, phone, and
  raw provider data from browser-visible responses;
- JSON API errors and prevention of `/api/*` SPA fallthrough;
- the strict static-file allowlist and traversal rejection.

`git diff --check` also passes. A credential-pattern audit of tracked files
found only blank placeholders in `.env.example`; `.env` and `.env.*` remain
ignored.

The managed execution environment blocks listening sockets, so the server's
HTTP behavior was exercised through handler-level tests rather than a loopback
request. `npm start` remains the normal local command outside this sandbox.

## Standalone tyre-enquiry validation — 30 August 2026

- Added `/tyre-enquiry` as a separate enquiry journey; it does not call or
  depend on TyreScope.
- Unit coverage validates customer fields, registration, tyre-size syntax,
  front/rear quantities, budget tiers, honeypot handling, provider payloads,
  missing configuration and stale vehicle-lookup protection.
- Client tests verify the fixed official Web3Forms endpoint, browser-safe public
  key configuration, provider rejection, rate limits, malformed responses and
  timeout behavior without sending a real email.
- WebKit rendered the initial and expanded/manual states at 1440px, 768px and
  390px under `artifacts/enquiry-validation/`.
- Each rendered audit reported exact viewport width, no horizontal overflow,
  no JavaScript errors, no broken images or internal links, no dead hashes and
  no duplicate IDs.
- Native Playwright interaction coverage is implemented in
  `tests/browser_validation.py`. Chromium cannot launch inside the current
  managed macOS environment because Mach-port registration is denied before a
  page opens; this is an environment limitation rather than an application
  failure.
- Web3Forms is intentionally called from the browser in accordance with the
  provider's documented integration contract. Delivery is email-only and no
  persistent enquiry record or staff dashboard exists yet.
- The form now discloses that contact and vehicle details pass through
  Web3Forms and links directly to the provider's privacy policy before the send
  action.
