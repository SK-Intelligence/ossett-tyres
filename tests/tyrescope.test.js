"use strict";

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const tyreScope = require("../tyrescope-embed.js");

const root = join(__dirname, "..");
const appSource = readFileSync(join(root, "app.js"), "utf8");
const serverSource = readFileSync(join(root, "server.py"), "utf8");

assert.equal(tyreScope.normalizeEmbedUrl(""), "");
assert.equal(tyreScope.normalizeEmbedUrl("javascript:alert(1)"), "");
assert.equal(tyreScope.normalizeEmbedUrl("http://example.com/embed"), "");
assert.equal(tyreScope.normalizeEmbedUrl("https://user:secret@example.com/embed"), "");
assert.equal(
  tyreScope.normalizeEmbedUrl("https://partner.example/embed?id=garage"),
  "https://partner.example/embed?id=garage",
);
assert.deepEqual(tyreScope.publicConfig({}), { configured: false, embedUrl: "" });
assert.deepEqual(
  tyreScope.publicConfig({ tyrescopeEmbedUrl: "https://partner.example/embed" }),
  { configured: true, embedUrl: "https://partner.example/embed" },
);

assert.match(appSource, /data-tyrescope-embed/);
assert.match(appSource, /data-tyrescope-frame/);
assert.match(appSource, /title="Search and order tyres from Ossett Tyres"/);
assert.match(appSource, /data-tyrescope-fallback/);
assert.match(appSource, /TYRESCOPE_EMBED_URL/);
assert.match(serverSource, /public_tyrescope_embed_url/);
assert.doesNotMatch(serverSource, /TYRESCOPE_API_KEY/);

class FakeElement {
  constructor() {
    this.attributes = new Map();
    this.dataset = {};
    this.hidden = false;
    this.listeners = new Map();
    this.textContent = "";
    this.src = "";
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === "hidden") this.hidden = false;
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  removeEventListener(type, listener) {
    if (this.listeners.get(type) === listener) this.listeners.delete(type);
  }

  dispatch(type) {
    this.listeners.get(type)?.();
  }
}

function fixture() {
  const container = new FakeElement();
  const status = new FakeElement();
  const frame = new FakeElement();
  const fallback = new FakeElement();
  const warning = new FakeElement();
  frame.hidden = true;
  fallback.hidden = true;
  warning.hidden = true;
  const elements = {
    "[data-tyrescope-status]": status,
    "[data-tyrescope-frame]": frame,
    "[data-tyrescope-fallback]": fallback,
    "[data-tyrescope-dev-warning]": warning,
  };
  container.querySelector = (selector) => elements[selector] || null;
  return { container, status, frame, fallback, warning };
}

(async () => {
  const missing = fixture();
  tyreScope.mount(missing.container, {});
  assert.equal(missing.container.dataset.tyrescopeState, "unavailable");
  assert.equal(missing.fallback.hidden, false);
  assert.match(missing.status.textContent, /not connected yet/i);

  const ready = fixture();
  tyreScope.mount(ready.container, { tyrescopeEmbedUrl: "https://partner.example/embed" });
  assert.equal(ready.container.dataset.tyrescopeState, "loading");
  assert.equal(ready.frame.src, "https://partner.example/embed");
  ready.frame.dispatch("load");
  assert.equal(ready.container.dataset.tyrescopeState, "ready");
  assert.equal(ready.frame.hidden, false);
  assert.equal(ready.fallback.hidden, true);

  const failed = fixture();
  tyreScope.mount(failed.container, { tyrescopeEmbedUrl: "https://partner.example/embed" });
  failed.frame.dispatch("error");
  assert.equal(failed.container.dataset.tyrescopeState, "error");
  assert.equal(failed.frame.hidden, true);
  assert.equal(failed.fallback.hidden, false);

  const timedOut = fixture();
  tyreScope.mount(
    timedOut.container,
    { tyrescopeEmbedUrl: "https://partner.example/embed" },
    { timeoutMs: 5 },
  );
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(timedOut.container.dataset.tyrescopeState, "error");
  assert.equal(timedOut.fallback.hidden, false);

  console.log("ok - TyreScope configured, missing, error, and timeout states");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
