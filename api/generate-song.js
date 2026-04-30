function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  return {};
}

function sendJson(res, status, body) {
  res.status(status).json(body);
}

const generationLocks = globalThis.__n3xraMusicGenerationLocks || new Map();
globalThis.__n3xraMusicGenerationLocks = generationLocks;

function getCookie(req, name) {
  const rawCookie = typeof req.headers.cookie === "string" ? req.headers.cookie : "";
  const match = rawCookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

function getClientIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) return realIp.trim();

  return req.socket?.remoteAddress || "unknown";
}

function createBrowserId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function setUsageCookies(res, browserId) {
  res.setHeader("Set-Cookie", [
    `n3xra_music_browser=${encodeURIComponent(browserId)}; Path=/; Max-Age=2592000; SameSite=Lax; Secure`,
    "n3xra_music_used=true; Path=/; Max-Age=2592000; SameSite=Lax; Secure",
  ]);
}

function pruneLocks(now) {
  const ttl = 1000 * 60 * 60 * 24 * 30;
  for (const [key, value] of generationLocks.entries()) {
    if (now - value > ttl) generationLocks.delete(key);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  const apiKey = process.env.SONAUTO_API_KEY;
  if (!apiKey) {
    return sendJson(res, 500, { error: "Missing SONAUTO_API_KEY." });
  }

  const now = Date.now();
  pruneLocks(now);

  let browserId = getCookie(req, "n3xra_music_browser");
  if (!browserId) browserId = createBrowserId();

  const browserKey = `browser:${browserId}`;
  const ipKey = `ip:${getClientIp(req)}`;
  if (getCookie(req, "n3xra_music_used") === "true" || generationLocks.has(browserKey) || generationLocks.has(ipKey)) {
    setUsageCookies(res, browserId);
    return sendJson(res, 429, {
      error: "This browser has already generated a song. Billing options are coming soon.",
    });
  }

  const body = readBody(req);
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  const lyrics = typeof body.lyrics === "string" ? body.lyrics : "";
  const instrumental = Boolean(body.instrumental);
  const tags = Array.isArray(body.tags)
    ? body.tags.filter((tag) => typeof tag === "string" && tag.trim()).map((tag) => tag.trim())
    : undefined;

  if (!prompt.trim() && !lyrics.trim() && (!tags || tags.length === 0)) {
    return sendJson(res, 400, { error: "Add a prompt, tags, or lyrics." });
  }

  if (instrumental && lyrics.trim()) {
    return sendJson(res, 400, { error: "Instrumental songs cannot include lyrics." });
  }

  const payload = { instrumental };
  if (prompt || lyrics) payload.prompt = prompt;
  if (tags && tags.length) payload.tags = tags;
  if (lyrics) payload.lyrics = lyrics;

  try {
    const response = await fetch("https://api.sonauto.ai/v1/generations/v3", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (response.ok && data.task_id) {
      generationLocks.set(browserKey, now);
      generationLocks.set(ipKey, now);
      setUsageCookies(res, browserId);
    }

    return sendJson(res, response.status, data);
  } catch (error) {
    return sendJson(res, 502, {
      error: "Could not reach Sonauto.",
      message: error instanceof Error ? error.message : "Unknown upstream error.",
    });
  }
};
