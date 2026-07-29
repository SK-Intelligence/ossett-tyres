# Ossett Tyres

A dependency-free, responsive recreation of the Ossett Tyres website. The site is a small client-side application served by Python's standard library, so no package installation or build step is required.

## Run locally

```sh
npm start
```

Open <http://localhost:4173>.

## Pages

- `/` — Home
- `/services` — Services, gallery, opening hours, and location
- `/blog` — Blog listing
- `/blog-post`, `/blog-post1` — Blog articles
- `/contact-us` — General enquiry, tyre enquiry, hours, and location
- `/order-your-tyres-online` — Tyre availability enquiry

The server supports direct navigation and browser refreshes on every route.

## Tyre lookup backend

Set `OSSETT_BACKEND_BASE` to the deployed origin of the separately owned Ossett Tyres backend. The frontend sends:

```json
{
  "registrationNumber": "AB12CDE",
  "customerName": "Customer Name",
  "customerPhone": "07123 456789"
}
```

to `POST {backendBase}/api/dvla`. The form deliberately stays in manual-enquiry mode when no backend origin is configured; it does not guess a production URL. The current backend CORS allowlist must include the frontend origin before browser requests from a new deployment or localhost will work.

General enquiries use a pre-filled `mailto:` handoff because no confirmed enquiry API deployment was supplied.

## Checks

```sh
npm run check
npm test
```

The macOS WebKit capture utility can render and audit a route without third-party packages:

```sh
swift tools/capture.swift / 1440 1000 artifacts/generated/home-1440.png
```

It reports JavaScript errors, broken images and internal links, duplicate IDs, active navigation state, and horizontal overflow before writing a full-page PNG.

## Configuration

- `PORT` changes the server port from the default `4173`.
- `OSSETT_BACKEND_BASE` sets the HTTPS backend origin without a trailing slash.
- `OSSETT_CONTACT_EMAIL` changes the general-enquiry email address.
- `OSSETT_PHONE` changes the telephone number used by call and WhatsApp links.

The server generates `/config.js` from these environment variables at request time, so deployments do not require source edits. `config.js` remains a safe local-file fallback with the same defaults. If `OSSETT_BACKEND_BASE` is unset, tyre searches intentionally offer the manual email/call handoff.

The HTTP server has an explicit public allowlist for the application files and image assets. Repository metadata, source-only files, tests, tools, generated artifacts, and directory listings return `404`.
