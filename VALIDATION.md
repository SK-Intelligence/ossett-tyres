# Validation

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
`npm test` passes 12 Node assertions and 23 Python tests. Coverage includes:

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
