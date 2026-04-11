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

async function gFetch(url, consumer, oauth1, oauth2AccessToken) {
  const auth = oauthSign("GET", url, consumer.key, consumer.secret, oauth1.oauth_token, oauth1.oauth_token_secret);
  const headers = { "Authorization": auth, "Accept": "application/json", "NK": "NT", "X-app-ver": "4.6.1.4" };
  if (oauth2AccessToken) headers["Di-Backend"] = "connectapi.garmin.com";
  const r = await fetch(url, { headers });
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
    const oauth2 = inner.oauth2Token;
    const consumer = inner.OAUTH_CONSUMER;

    // Get full profile to find numeric user ID
    const profile = await client.getUserProfile();
    const settings = await client.getUserSettings();
    
    const userId = profile?.id || profile?.userId || profile?.userProfileId || 
                   settings?.id || settings?.userId;
    const profileKeys = profile ? Object.keys(profile) : [];
    const settingsKeys = settings ? Object.keys(settings) : [];

    // Try with numeric user ID
    const results = {};
    if (userId) {
      const r1 = await gFetch(
        `https://connect.garmin.com/proxy/usersummary-service/usersummary/daily/${date}?_=${userId}`,
        consumer, oauth1
      );
      results[`with_userId_param`] = { status: r1.status, totalKilocalories: r1.data?.totalKilocalories, isEmpty: JSON.stringify(r1.data) === "{}" };

      const r2 = await gFetch(
        `https://connect.garmin.com/proxy/usersummary-service/usersummary/${userId}/day/${date}`,
        consumer, oauth1
      );
      results[`userId_day`] = { status: r2.status, totalKilocalories: r2.data?.totalKilocalories, isEmpty: JSON.stringify(r2.data) === "{}" };
    }

    // Try _userHash from client
    const userHash = client._userHash;
    if (userHash) {
      const r3 = await gFetch(
        `https://connect.garmin.com/proxy/usersummary-service/usersummary/${userHash}/day/${date}`,
        consumer, oauth1
      );
      results[`userHash_day`] = { status: r3.status, totalKilocalories: r3.data?.totalKilocalories, isEmpty: JSON.stringify(r3.data) === "{}" };
    }

    return res.status(200).json({
      userId,
      userHash,
      profileKeys,
      settingsKeys,
      results,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
