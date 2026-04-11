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

    const inner = client.client;

    // Inspect what inner._request or inner.request does
    // Check oauth1Token and oauth2Token on inner
    const oauth1 = inner.oauth1Token;
    const oauth2 = inner.oauth2Token;

    // The inner wrapper likely uses _request for signed calls
    // Let's intercept by checking what _request does with a known working URL
    // We know getSteps works — let's trace what URL it actually calls
    
    // Try calling inner._request directly
    const url = `https://connect.garmin.com/proxy/usersummary-service/usersummary/daily/${date}`;
    
    let requestResult = null;
    try {
      // _request likely returns the axios response object
      if (typeof inner._request === 'function') {
        const r = await inner._request('GET', url, null, null);
        requestResult = {
          type: typeof r,
          keys: r ? Object.keys(r) : null,
          dataKeys: r?.data ? Object.keys(r.data) : null,
          totalKilocalories: r?.data?.totalKilocalories || r?.totalKilocalories,
          raw: JSON.stringify(r?.data || r).slice(0, 400),
        };
      }
    } catch(e) { requestResult = { error: e.message }; }

    return res.status(200).json({
      hasOauth1: !!oauth1,
      hasOauth2: !!oauth2,
      oauth1Keys: oauth1 ? Object.keys(oauth1) : null,
      oauth2Keys: oauth2 ? Object.keys(oauth2) : null,
      innerMethods: Object.getOwnPropertyNames(Object.getPrototypeOf(inner)).filter(m => m !== 'constructor'),
      requestResult,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
