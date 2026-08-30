(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.OssettTyreApi = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DEFAULT_TIMEOUT_MS = 20000;
  const MAX_TIMEOUT_MS = 120000;
  const LOOKUP_ENDPOINT = "/api/dvla";

  class TyreApiError extends Error {
    constructor(message, options = {}) {
      super(message);
      this.name = "TyreApiError";
      this.code = options.code || "REQUEST_FAILED";
      this.status = Number.isInteger(options.status) ? options.status : 0;
      this.field = options.field || "";
      this.retryAfter = Number.isFinite(options.retryAfter) ? options.retryAfter : null;
      if (options.cause) this.cause = options.cause;
    }
  }

  function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function normalizeRegistration(value) {
    return String(value == null ? "" : value)
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "");
  }

  function normalizeName(value) {
    return String(value == null ? "" : value)
      .trim()
      .replace(/\s+/g, " ");
  }

  function normalizePhone(value) {
    return String(value == null ? "" : value)
      .trim()
      .replace(/\s+/g, " ");
  }

  function normalizeLookupInput(input) {
    if (!isRecord(input)) {
      throw new TyreApiError("Enter your tyre lookup details.", {
        code: "INVALID_INPUT",
      });
    }

    const name = normalizeName(input.name == null ? input.customerName : input.name);
    const phone = normalizePhone(input.phone == null ? input.customerPhone : input.phone);
    const registration = normalizeRegistration(
      input.registration == null ? input.registrationNumber : input.registration,
    );

    if (!name || name.length > 80 || !/\p{L}/u.test(name)) {
      throw new TyreApiError("Enter a name containing at least one letter.", {
        code: "INVALID_INPUT",
        field: "name",
      });
    }

    const phoneDigits = phone.replace(/\D/g, "");
    if (
      phone.length > 32 ||
      !/^[0-9+() .-]+$/.test(phone) ||
      phoneDigits.length < 10 ||
      phoneDigits.length > 15
    ) {
      throw new TyreApiError("Enter a phone number containing 10 to 15 digits.", {
        code: "INVALID_INPUT",
        field: "phone",
      });
    }

    if (!/^[A-Z0-9]{1,8}$/.test(registration)) {
      throw new TyreApiError("Enter a registration using up to 8 letters and numbers.", {
        code: "INVALID_INPUT",
        field: "registration",
      });
    }

    return Object.freeze({ name, phone, registration });
  }

  function buildLookupPayload(input) {
    const normalized = normalizeLookupInput(input);
    return {
      registrationNumber: normalized.registration,
      customerName: normalized.name,
      customerPhone: normalized.phone,
    };
  }

  function numericValue(value) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value !== "string") return null;
    const match = value.trim().match(/^\d+(?:[.,]\d+)?/);
    return match ? Number(match[0].replace(",", ".")) : null;
  }

  function plausibleSize(width, aspect, rim) {
    return (
      Number.isFinite(width) &&
      Number.isFinite(aspect) &&
      Number.isFinite(rim) &&
      width >= 95 &&
      width <= 455 &&
      aspect >= 20 &&
      aspect <= 100 &&
      rim >= 10 &&
      rim <= 30
    );
  }

  function formatRim(value) {
    return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
  }

  function structuredSize(record) {
    const values = new Map(
      Object.entries(record).map(([key, value]) => [key.toLowerCase().replace(/[^a-z0-9]/g, ""), value]),
    );
    const pick = (keys) => {
      for (const key of keys) {
        if (values.has(key)) return values.get(key);
      }
      return null;
    };

    const width = numericValue(pick(["width", "tyrewidth", "tirewidth", "sectionwidth"]));
    const aspect = numericValue(pick(["aspect", "aspectratio", "profile", "ratio"]));
    const rim = numericValue(
      pick(["rim", "rimsize", "rimdiameter", "wheeldiameter", "wheelsize", "diameter"]),
    );
    if (!plausibleSize(width, aspect, rim)) return "";

    const constructionValue = String(pick(["construction", "speedconstruction"]) || "R")
      .toUpperCase()
      .replace(/\s/g, "");
    const construction = constructionValue.includes("ZR") ? "ZR" : "R";
    return `${Math.round(width)}/${Math.round(aspect)}${construction}${formatRim(rim)}`;
  }

  function extractTyreSizes(value, options = {}) {
    const requestedLimit = Number(options.limit);
    const limit = Number.isInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 50)
      : 24;
    const found = new Set();
    const visited = typeof WeakSet === "function" ? new WeakSet() : null;
    const textPattern = /\b(\d{3})\s*\/\s*(\d{2,3})\s*(Z?\s*R)\s*(\d{2}(?:[.,]5)?)/gi;

    const add = (size) => {
      if (size && found.size < limit) found.add(size);
    };

    const scanText = (text) => {
      textPattern.lastIndex = 0;
      let match;
      while (found.size < limit && (match = textPattern.exec(text)) !== null) {
        const width = Number(match[1]);
        const aspect = Number(match[2]);
        const rim = Number(match[4].replace(",", "."));
        if (!plausibleSize(width, aspect, rim)) continue;
        const construction = match[3].toUpperCase().replace(/\s/g, "");
        add(`${width}/${aspect}${construction}${formatRim(rim)}`);
      }
    };

    const visit = (current, depth) => {
      if (depth > 10 || found.size >= limit || current == null) return;
      if (typeof current === "string" || typeof current === "number") {
        scanText(String(current));
        return;
      }
      if (typeof current !== "object") return;
      if (visited?.has(current)) return;
      visited?.add(current);

      if (!Array.isArray(current)) add(structuredSize(current));
      const children = Array.isArray(current) ? current : Object.values(current);
      for (const child of children) {
        visit(child, depth + 1);
        if (found.size >= limit) break;
      }
    };

    visit(value, 0);
    return Array.from(found);
  }

  function backendMessage(body) {
    if (!isRecord(body)) return "";
    const candidate = typeof body.message === "string"
      ? body.message
      : typeof body.error === "string"
        ? body.error
        : "";
    return candidate.trim().slice(0, 240);
  }

  function retryDelay(response, message) {
    const header = response && response.headers && typeof response.headers.get === "function"
      ? Number(response.headers.get("Retry-After"))
      : NaN;
    if (Number.isFinite(header) && header >= 0) return header;
    const match = String(message || "").match(/~?(\d+)\s*s(?:ec(?:ond)?s?)?/i);
    return match ? Number(match[1]) : null;
  }

  async function readResponse(response) {
    if (!response || typeof response.text !== "function") {
      throw new TyreApiError("The tyre service returned an unreadable response.", {
        code: "MALFORMED_RESPONSE",
      });
    }

    let text;
    try {
      text = await response.text();
    } catch (cause) {
      if (cause && cause.name === "AbortError") throw cause;
      throw new TyreApiError("The tyre service response could not be read.", {
        code: "MALFORMED_RESPONSE",
        cause,
      });
    }

    if (!String(text).trim()) return { body: null, malformed: false };
    try {
      return { body: JSON.parse(text), malformed: false };
    } catch (cause) {
      return { body: null, malformed: true, cause };
    }
  }

  function httpError(response, body) {
    const status = Number(response && response.status) || 0;
    const message = backendMessage(body);
    if (status === 400) {
      return new TyreApiError(message || "Check the registration and try again.", {
        code: "INVALID_REQUEST",
        status,
        field: "registration",
      });
    }
    if (status === 403) {
      return new TyreApiError("This website origin is not allowed to use the tyre service.", {
        code: "FORBIDDEN",
        status,
      });
    }
    if (status === 429) {
      return new TyreApiError(message || "Too many requests. Please wait before trying again.", {
        code: "RATE_LIMIT",
        status,
        retryAfter: retryDelay(response, message),
      });
    }
    if (status === 408 || status === 504) {
      return new TyreApiError("The tyre lookup timed out.", {
        code: "TIMEOUT",
        status,
      });
    }
    if (status >= 500) {
      return new TyreApiError("The tyre service is temporarily unavailable.", {
        code: "SERVER_ERROR",
        status,
      });
    }
    return new TyreApiError(message || `The tyre service returned status ${status || "unknown"}.`, {
      code: "HTTP_ERROR",
      status,
    });
  }

  function scalar(value) {
    return typeof value === "string" || typeof value === "number" ? value : null;
  }

  function classifyFitment(value) {
    if (value == null) {
      return {
        status: "unavailable",
        sizes: [],
        pairs: [],
        reason: "The fitment service did not return data.",
      };
    }
    if (isRecord(value) && value.error != null) {
      return {
        status: "unavailable",
        sizes: [],
        pairs: [],
        reason: typeof value.error === "string" ? value.error : "The fitment service returned an error.",
      };
    }

    const sizes = extractTyreSizes(value);
    const sourcePairs = isRecord(value) && Array.isArray(value.fitments) ? value.fitments : [];
    const pairs = sourcePairs.slice(0, 24).map((pair) => {
      if (!isRecord(pair)) return null;
      const front = extractTyreSizes(pair.front, { limit: 1 })[0] || "";
      const rear = extractTyreSizes(pair.rear, { limit: 1 })[0] || "";
      return front || rear ? Object.freeze({ front, rear }) : null;
    }).filter(Boolean);
    return {
      status: sizes.length ? "available" : "no-sizes",
      sizes,
      pairs,
      reason: sizes.length ? "" : "No recognised OE tyre sizes were present in the response.",
    };
  }

  function normalizeTimeout(value) {
    if (value == null) return DEFAULT_TIMEOUT_MS;
    const timeout = Number(value);
    if (!Number.isFinite(timeout) || timeout <= 0 || timeout > MAX_TIMEOUT_MS) {
      throw new TyreApiError(`timeoutMs must be between 1 and ${MAX_TIMEOUT_MS}.`, {
        code: "CONFIG_ERROR",
      });
    }
    return Math.round(timeout);
  }

  function createClient(options = {}) {
    const timeoutMs = normalizeTimeout(options.timeoutMs);
    const defaultFetch = typeof globalThis !== "undefined" && typeof globalThis.fetch === "function"
      ? globalThis.fetch.bind(globalThis)
      : null;
    const fetchImpl = options.fetchImpl || defaultFetch;

    if (typeof fetchImpl !== "function") {
      throw new TyreApiError("No fetch implementation is available for the tyre service.", {
        code: "CONFIG_ERROR",
      });
    }

    const client = {
      mode: "live",
      endpoint: LOOKUP_ENDPOINT,
      async lookup(input) {
        const payload = buildLookupPayload(input);
        const controller = new AbortController();
        let didTimeout = false;
        const timer = setTimeout(() => {
          didTimeout = true;
          controller.abort();
        }, timeoutMs);

        try {
          const response = await fetchImpl(LOOKUP_ENDPOINT, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
            cache: "no-store",
            credentials: "same-origin",
            redirect: "error",
            signal: controller.signal,
          });
          const parsed = await readResponse(response);
          if (didTimeout) {
            throw new TyreApiError("The tyre lookup timed out.", {
              code: "TIMEOUT",
            });
          }
          if (!response.ok) throw httpError(response, parsed.body);
          if (parsed.malformed || !isRecord(parsed.body)) {
            throw new TyreApiError("The tyre service returned malformed data.", {
              code: "MALFORMED_RESPONSE",
              status: Number(response.status) || 0,
              cause: parsed.cause,
            });
          }
          if (parsed.body.ok !== true) {
            throw new TyreApiError(backendMessage(parsed.body) || "The tyre lookup was not successful.", {
              code: "API_ERROR",
              status: Number(response.status) || 0,
            });
          }
          if (!isRecord(parsed.body.dvla)) {
            throw new TyreApiError("The tyre service response did not include vehicle data.", {
              code: "MALFORMED_RESPONSE",
              status: Number(response.status) || 0,
            });
          }

          return {
            ok: true,
            vehicle: {
              status: "found",
              make: scalar(parsed.body.dvla.make),
              colour: scalar(parsed.body.dvla.colour),
              year: scalar(parsed.body.dvla.yearOfManufacture),
            },
            fitment: classifyFitment(parsed.body.tyres),
          };
        } catch (error) {
          if (didTimeout || (error && error.name === "AbortError")) {
            throw new TyreApiError("The tyre lookup timed out.", {
              code: "TIMEOUT",
              cause: error,
            });
          }
          if (error instanceof TyreApiError) throw error;
          throw new TyreApiError("The tyre service could not be reached.", {
            code: "NETWORK_ERROR",
            cause: error,
          });
        } finally {
          clearTimeout(timer);
        }
      },
    };

    return Object.freeze(client);
  }

  return Object.freeze({
    DEFAULT_TIMEOUT_MS,
    LOOKUP_ENDPOINT,
    TyreApiError,
    buildLookupPayload,
    createClient,
    extractTyreSizes,
    normalizeLookupInput,
    normalizeName,
    normalizePhone,
    normalizeRegistration,
  });
});
