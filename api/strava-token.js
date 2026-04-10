
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { code, refresh_token, grant_type } = req.body;

  try {
    const body = new URLSearchParams({
      client_id: "223103",
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: grant_type || "authorization_code",
      ...(grant_type === "refresh_token" ? { refresh_token } : { code }),
    });

    const response = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    const data = await response.json();
    if (!response.ok) return res.status(400).json({ error: data.message || "Token exchange failed" });
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: "Server error", details: err.message });
  }
}
