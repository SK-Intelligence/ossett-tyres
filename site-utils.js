(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.OssettSiteUtils = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function phoneDigits(value) {
    return String(value == null ? "" : value).replace(/\D/g, "");
  }

  function telephoneHref(value) {
    const raw = String(value == null ? "" : value).trim();
    const digits = phoneDigits(raw);
    if (!digits) return "";
    if (raw.startsWith("+")) return `+${digits}`;
    if (digits.startsWith("00")) return `+${digits.slice(2)}`;
    return digits;
  }

  function whatsappNumber(value, defaultCountryCode = "44") {
    const raw = String(value == null ? "" : value).trim();
    let digits = phoneDigits(raw);
    const country = phoneDigits(defaultCountryCode);
    if (!digits) return "";
    if (digits.startsWith("00")) return digits.slice(2);
    if (!raw.startsWith("+") && digits.startsWith("0") && country) {
      digits = `${country}${digits.slice(1)}`;
    }
    return digits;
  }

  return Object.freeze({ phoneDigits, telephoneHref, whatsappNumber });
});
