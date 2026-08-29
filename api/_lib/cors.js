const allowedOrigins = ["https://ossettyres.co.uk", "https://www.ossettyres.co.uk"];

function isOriginAllowed(origin) {
  if (!origin) return false;
  return allowedOrigins.includes(origin);
}

function applyCors(res, origin, methods) {
  const useOrigin = allowedOrigins.includes(origin || "") ? origin : allowedOrigins[0];
  res.setHeader("Access-Control-Allow-Origin", useOrigin);
  res.setHeader("Access-Control-Allow-Methods", methods || "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function sendJson(res, origin, status, body) {
  applyCors(res, origin);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

module.exports = { allowedOrigins, isOriginAllowed, applyCors, sendJson };
