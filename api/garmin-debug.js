import pkg from "garmin-connect";
const { GarminConnect } = pkg;
import crypto from "crypto";

function oauthSign(method, url, consumerKey, consumerSecret, tokenKey, tokenSecret) {
  const p = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: tokenKey,
    oauth_version: "1.0",
  };
  const paramStr = Object.keys(p).sort().map(k => `${encodeURIComponent(k)}=${encodeURIComponent(p[k])}`).join("&");
  const base = `GET&${encodeURIComponent(url)}&${encodeURIComponent(paramStr)}`;
  const key = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  p.oauth_signature = crypto.createHmac("sha1", key).update(base).digest("base64");
  return "OAuth " + Object.keys(p).sort().map(k => `${encodeURIComponent(k)}="${encodeURIComponent(p[k])}"`).join(", ");
}

async function gFetch(url, consumer, oauth1) {
  const auth = oauthSign("GET", url, consumer.key, consumer.secret, oauth1.oauth_token, oauth1.oauth_token_secret);
  const r = await fetch(url, { headers: { "Authorization": auth, "Accept": "application/json", "NK": "NT" } });
  const text = await r.text();
  try { return { status: r.status, data: JSON.parse(text) }; } 
  catch { return { status: r.status, data: text.slice(0, 300) }; }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: "date required" });

  try {
    const client = new GarminConnect({ username: process.env.GARMIN_EMAIL, password: process.env.GARMIN_PASSWORD });
    await client.login(process.env.GARMIN_EMAIL, process.env.GARMIN_PASSWORD);
    const inner = client.client;
    const oauth1 = inner.oauth1Token;
    const consumer = inner.OAUTH_CONSUMER;
    const displayName = "f4dddd54-5802-4096-96cf-f15f39a7c40f";

    // Try today's date too in case old dates are unavailable
    const today = new Date().toISOString().split("T")[0];

    const urls = {
      daily_date: `https://connect.garmin.com/proxy/usersummary-service/usersummary/daily/${date}`,
      daily_today: `https://connect.garmin.com/proxy/usersummary-service/usersummary/daily/${today}`,
      user_day: `https://connect.garmin.com/proxy/usersummary-service/usersummary/${displayName}/day/${date}`,
      wellness_daily: `https://connect.garmin.com/proxy/wellness-service/wellness/dailySummary/${displayName}?calendarDate=${date}`,
      wellness_detail: `https://connect.garmin.com/proxy/wellness-service/wellness/dailySummaryChart/${displayName}?date=${date}`,
      // Try the exact URL Garmin app uses
      usersummary_all: `https://connect.garmin.com/proxy/usersummary-service/usersummary/allday/${displayName}/${date}`,
    };

    const results = {};
    for (const [key, url] of Object.entries(urls)) {
      const r = await gFetch(url, consumer, oauth1);
      results[key] = {
        status: r.status,
        totalKilocalories: r.data?.totalKilocalories,
        activeKilocalories: r.data?.activeKilocalories,
        bmrKilocalories: r.data?.bmrKilocalories,
        isEmpty: JSON.stringify(r.data) === "{}",
        isArray: Array.isArray(r.data),
        arrayLen: Array.isArray(r.data) ? r.data.length : null,
        firstItem: Array.isArray(r.data) ? JSON.stringify(r.data[0]).slice(0, 150) : null,
        error: r.data?.error || r.data?.message,
      };
    }

    return res.status(200).json(results);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
