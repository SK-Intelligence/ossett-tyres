async function sendWeb3Email({ key, fromName, fromEmail, replyTo, subject, message }) {
  const resp = await fetch("https://api.web3forms.com/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      access_key: key,
      from_name: fromName,
      from_email: fromEmail,
      subject,
      reply_to: replyTo,
      message,
    }),
  });

  let raw = "";
  let data = {};
  try {
    raw = await resp.text();
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = raw ? { raw } : {};
  }

  const success = data?.success === true || data?.success === "true" || data?.status === "success";

  return { ok: resp.ok && success, status: resp.status, message: data?.message || data?.raw, data, raw };
}

module.exports = { sendWeb3Email };
