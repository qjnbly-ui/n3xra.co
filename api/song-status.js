function sendJson(res, status, body) {
  res.status(status).json(body);
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  const apiKey = process.env.SONAUTO_API_KEY;
  if (!apiKey) {
    return sendJson(res, 500, { error: "Missing SONAUTO_API_KEY." });
  }

  const taskId = typeof req.query.task_id === "string" ? req.query.task_id.trim() : "";
  if (!taskId) {
    return sendJson(res, 400, { error: "Missing task_id." });
  }

  try {
    const response = await fetch(`https://api.sonauto.ai/v1/generations/${encodeURIComponent(taskId)}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const data = await response.json().catch(() => ({}));
    return sendJson(res, response.status, data);
  } catch (error) {
    return sendJson(res, 502, {
      error: "Could not reach Sonauto.",
      message: error instanceof Error ? error.message : "Unknown upstream error.",
    });
  }
};
