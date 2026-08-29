const { isOriginAllowed, applyCors, sendJson, allowedOrigins } = require("./_lib/cors");
const { simpleCooldown } = require("./_lib/cooldown");
const { normaliseAndValidateVRM } = require("./_lib/validate");
const { fetchDvla, fetchOETyresRaw } = require("./_lib/upstream");
const { appendApiLog } = require("./_lib/logging");
const { sendWeb3Email } = require("./_lib/email");

function getClientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (xf) return String(xf).split(",")[0].trim();
  const real = req.headers["x-real-ip"];
  if (real) return String(real).trim();
  return "unknown";
}

function rateLimitResponse(res, origin, retryAfterSec, which) {
  res.setHeader("Retry-After", String(retryAfterSec));
  sendJson(res, origin, 429, {
    ok: false,
    error: 429,
    message: `Rate limit hit (${which}). Try again in ~${retryAfterSec}s.`,
  });
}

async function safeLog(row) {
  try {
    await appendApiLog(row);
  } catch {
    // Logging must never break the lookup itself.
  }
}

module.exports = async (req, res) => {
  const origin = req.headers.origin || null;

  if (req.method === "OPTIONS") {
    applyCors(res, isOriginAllowed(origin) ? origin : allowedOrigins[0], "GET, POST, OPTIONS");
    res.statusCode = 204;
    return res.end();
  }

  if (!isOriginAllowed(origin)) {
    return sendJson(res, origin, 403, { error: "Forbidden" });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return sendJson(res, origin, 405, { error: "Method not allowed" });
  }

  const ip = getClientIp(req);
  const userAgent = req.headers["user-agent"] || "unknown";
  const submittedAtUK = new Date().toLocaleString("en-GB", { timeZone: "Europe/London", hour12: false });

  const isPost = req.method === "POST";
  const body = isPost && typeof req.body === "object" && req.body ? req.body : {};
  const customerName = isPost ? body?.customerName || "unknown" : undefined;
  const customerPhone = isPost ? body?.customerPhone || "unknown" : undefined;
  const rawReg = isPost ? body?.registrationNumber ?? null : req.query?.reg ?? null;

  try {
    const norm = normaliseAndValidateVRM(rawReg);
    if (!norm.ok) {
      await safeLog([
        submittedAtUK,
        "/api/dvla",
        rawReg || "",
        ip,
        userAgent,
        req.method,
        400,
        "Invalid VRM",
        ...(isPost ? [customerName, customerPhone] : []),
      ]);
      return sendJson(res, origin, 400, { error: norm.error });
    }

    const cd = simpleCooldown(ip, norm.vrm);
    if (cd.blocked) {
      await safeLog([
        submittedAtUK,
        "/api/dvla",
        norm.vrm,
        ip,
        userAgent,
        req.method,
        429,
        "Rate limited",
        ...(isPost ? [customerName, customerPhone] : []),
      ]);
      return rateLimitResponse(res, origin, cd.retryAfterSec, cd.which);
    }

    const dvla = await fetchDvla(norm.vrm);
    const tyresRaw = dvla.ok
      ? await fetchOETyresRaw(norm.vrm).catch(() => ({ ok: false, status: 500, data: null }))
      : null;

    await safeLog([
      submittedAtUK,
      "/api/dvla",
      norm.vrm,
      ip,
      userAgent,
      req.method,
      dvla.status,
      dvla.ok ? "Success" : "Failed",
      ...(isPost ? [customerName, customerPhone] : []),
    ]);

    if (isPost) {
      const web3formsKey = process.env.WEB3FORMS_KEY;
      const web3formsFromEmail = process.env.WEB3FORMS_FROM_EMAIL;
      if (web3formsKey && web3formsFromEmail) {
        const message = `A customer has searched their registration but not yet placed an order.

Registration: ${norm.vrm}
Name: ${customerName}
Phone: ${customerPhone}
Time (UK): ${submittedAtUK}`;

        await sendWeb3Email({
          key: web3formsKey,
          fromName: "DVLA Lookup Tracker",
          fromEmail: web3formsFromEmail,
          replyTo: web3formsFromEmail,
          subject: `Pending Order Lookup – ${norm.vrm}`,
          message,
        }).catch(() => {});
      }
    }

    return sendJson(res, origin, dvla.ok ? 200 : dvla.status, {
      ok: dvla.ok,
      dvla: dvla.data,
      tyres: tyresRaw?.data,
    });
  } catch (err) {
    await safeLog([submittedAtUK, "/api/dvla", "", ip, userAgent, req.method, 500, "Server error"]);
    return sendJson(res, origin, 500, { error: "Server error" });
  }
};
