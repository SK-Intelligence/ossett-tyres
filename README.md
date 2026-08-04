# Ossett Tyres

A dependency-free, responsive recreation of the Ossett Tyres website. The site is a small client-side application served by Python's standard library, so no package installation or build step is required.

## Run locally

For a visual check without the live vehicle lookup:

```sh
npm start
```

Open <http://localhost:4173>.

To test the live tyre lookup, create a private local environment file and add
your replacement credentials after the `=` signs:

```sh
cp .env.example .env
```

Then load that ignored file into the current shell before starting the server:

```sh
set -a
source .env
set +a
npm start
```

The supplied credentials should be rotated before deployment because they were
shared outside a secret manager. Keep their replacements only in `.env` locally
and in your hosting provider's secret settings in production.

## Pages

- `/` — Home
- `/services` — Services, gallery, opening hours, and location
- `/blog` — Blog listing
- `/blog-post`, `/blog-post1` — Blog articles
- `/contact-us` — General enquiry, tyre enquiry, hours, and location
- `/order-your-tyres-online` — Tyre availability enquiry

The server supports direct navigation and browser refreshes on every route.

## Tyre lookup backend

The site serves a same-origin `POST /api/dvla` endpoint. The frontend sends:

```json
{
  "registrationNumber": "AB12CDE",
  "customerName": "Customer Name",
  "customerPhone": "07123 456789"
}
```

The Python server validates that payload, requests vehicle data from DVLA, requests OE tyre fitment data from One Auto API, and returns only the make, colour, year, and sanitized tyre sizes needed by the page. Provider responses, API keys, VINs, engine numbers, and customer contact details are never returned to the browser.

Configure these names in your deployment platform's secret manager:

```text
DVLA_API_KEY
ONEAUTO_API_KEY
```

Never add live values to `config.js`, `.env.example`, source files, or Git. The committed `.env.example` contains blank placeholders only. A local `.env` file is ignored, but this dependency-free server does not load it automatically; export the variables into the process environment before running `npm start`. If the DVLA key is absent, the endpoint returns a safe `503` error. If only the One Auto key is absent or its service is unavailable, the page still shows sanitized vehicle details and directs the visitor to call for tyre sizing and stock.

The endpoint is intentionally same-origin and does not enable CORS. It enforces a small JSON request limit, strict input validation, upstream timeouts and response limits, and sanitizes all provider data before responding.

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
- `DVLA_API_KEY` configures the server-side DVLA Vehicle Enquiry request.
- `ONEAUTO_API_KEY` configures the server-side One Auto OE tyre-fitment request.
- `OSSETT_CONTACT_EMAIL` changes the general-enquiry email address.
- `OSSETT_PHONE` changes the telephone number used by call and WhatsApp links.

The server generates `/config.js` with browser-safe contact configuration at request time. API credentials remain process-only and are never included in that response. `config.js` remains a safe local-file fallback with the same contact defaults.

The HTTP server has an explicit public allowlist for the application files and image assets. Repository metadata, source-only files, tests, tools, generated artifacts, and directory listings return `404`.
