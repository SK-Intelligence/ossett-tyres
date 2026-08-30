(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.OssettTyreScope = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const LOAD_TIMEOUT_MS = 15000;

  function normalizeEmbedUrl(value) {
    const raw = String(value == null ? "" : value).trim();
    if (!raw) return "";
    let url;
    try {
      url = new URL(raw);
    } catch {
      return "";
    }
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return "";
    return url.href;
  }

  function publicConfig(value) {
    const source = value && typeof value === "object" ? value : {};
    const embedUrl = normalizeEmbedUrl(source.tyrescopeEmbedUrl);
    return Object.freeze({ configured: Boolean(embedUrl), embedUrl });
  }

  function setState(container, state, message) {
    container.dataset.tyrescopeState = state;
    container.setAttribute("aria-busy", String(state === "loading"));
    const status = container.querySelector("[data-tyrescope-status]");
    if (status && message) status.textContent = message;
    const fallback = container.querySelector("[data-tyrescope-fallback]");
    if (fallback) fallback.hidden = !["unavailable", "error"].includes(state);
  }

  function mount(container, rawConfig, options = {}) {
    if (!container) return Object.freeze({ state: "missing-container", destroy() {} });
    const config = publicConfig(rawConfig);
    if (!config.configured) {
      setState(
        container,
        "unavailable",
        "Online tyre ordering is not connected yet. Use the registration check below or contact the workshop.",
      );
      if (["localhost", "127.0.0.1"].includes(root.location && root.location.hostname)) {
        container.querySelector("[data-tyrescope-dev-warning]")?.removeAttribute("hidden");
      }
      return Object.freeze({ state: "unavailable", destroy() {} });
    }

    const frame = container.querySelector("[data-tyrescope-frame]");
    if (!frame) {
      setState(container, "error", "The tyre ordering panel could not be initialized.");
      return Object.freeze({ state: "error", destroy() {} });
    }

    let settled = false;
    const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : LOAD_TIMEOUT_MS;
    setState(container, "loading", "Loading secure tyre search…");
    const fail = () => {
      if (settled) return;
      settled = true;
      root.clearTimeout(timer);
      frame.hidden = true;
      setState(
        container,
        "error",
        "Online tyre ordering is unavailable just now. Use the registration check below or contact the workshop.",
      );
    };
    const ready = () => {
      if (settled) return;
      settled = true;
      root.clearTimeout(timer);
      frame.hidden = false;
      setState(container, "ready", "Tyre search loaded.");
    };
    frame.addEventListener("load", ready, { once: true });
    frame.addEventListener("error", fail, { once: true });
    const timer = root.setTimeout(fail, Math.max(1, timeoutMs));
    frame.src = config.embedUrl;

    return Object.freeze({
      state: "loading",
      destroy() {
        settled = true;
        root.clearTimeout(timer);
        frame.removeEventListener("load", ready);
        frame.removeEventListener("error", fail);
      },
    });
  }

  return Object.freeze({ LOAD_TIMEOUT_MS, mount, normalizeEmbedUrl, publicConfig });
});
