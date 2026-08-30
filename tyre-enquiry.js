(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.OssettTyreEnquiry = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ENQUIRY_ENDPOINT = "https://api.web3forms.com/submit";
  const DEFAULT_TIMEOUT_MS = 15000;
  const MAX_TIMEOUT_MS = 60000;
  const BUDGET_TIERS = Object.freeze(["", "Budget", "Mid-range", "Premium"]);

  class EnquiryError extends Error {
    constructor(message, options = {}) {
      super(message);
      this.name = "EnquiryError";
      this.code = options.code || "REQUEST_FAILED";
      this.status = Number.isInteger(options.status) ? options.status : 0;
      this.field = options.field || "";
      if (options.cause) this.cause = options.cause;
    }
  }

  function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function cleanText(value, limit) {
    return String(value == null ? "" : value).trim().replace(/\s+/g, " ").slice(0, limit);
  }

  function normalizeRegistration(value) {
    return cleanText(value, 16).toUpperCase().replace(/\s+/g, "");
  }

  function lookupMatches(currentRegistration, requestedRegistration, sequence, activeSequence) {
    return sequence === activeSequence
      && normalizeRegistration(currentRegistration) === normalizeRegistration(requestedRegistration);
  }

  function normalizeTyreSize(value) {
    const candidate = cleanText(value, 32).toUpperCase();
    if (!candidate || candidate === "N/A") return "";
    const match = candidate.match(/^(\d{3})\s*\/\s*(\d{2,3})\s*(ZR|R)\s*(\d{2}(?:[.,]5)?)$/);
    if (!match) return "";
    const width = Number(match[1]);
    const profile = Number(match[2]);
    const rim = Number(match[4].replace(",", "."));
    if (width < 95 || width > 455 || profile < 20 || profile > 100 || rim < 10 || rim > 30) return "";
    const rimText = Number.isInteger(rim) ? String(rim) : String(rim);
    return `${width}/${profile}${match[3]}${rimText}`;
  }

  function integerQuantity(value, field) {
    const quantity = typeof value === "number" ? value : Number(String(value == null ? "" : value).trim());
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 4) {
      throw new EnquiryError("Choose a quantity between 0 and 4.", {
        code: "INVALID_INPUT",
        field,
      });
    }
    return quantity;
  }

  function normalizeEnquiryInput(input) {
    if (!isRecord(input)) {
      throw new EnquiryError("Enter your tyre enquiry details.", { code: "INVALID_INPUT" });
    }

    const requestId = cleanText(input.requestId, 64).toLowerCase();
    const name = cleanText(input.name, 80);
    const phone = cleanText(input.phone, 32);
    const email = cleanText(input.email, 254).toLowerCase();
    const registration = normalizeRegistration(input.registration);
    const vehicleMake = cleanText(input.vehicleMake, 80);
    const vehicleColour = cleanText(input.vehicleColour, 40);
    const vehicleYear = cleanText(input.vehicleYear, 8);
    const frontTyreSize = normalizeTyreSize(input.frontTyreSize);
    const rearTyreSize = normalizeTyreSize(input.rearTyreSize);
    const frontQuantity = integerQuantity(input.frontQuantity, "frontQuantity");
    const rearQuantity = integerQuantity(input.rearQuantity, "rearQuantity");
    const budgetTier = cleanText(input.budgetTier, 20);
    const preferredBrand = cleanText(input.preferredBrand, 60) || "Any / Best value";
    const notes = String(input.notes == null ? "" : input.notes).trim().slice(0, 1000);
    const website = cleanText(input.website, 200);

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
      throw new EnquiryError("Refresh the page and try again.", {
        code: "INVALID_INPUT",
        field: "requestId",
      });
    }
    if (!name || !/\p{L}/u.test(name)) {
      throw new EnquiryError("Enter a name containing at least one letter.", {
        code: "INVALID_INPUT",
        field: "name",
      });
    }
    const phoneDigits = phone.replace(/\D/g, "");
    if (!/^[0-9+() .-]+$/.test(phone) || phoneDigits.length < 10 || phoneDigits.length > 15) {
      throw new EnquiryError("Enter a phone number containing 10 to 15 digits.", {
        code: "INVALID_INPUT",
        field: "phone",
      });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new EnquiryError("Enter a valid email address.", {
        code: "INVALID_INPUT",
        field: "email",
      });
    }
    if (!/^[A-Z0-9]{1,8}$/.test(registration)) {
      throw new EnquiryError("Enter a registration using up to 8 letters and numbers.", {
        code: "INVALID_INPUT",
        field: "registration",
      });
    }
    if (frontQuantity + rearQuantity < 1) {
      throw new EnquiryError("Request at least one front or rear tyre.", {
        code: "INVALID_INPUT",
        field: "frontQuantity",
      });
    }
    if (frontQuantity > 0 && !frontTyreSize) {
      throw new EnquiryError("Choose or enter the front tyre size.", {
        code: "INVALID_INPUT",
        field: "frontTyreSize",
      });
    }
    if (rearQuantity > 0 && !rearTyreSize) {
      throw new EnquiryError("Choose or enter the rear tyre size.", {
        code: "INVALID_INPUT",
        field: "rearTyreSize",
      });
    }
    if (!BUDGET_TIERS.includes(budgetTier)) {
      throw new EnquiryError("Choose a valid budget range.", {
        code: "INVALID_INPUT",
        field: "budgetTier",
      });
    }
    if (website) {
      throw new EnquiryError("The enquiry could not be submitted.", {
        code: "SPAM_DETECTED",
        field: "website",
      });
    }

    return Object.freeze({
      requestId,
      name,
      phone,
      email,
      registration,
      vehicleMake,
      vehicleColour,
      vehicleYear,
      frontTyreSize,
      rearTyreSize,
      frontQuantity,
      rearQuantity,
      budgetTier,
      preferredBrand,
      notes,
      website: "",
    });
  }

  function createRequestId(cryptoImpl) {
    const source = cryptoImpl || (typeof globalThis !== "undefined" ? globalThis.crypto : null);
    if (source && typeof source.randomUUID === "function") return source.randomUUID();
    if (source && typeof source.getRandomValues === "function") {
      const bytes = source.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0"));
      return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
    }
    {
      throw new EnquiryError("This browser cannot create a secure enquiry reference.", {
        code: "CONFIG_ERROR",
      });
    }
  }

  function normalizeTimeout(value) {
    if (value == null) return DEFAULT_TIMEOUT_MS;
    const timeout = Number(value);
    if (!Number.isFinite(timeout) || timeout <= 0 || timeout > MAX_TIMEOUT_MS) {
      throw new EnquiryError(`timeoutMs must be between 1 and ${MAX_TIMEOUT_MS}.`, {
        code: "CONFIG_ERROR",
      });
    }
    return Math.round(timeout);
  }

  function providerMessage(payload) {
    const vehicle = [payload.vehicleMake, payload.vehicleColour, payload.vehicleYear]
      .filter(Boolean)
      .join(" · ") || "Vehicle details entered manually";
    return [
      `Enquiry reference: ${payload.requestId}`,
      "",
      "Customer",
      `Name: ${payload.name}`,
      `Phone: ${payload.phone}`,
      `Email: ${payload.email}`,
      "",
      "Vehicle",
      `Registration: ${payload.registration}`,
      `Details: ${vehicle}`,
      "",
      "Tyres requested",
      `Front: ${payload.frontTyreSize || "None"} (x${payload.frontQuantity})`,
      `Rear: ${payload.rearTyreSize || "None"} (x${payload.rearQuantity})`,
      `Budget range: ${payload.budgetTier || "Any"}`,
      `Preferred brand: ${payload.preferredBrand}`,
      "",
      "Notes",
      payload.notes || "None supplied",
    ].join("\n");
  }

  async function parseResponse(response) {
    let body = null;
    try {
      body = await response.json();
    } catch (cause) {
      if (cause && cause.name === "AbortError") throw cause;
      throw new EnquiryError("The enquiry service returned an unreadable response.", {
        code: "MALFORMED_RESPONSE",
        status: Number(response && response.status) || 0,
        cause,
      });
    }
    if (!isRecord(body)) {
      throw new EnquiryError("The enquiry service returned an unreadable response.", {
        code: "MALFORMED_RESPONSE",
        status: Number(response && response.status) || 0,
      });
    }
    return body;
  }

  function createClient(options = {}) {
    const timeoutMs = normalizeTimeout(options.timeoutMs);
    const accessKey = cleanText(options.accessKey, 80);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accessKey)) {
      throw new EnquiryError("The Web3Forms access key is not configured.", {
        code: "CONFIG_ERROR",
      });
    }
    const defaultFetch = typeof globalThis !== "undefined" && typeof globalThis.fetch === "function"
      ? globalThis.fetch.bind(globalThis)
      : null;
    const fetchImpl = options.fetchImpl || defaultFetch;
    if (typeof fetchImpl !== "function") {
      throw new EnquiryError("No fetch implementation is available for tyre enquiries.", {
        code: "CONFIG_ERROR",
      });
    }

    return Object.freeze({
      endpoint: ENQUIRY_ENDPOINT,
      async submit(input) {
        const payload = normalizeEnquiryInput(input);
        const providerPayload = {
          access_key: accessKey,
          from_name: "Ossett Tyres website",
          subject: `Tyre enquiry – ${payload.registration} – ${payload.name}`,
          email: payload.email,
          message: providerMessage(payload),
          botcheck: false,
        };
        const controller = new AbortController();
        let didTimeout = false;
        const timer = setTimeout(() => {
          didTimeout = true;
          controller.abort();
        }, timeoutMs);
        try {
          const response = await fetchImpl(ENQUIRY_ENDPOINT, {
            method: "POST",
            headers: { Accept: "application/json", "Content-Type": "application/json" },
            body: JSON.stringify(providerPayload),
            cache: "no-store",
            credentials: "omit",
            redirect: "error",
            signal: controller.signal,
          });
          const body = await parseResponse(response);
          if (didTimeout) throw new EnquiryError("The enquiry request timed out.", { code: "TIMEOUT" });
          if (!response.ok || body.success !== true) {
            const status = Number(response.status) || 0;
            const message = typeof body.message === "string" ? body.message.slice(0, 240) : "";
            const code = status === 429 ? "RATE_LIMIT" : status >= 500 ? "SERVER_ERROR" : "INVALID_REQUEST";
            throw new EnquiryError(message || "The enquiry could not be sent.", { code, status });
          }
          return Object.freeze({ ok: true });
        } catch (error) {
          if (didTimeout || (error && error.name === "AbortError")) {
            throw new EnquiryError("The enquiry request timed out.", { code: "TIMEOUT", cause: error });
          }
          if (error instanceof EnquiryError) throw error;
          throw new EnquiryError("The enquiry service could not be reached.", {
            code: "NETWORK_ERROR",
            cause: error,
          });
        } finally {
          clearTimeout(timer);
        }
      },
    });
  }

  return Object.freeze({
    BUDGET_TIERS,
    DEFAULT_TIMEOUT_MS,
    ENQUIRY_ENDPOINT,
    EnquiryError,
    createClient,
    createRequestId,
    lookupMatches,
    normalizeEnquiryInput,
    normalizeRegistration,
    normalizeTyreSize,
  });
});
