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

async function gFetch(url, consumer, oauth1, extraHeaders = {}) {
  const auth = oauthSign("GET", url, consumer.key, consumer.secret, oauth1.oauth_token, oauth1.oauth_token_secret);
  const r = await fetch(url, { headers: { "Authorization": auth, "Accept": "application/json", "NK": "NT", "X-app-ver": "4.6.1.4", ...extraHeaders } });
  const text = await r.text();
  try { return { status: r.status, data: JSON.parse(text) }; }
  catch { return { status: r.status, raw: text.slice(0, 300) }; }
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
    const userId = 435956158;
    const displayName = "f4dddd54-5802-4096-96cf-f15f39a7c40f";

    const urls = {
      // numeric ID variants
      num_daily: `https://connect.garmin.com/proxy/usersummary-service/usersummary/daily/${date}?userId=${userId}`,
      num_allday: `https://connect.garmin.com/proxy/usersummary-service/usersummary/allday/${userId}/${date}`,
      num_week: `https://connect.garmin.com/proxy/usersummary-service/usersummary/${userId}/day/${date}`,
      // wellness endpoints
      wellness_cal: `https://connect.garmin.com/proxy/wellness-service/wellness/dailyCalories/${userId}?calendarDate=${date}`,
      wellness_stats: `https://connect.garmin.com/proxy/wellness-service/wellness/dailyStats/${displayName}?calendarDate=${date}`,
      // personal record / stats
      stats: `https://connect.garmin.com/proxy/userstats-service/statistics/${displayName}?fromDate=${date}&untilDate=${date}&metricId=6`,
      // try proxy with session cookie approach - check what _userHash contains
      userHash: `https://connect.garmin.com/proxy/usersummary-service/usersummary/daily/${date}?userHash=${client._userHash}`,
    };

    const results = {};
    for (const [key, url] of Object.entries(urls)) {
      const r = await gFetch(url, consumer, oauth1);
      const d = r.data;
      results[key] = {
        status: r.status,
        totalKilocalories: d?.totalKilocalories,
        activeKilocalories: d?.activeKilocalories,
        isEmpty: !d || JSON.stringify(d) === "{}",
        isArray: Array.isArray(d),
        sample: Array.isArray(d) ? JSON.stringify(d[0]).slice(0,100) : (d && JSON.stringify(d) !== "{}" ? JSON.stringify(d).slice(0,150) : null),
      };
    }

    return res.status(200).json({ userHash: client._userHash, results });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
