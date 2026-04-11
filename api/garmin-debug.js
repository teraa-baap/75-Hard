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

    // Inspect the client internals to find auth tokens/cookies
    const clientKeys = Object.keys(client);
    const clientProto = Object.getOwnPropertyNames(Object.getPrototypeOf(client));
    
    // Try to get the oauth token from client internals
    const oauth2Token = client.oauth2Token || client._oauth2Token || client.token || client._token;
    const accessToken = oauth2Token?.access_token;

    // Try fetching with Bearer token directly
    let bearerResult = null;
    if (accessToken) {
      const r = await fetch(
        `https://connectapi.garmin.com/usersummary-service/usersummary/daily/${date}?source=ALL`,
        { headers: { "Authorization": `Bearer ${accessToken}`, "Accept": "application/json" } }
      );
      bearerResult = await r.json().catch(() => ({ status: r.status }));
    }

    // Try the wellness endpoint with bearer
    let wellnessResult = null;
    if (accessToken) {
      const r2 = await fetch(
        `https://connectapi.garmin.com/wellness-service/wellness/dailySummaryChart/f4dddd54-5802-4096-96cf-f15f39a7c40f?date=${date}`,
        { headers: { "Authorization": `Bearer ${accessToken}`, "Accept": "application/json" } }
      );
      wellnessResult = await r2.json().catch(() => ({ status: r2.status }));
    }

    return res.status(200).json({
      hasAccessToken: !!accessToken,
      accessTokenPreview: accessToken ? accessToken.slice(0, 30) + "..." : null,
      clientKeys: clientKeys.slice(0, 20),
      bearerResult: bearerResult ? (Array.isArray(bearerResult) ? bearerResult[0] : bearerResult) : null,
      wellnessResult: Array.isArray(wellnessResult) ? wellnessResult[0] : wellnessResult,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message, stack: err.stack?.split('\n').slice(0,3) });
  }
}
