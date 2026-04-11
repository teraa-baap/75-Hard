import pkg from "garmin-connect";
const { GarminConnect } = pkg;
import crypto from "crypto";

function oauthSign(method, url, params, consumerKey, consumerSecret, tokenKey, tokenSecret) {
  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: tokenKey,
    oauth_version: "1.0",
    ...params,
  };
  const sortedKeys = Object.keys(oauthParams).sort();
  const paramStr = sortedKeys.map(k => `${encodeURIComponent(k)}=${encodeURIComponent(oauthParams[k])}`).join("&");
  const baseStr = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(paramStr)}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  const signature = crypto.createHmac("sha1", signingKey).update(baseStr).digest("base64");
  oauthParams.oauth_signature = signature;
  const header = "OAuth " + Object.keys(oauthParams).sort().map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`).join(", ");
  return header;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: "date required" });

  try {
    const client = new GarminConnect({
      username: process.env.GARMIN_EMAIL,
      password: process.env.GARMIN_PASSWORD,
    });
    await client.login(process.env.GARMIN_EMAIL, process.env.GARMIN_PASSWORD);

    const inner = client.client;
    const oauth1 = inner.oauth1Token;
    const oauth2 = inner.oauth2Token;
    const consumer = inner.OAUTH_CONSUMER;

    const url = `https://connect.garmin.com/proxy/usersummary-service/usersummary/daily/${date}`;

    // Try OAuth1 signing
    const authHeader = oauthSign(
      "GET", url, {},
      consumer.key || consumer.oauth_consumer_key,
      consumer.secret || consumer.oauth_consumer_secret,
      oauth1.oauth_token,
      oauth1.oauth_token_secret
    );

    const r = await fetch(url, {
      headers: {
        "Authorization": authHeader,
        "Accept": "application/json",
        "NK": "NT",
        "X-app-ver": "4.6.1.4",
      }
    });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text.slice(0, 500); }

    // Also try with both OAuth1 + Bearer
    const r2 = await fetch(url, {
      headers: {
        "Authorization": authHeader,
        "Authorization2": `Bearer ${oauth2.access_token}`,
        "Accept": "application/json",
        "NK": "NT",
      }
    });
    const data2 = await r2.json().catch(() => ({}));

    return res.status(200).json({
      consumerKeys: consumer ? Object.keys(consumer) : null,
      oauth1Status: r.status,
      oauth1Result: {
        totalKilocalories: data?.totalKilocalories,
        activeKilocalories: data?.activeKilocalories,
        bmrKilocalories: data?.bmrKilocalories,
        error: data?.error || data?.message,
        rawSlice: typeof data === 'string' ? data : JSON.stringify(data).slice(0, 200),
      },
      oauth1And2Status: r2.status,
      oauth1And2Result: {
        totalKilocalories: data2?.totalKilocalories,
        error: data2?.error,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message, stack: err.stack?.split('\n').slice(0,3) });
  }
}
