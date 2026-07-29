"use strict";

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const siteUtils = require("../site-utils.js");
const tyreApi = require("../tyre-api.js");

const tests = [];

function test(name, run) {
  tests.push({ name, run });
}

function mockResponse(status, body, headers = {}) {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value)]),
  );
  const text = typeof body === "string" ? body : body == null ? "" : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name) {
        return normalizedHeaders[String(name).toLowerCase()] || null;
      },
    },
    async text() {
      return text;
    },
  };
}

function clientReturning(status, body, headers) {
  return tyreApi.createClient({
    backendBase: "https://api.example.test",
    fetchImpl: async () => mockResponse(status, body, headers),
  });
}

const validInput = {
  name: "Ada Lovelace",
  phone: "07380 439443",
  registration: "AB12CDE",
};

test("normalizes formatted local and international contact links", () => {
  assert.equal(siteUtils.telephoneHref("0114 123 4567"), "01141234567");
  assert.equal(siteUtils.telephoneHref("+44 7380 439443"), "+447380439443");
  assert.equal(siteUtils.telephoneHref("0044 7380 439443"), "+447380439443");
  assert.equal(siteUtils.whatsappNumber("0114 123 4567"), "441141234567");
  assert.equal(siteUtils.whatsappNumber("07380 439443"), "447380439443");
  assert.equal(siteUtils.whatsappNumber("+44 7380 439443"), "447380439443");
  assert.equal(siteUtils.whatsappNumber("0044 7380 439443"), "447380439443");
});

test("normalizes input and builds the exact backend payload", () => {
  const normalized = tyreApi.normalizeLookupInput({
    name: "  Ada   Lovelace  ",
    phone: "  07380   439443 ",
    registration: " ab12 cde ",
  });
  assert.deepEqual({ ...normalized }, validInput);
  assert.deepEqual(tyreApi.buildLookupPayload(normalized), {
    registrationNumber: "AB12CDE",
    customerName: "Ada Lovelace",
    customerPhone: "07380 439443",
  });

  assert.throws(
    () => tyreApi.normalizeLookupInput({ ...validInput, name: "   " }),
    (error) => error.code === "INVALID_INPUT" && error.field === "name",
  );
  assert.throws(
    () => tyreApi.normalizeLookupInput({ ...validInput, phone: "----------" }),
    (error) => error.code === "INVALID_INPUT" && error.field === "phone",
  );
});

test("validates and normalizes the backend origin", () => {
  assert.equal(tyreApi.normalizeBackendBase(""), "");
  assert.equal(tyreApi.normalizeBackendBase("https://api.example.test/"), "https://api.example.test");
  assert.throws(
    () => tyreApi.normalizeBackendBase("http://api.example.test"),
    (error) => error.code === "CONFIG_ERROR",
  );
  assert.throws(
    () => tyreApi.normalizeBackendBase("https://api.example.test/backend"),
    (error) => error.code === "CONFIG_ERROR",
  );
  assert.equal(tyreApi.createClient({ backendBase: "" }).mode, "offline");
});

test("posts the exact lookup request and separates vehicle and fitment data", async () => {
  let captured;
  const client = tyreApi.createClient({
    backendBase: "https://api.example.test/",
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return mockResponse(200, {
        ok: true,
        dvla: { make: "Ford", colour: "Blue", yearOfManufacture: 2020 },
        tyres: { front: "225/45 R17 91W", rear: "255/40R17" },
      });
    },
  });

  const result = await client.lookup(validInput);
  assert.equal(captured.url, "https://api.example.test/api/dvla");
  assert.equal(captured.options.method, "POST");
  assert.deepEqual(captured.options.headers, { "Content-Type": "application/json" });
  assert.deepEqual(JSON.parse(captured.options.body), {
    registrationNumber: "AB12CDE",
    customerName: "Ada Lovelace",
    customerPhone: "07380 439443",
  });
  assert.equal(captured.options.signal instanceof AbortSignal, true);
  assert.deepEqual(
    { make: result.vehicle.make, colour: result.vehicle.colour, year: result.vehicle.year },
    { make: "Ford", colour: "Blue", year: 2020 },
  );
  assert.equal(result.fitment.status, "available");
  assert.deepEqual(result.fitment.sizes, ["225/45R17", "255/40R17"]);
});

test("distinguishes a found vehicle from unavailable or unrecognized fitment", async () => {
  const unavailable = await clientReturning(200, {
    ok: true,
    dvla: { make: "Ford" },
    tyres: { error: "Tyre API key not configured (ONEAUTO_API_KEY)" },
  }).lookup(validInput);
  assert.equal(unavailable.vehicle.status, "found");
  assert.equal(unavailable.fitment.status, "unavailable");
  assert.deepEqual(unavailable.fitment.sizes, []);

  const missing = await clientReturning(200, {
    ok: true,
    dvla: { make: "Ford" },
    tyres: null,
  }).lookup(validInput);
  assert.equal(missing.fitment.status, "unavailable");

  const unrecognized = await clientReturning(200, {
    ok: true,
    dvla: { make: "Ford" },
    tyres: { note: "No OE fitments returned" },
  }).lookup(validInput);
  assert.equal(unrecognized.fitment.status, "no-sizes");
});

