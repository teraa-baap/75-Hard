import pkg from "garmin-connect";
const { GarminConnect } = pkg;

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

    // Inspect client.client (internal HTTP client)
    const inner = client.client;
    const innerKeys = inner ? Object.keys(inner) : [];
    const innerDefaults = inner?.defaults || inner?._defaults;
    const headers = innerDefaults?.headers || inner?.headers;
    const authHeader = headers?.Authorization || headers?.authorization || 
                       headers?.common?.Authorization;

    // Also check _userHash
    const userHash = client._userHash;

    // Try using exportToken which is a known method
    let tokenData = null;
    try { tokenData = await client.exportToken(); } catch(e) {}

    // Inspect token data
    const accessToken = tokenData?.oauth2?.access_token || 
                        tokenData?.access_token ||
                        (typeof tokenData === 'string' ? tokenData : null);

    let summaryResult = null;
    if (accessToken) {
      const r = await fetch(
        `https://connectapi.garmin.com/usersummary-service/usersummary/daily/${date}`,
        { headers: { "Authorization": `Bearer ${accessToken}`, "Accept": "application/json", "Di-Backend": "connectapi.garmin.com" } }
      );
      summaryResult = await r.json().catch(() => ({ httpStatus: r.status }));
    }

    return res.status(200).json({
      innerKeys,
      authHeader: authHeader ? authHeader.slice(0, 40) + "..." : null,
      userHash,
      tokenDataKeys: tokenData ? Object.keys(tokenData) : null,
      hasAccessToken: !!accessToken,
      accessTokenPreview: accessToken ? accessToken.slice(0, 30) + "..." : null,
      summaryResult,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
