const lastRequest = new Map();

/** Cooldown: per-IP (2s) and per-IP+VRM (10s). Best-effort within a warm serverless instance. */
function simpleCooldown(ip, vrm) {
  const now = Date.now();
  const ipKey = `ip:${ip}`;
  const ipVrmKey = `ipvrm:${ip}:${vrm}`;

  const tooSoon = (key, ms) => {
    const last = lastRequest.get(key) || 0;
    if (now - last < ms) return true;
    lastRequest.set(key, now);
    return false;
  };

  if (tooSoon(ipVrmKey, 10_000)) return { blocked: true, retryAfterSec: 10, which: "IP+VRM" };
  if (tooSoon(ipKey, 2_000)) return { blocked: true, retryAfterSec: 2, which: "IP" };
  return { blocked: false, retryAfterSec: 0, which: null };
}

module.exports = { simpleCooldown };