test("rejects malformed success responses", async () => {
  await assert.rejects(
    clientReturning(200, "<!doctype html><title>Platform error</title>").lookup(validInput),
    (error) => error.code === "MALFORMED_RESPONSE" && error.status === 200,
  );
  await assert.rejects(
    clientReturning(200, { ok: true, tyres: [] }).lookup(validInput),
    (error) => error.code === "MALFORMED_RESPONSE",
  );
});

test("maps 400, 429, and 500 responses to actionable error categories", async () => {
  await assert.rejects(
    clientReturning(400, { error: "Invalid VRM format" }).lookup(validInput),
    (error) => error.code === "INVALID_REQUEST" && error.status === 400 && error.field === "registration",
  );
  await assert.rejects(
    clientReturning(
      429,
      { ok: false, error: 429, message: "Rate limit hit (IP+VRM). Try again in ~10s." },
      { "Retry-After": "10" },
    ).lookup(validInput),
    (error) => error.code === "RATE_LIMIT" && error.status === 429 && error.retryAfter === 10,
  );
  await assert.rejects(
    clientReturning(500, { error: "Server error" }).lookup(validInput),
    (error) => error.code === "SERVER_ERROR" && error.status === 500,
  );
});

test("aborts a lookup that exceeds its timeout", async () => {
  const client = tyreApi.createClient({
    backendBase: "https://api.example.test",
    timeoutMs: 15,
    fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      }, { once: true });
    }),
  });

  await assert.rejects(
    client.lookup(validInput),
    (error) => error.code === "TIMEOUT",
  );
});

test("keeps timeout classification when the response body stalls", async () => {
  const client = tyreApi.createClient({
    backendBase: "https://api.example.test",
    timeoutMs: 15,
    fetchImpl: async (_url, options) => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: () => new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          const error = new Error("body read aborted");
          error.name = "AbortError";
          reject(error);
        }, { once: true });
      }),
    }),
  });

  await assert.rejects(
    client.lookup(validInput),
    (error) => error.code === "TIMEOUT",
  );
});

test("extracts textual and structured tyre sizes on a best-effort basis", () => {
  const sizes = tyreApi.extractTyreSizes({
    front: "225 / 45 R 17 91W",
    rear: ["255/35ZR19", "275/40R2098Y", "235/75R17.5"],
    alternative: {
      sectionWidth: "195 mm",
      aspectRatio: 65,
      rimDiameter: 15,
    },
    duplicate: "225/45R17",
  });

  assert.deepEqual(sizes, [
    "225/45R17",
    "255/35ZR19",
    "275/40R20",
    "235/75R17.5",
    "195/65R15",
  ]);
});

test("keeps verified routes and responsive review controls wired", () => {
  const root = join(__dirname, "..");
  const appSource = readFileSync(join(root, "app.js"), "utf8");
  const serverSource = readFileSync(join(root, "server.py"), "utf8");

  for (const route of ["/services", "/blog", "/contact-us", "/order-your-tyres-online", "/blog-post", "/blog-post1"]) {
    const routePattern = new RegExp(`(["'])${route.replaceAll("/", "\\/")}\\1`);
    assert.match(appSource, routePattern, `${route} must be registered in the client`);
    assert.match(serverSource, routePattern, `${route} must be registered in the server`);
  }
  assert.doesNotMatch(appSource, /blog-post[23]/);
  assert.doesNotMatch(serverSource, /blog-post[23]/);
  assert.match(appSource, /data-review-pause/);
  assert.match(appSource, /max-width: 940px[\s\S]*return 2/);
  assert.match(appSource, /<main id="main-content"[^>]*tabindex="-1"/);
  assert.match(appSource, /document\.body\.classList\.remove\("menu-open"\)/);
  assert.match(appSource, /if \(sameDocumentHash\) return;/);
  assert.match(appSource, /render\(url\.pathname, \{ scroll: true, focus: true, hash: url\.hash \}\)/);
  assert.match(appSource, /popstate[\s\S]*scroll: true,[\s\S]*focus: true,[\s\S]*hash: window\.location\.hash/);
  assert.match(appSource, /focus: Boolean\(window\.location\.hash\)/);
  assert.match(appSource, /matchMedia\("\(max-width: 940px\)"\)/);
  assert.match(appSource, /if \(!event\.matches\) setMobileMenuOpen\(false\)/);
  assert.doesNotMatch(appSource, /data-fallback-image|M Rahman/);
});

(async () => {
  let passed = 0;
  for (const { name, run } of tests) {
    try {
      await run();
      passed += 1;
      console.log(`ok ${passed} - ${name}`);
    } catch (error) {
      console.error(`not ok - ${name}`);
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
      return;
    }
  }
  console.log(`1..${passed}`);
})();
