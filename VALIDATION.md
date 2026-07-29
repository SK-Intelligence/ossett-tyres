# Validation

The implementation was compared with the five approved 1920px-wide reference captures and rendered locally at 1920, 1440, 768, and 390 CSS pixels.

## Visual results

Visual Ralph iteration 3 passed at 96/100:

- Home: 94
- Services: 95
- Blog: 96
- Contact: 97
- Order: 98

The final post-cleanup 1920px pixel comparisons were:

| Page | Pixel similarity | Reference height | Local height |
| --- | ---: | ---: | ---: |
| Home | 93.82% | 4259 | 4296 |
| Services | 95.15% | 2651 | 2655 |
| Blog | 95.72% | 1589 | 1602 |
| Contact | 97.38% | 2141 | 2163 |
| Order | 98.43% | 1004 | 998 |

Full-page screenshots, audit JSON, overlays, and pixel-difference images are retained locally under `artifacts/generated/` and `.omx/artifacts/visual-ralph/ossett-tyres/`. They are ignored by Git to keep the application repository lean.

## Runtime audits

The five primary routes were recaptured and audited across all four viewport widths after the final correctness and security pass. Both article routes were additionally recaptured and audited at 1440, 768, and 390px. Every audit reported:

- document width exactly equal to viewport width;
- no horizontal overflow;
- no JavaScript errors;
- no broken images;
- no broken internal links or dead hash links;
- no duplicate IDs;
- exactly one active navigation item.

The interaction harness also exercised the following browser flows at 390px:

- opening the mobile menu set `aria-expanded="true"`, applied the scroll lock, and displayed the 261px panel;
- selecting Services from the open menu navigated to `/services`, removed `menu-open`, restored `overflow-y: auto`, closed the panel, and focused `#main-content`;
- rotating an open 390px menu to desktop width removed the scroll lock, reset `aria-expanded`, and restored the desktop navigation;
- selecting the skip link navigated to `#main-content` and focused the main landmark;
- initial hash navigation and a simulated browser `popstate` both restored focus to the current main landmark;
- accepting the cookie notice persisted `accepted` in session storage and removed the notice;
- advancing and pausing reviews changed the track transform and accessible pause label;
- submitting a valid unconfigured tyre lookup normalized `ab12 cde!!` to `AB12CDE` and rendered working email and telephone fallback links.

An additional 1024px boundary capture verified that carousel controls remain inside the page and the menu-reset rotation state has no horizontal overflow.

## Automated checks

`npm test` runs 11 JavaScript assertions covering contact-link normalization, validation, the exact backend payload, vehicle/fitment parsing, error classes, both pre-header and stalled-body timeouts, independent route wiring, and navigation regressions. It then runs 8 Python tests covering the exact route set, public-file allowlisting, source/directory denial, GET/HEAD parity, traversal rejection, response headers, and environment-generated runtime configuration.

`npm run check` checks JavaScript syntax and compiles the Python server module.

The managed execution sandbox prevents binding a listening socket, so the HTTP server was validated with handler-level tests rather than a loopback request. The same server starts with `npm start` in a normal local environment.

## Known deployment dependency

Live tyre lookup requires the `OSSETT_BACKEND_BASE` deployment environment variable to point at the deployed HTTPS backend origin, and that backend must allow the frontend origin through CORS. With no confirmed production backend origin, the form intentionally exposes an email/telephone enquiry path instead of returning a false successful lookup.
