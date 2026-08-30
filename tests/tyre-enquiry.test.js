"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const enquiry = require("../tyre-enquiry.js");

const requestId = "123e4567-e89b-42d3-a456-426614174000";
const accessKey = "123e4567-e89b-42d3-a456-426614174111";
const validInput = {
  requestId,
  name: "Ada Lovelace",
  phone: "07380 439443",
  email: "ADA@example.test",
  registration: " ab12 cde ",
  vehicleMake: "Ford",
  vehicleColour: "Blue",
  vehicleYear: "2020",
  frontTyreSize: "225 / 45 R 17",
  rearTyreSize: "255/40R17",
  frontQuantity: "2",
  rearQuantity: 2,
  budgetTier: "Premium",
  preferredBrand: "Michelin",
  notes: " Saturday morning ",
  website: "",
};

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}

const normalized = enquiry.normalizeEnquiryInput(validInput);
assert.deepEqual(normalized, {
  requestId,
  name: "Ada Lovelace",
  phone: "07380 439443",
  email: "ada@example.test",
  registration: "AB12CDE",
  vehicleMake: "Ford",
  vehicleColour: "Blue",
  vehicleYear: "2020",
  frontTyreSize: "225/45R17",
  rearTyreSize: "255/40R17",
  frontQuantity: 2,
  rearQuantity: 2,
  budgetTier: "Premium",
  preferredBrand: "Michelin",
  notes: "Saturday morning",
  website: "",
});
assert.equal(enquiry.normalizeTyreSize("245 / 35 ZR 18"), "245/35ZR18");
assert.equal(enquiry.normalizeTyreSize("999/10R99"), "");

for (const [change, field] of [
  [{ frontQuantity: 0, rearQuantity: 0 }, "frontQuantity"],
  [{ frontQuantity: 1, frontTyreSize: "not a tyre" }, "frontTyreSize"],
  [{ rearQuantity: 1, rearTyreSize: "" }, "rearTyreSize"],
  [{ email: "invalid" }, "email"],
  [{ website: "https://spam.example" }, "website"],
  [{ budgetTier: "Luxury" }, "budgetTier"],
]) {
  assert.throws(
    () => enquiry.normalizeEnquiryInput({ ...validInput, ...change }),
    (error) => error.code === (field === "website" ? "SPAM_DETECTED" : "INVALID_INPUT") && error.field === field,
  );
}

assert.equal(
  enquiry.createRequestId({ randomUUID: () => requestId }),
  requestId,
);
assert.equal(enquiry.lookupMatches("AB12 CDE", "AB12CDE", 2, 2), true);
assert.equal(enquiry.lookupMatches("AB12CDE", "XY99XYZ", 2, 2), false);
assert.equal(enquiry.lookupMatches("AB12CDE", "AB12CDE", 1, 2), false);

assert.throws(
  () => enquiry.createClient({ fetchImpl: async () => response(200, { success: true }) }),
  (error) => error.code === "CONFIG_ERROR",
);
assert.throws(
  () => enquiry.createClient({ accessKey: "not-a-valid-key", fetchImpl: async () => response(200, { success: true }) }),
  (error) => error.code === "CONFIG_ERROR",
);

(async () => {
  let captured;
  const client = enquiry.createClient({
    accessKey,
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return response(200, { success: true });
    },
  });
  const result = await client.submit(validInput);
  assert.deepEqual(result, { ok: true });
  assert.equal(captured.url, "https://api.web3forms.com/submit");
  assert.equal(captured.options.credentials, "omit");
  const providerPayload = JSON.parse(captured.options.body);
  assert.equal(providerPayload.access_key, accessKey);
  assert.equal(providerPayload.from_name, "Ossett Tyres website");
  assert.equal(providerPayload.email, "ada@example.test");
  assert.equal(providerPayload.botcheck, false);
  assert.match(providerPayload.subject, /AB12CDE.*Ada Lovelace/);
  assert.match(providerPayload.message, /Front: 225\/45R17 \(x2\)/);
  assert.match(providerPayload.message, /Rear: 255\/40R17 \(x2\)/);
  assert.match(providerPayload.message, /Saturday morning/);

  await assert.rejects(
    enquiry.createClient({ accessKey, fetchImpl: async () => response(429, { success: false, message: "Wait" }) }).submit(validInput),
    (error) => error.code === "RATE_LIMIT" && error.status === 429,
  );
  await assert.rejects(
    enquiry.createClient({ accessKey, fetchImpl: async () => response(503, { success: false }) }).submit(validInput),
    (error) => error.code === "SERVER_ERROR" && error.status === 503,
  );
  await assert.rejects(
    enquiry.createClient({ accessKey, fetchImpl: async () => response(200, "not-an-object") }).submit(validInput),
    (error) => error.code === "MALFORMED_RESPONSE",
  );

  const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const serverSource = fs.readFileSync(path.join(__dirname, "..", "server.py"), "utf8");
  assert.match(appSource, /data-enquiry-form/);
  assert.match(appSource, /\/tyre-enquiry/);
  assert.match(appSource, /https:\/\/web3forms\.com\/privacy/);
  assert.match(serverSource, /WEB3FORMS_ACCESS_KEY/);
  assert.doesNotMatch(serverSource, /WEB3FORMS_ACCESS_KEY\s*=\s*["'][^"']+/);
  console.log("ok - tyre enquiry validation, provider client, race guard, and configuration boundary");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
