# Ossett Tyres

A dependency-free Ossett Tyres website with a small client-side application, Python server/API boundary, existing DVLA/One Auto vehicle lookup, and a configurable TyreScope ecommerce boundary. No package installation or compile build step is required.

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
- `/tyre-enquiry` — Standalone vehicle and tyre availability enquiry form
- `/order-your-tyres-online` — Tyre availability enquiry

The tyre route shows the official TyreScope ecommerce experience only when an
account-specific `TYRESCOPE_EMBED_URL` has been supplied. Without it, the
existing registration lookup and direct workshop fallback remain available.

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

TyreScope and future procurement configuration is documented in
[`docs/tyrescope-integration.md`](docs/tyrescope-integration.md). The live
TyreScope embed is intentionally disabled until Ossett receives the official
account-specific installation URL/snippet. No TyreScope/Bond supplier API calls
are implemented without an official contract.

Never add live values to `config.js`, `.env.example`, source files, or Git. The committed `.env.example` contains blank placeholders only. A local `.env` file is ignored, but this dependency-free server does not load it automatically; export the variables into the process environment before running `npm start`. If the DVLA key is absent, the endpoint returns a safe `503` error. If only the One Auto key is absent or its service is unavailable, the page still shows sanitized vehicle details and directs the visitor to call for tyre sizing and stock.

The endpoint is intentionally same-origin and does not enable CORS. It enforces a small JSON request limit, strict input validation, upstream timeouts and response limits, and sanitizes all provider data before responding.

General enquiries use a pre-filled `mailto:` handoff because no confirmed enquiry API deployment was supplied.

The standalone tyre-enquiry route is separate from TyreScope. It uses the same
DVLA/One Auto lookup, then collects front/rear tyre sizes, quantities, budget,
brand preference and customer contact details. The browser validates the
complete request and posts it directly to Web3Forms' official submission
endpoint. This follows Web3Forms' supported client-side integration model; no
undocumented provider proxy is used. The route does not show live stock,
calculate a price, take payment or create an order.

Configure the enquiry delivery key in the Vercel environment:

```text
WEB3FORMS_ACCESS_KEY
```

Web3Forms documents its access key as a public identifier designed to be used in
browser requests. The active value is still kept out of source so each
deployment can use the correct Ossett account. Enable Web3Forms spam protection
and, where the account supports them, CAPTCHA and domain restrictions before
production traffic. Enquiry delivery is email-only; a future staff dashboard
will require persistent server-side storage. Customer contact and vehicle data
is processed by Web3Forms, so the site's privacy notice and supplier review
should cover that processor.

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
- `WEB3FORMS_ACCESS_KEY` supplies the browser-safe Web3Forms public access key
  used for standalone tyre-enquiry email delivery.
- `OSSETT_CONTACT_EMAIL` changes the general-enquiry email address.
- `OSSETT_PHONE` changes the telephone number used by call and WhatsApp links.
- `TYRESCOPE_EMBED_URL` activates the official public HTTPS ecommerce embed.
- `TYRESCOPE_ACCOUNT_ID` is kept server-side pending official integration instructions.
- `PROCUREMENT_AUTO_ENABLED` is the Ossett application feature flag and defaults to `false`.

The remaining inventory and procurement safety variables are listed in
`.env.example` and explained in the integration document. Mock stock, mock
supplier results, and in-memory persistence are test-only; production never
selects them silently.

The server generates `/config.js` with browser-safe contact configuration and
the public Web3Forms access key at request time. Private DVLA, One Auto,
TyreScope and supplier credentials remain process-only and are never included
in that response. `config.js` remains a safe local-file fallback with blank
third-party configuration.

The HTTP server has an explicit public allowlist for the application files and image assets. Repository metadata, source-only files, tests, tools, generated artifacts, and directory listings return `404`.

On Vercel, `api/config.py` supplies runtime-safe public configuration and
`api/dvla.py` supplies the existing same-origin lookup as Python Functions.
