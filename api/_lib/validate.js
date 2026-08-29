function normaliseAndValidateVRM(input) {
  const vrm = (input || "").trim().toUpperCase();
  if (!vrm) return { ok: false, error: "Use ?reg=YOURREG or provide registrationNumber" };
  if (!/^[A-Z0-9]{1,8}$/.test(vrm)) return { ok: false, error: "Invalid VRM format" };
  return { ok: true, vrm };
}

module.exports = { normaliseAndValidateVRM };
