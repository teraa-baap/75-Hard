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

    const inner = client.client;        // GarminConnect's HTTP wrapper
    const axios = inner?.client;        // The actual axios instance

    const url = `https://connect.garmin.com/proxy/usersummary-service/usersummary/daily/${date}`;

    const results = {};

    // Try axios directly — response.data is where the payload is
    try {
      const r = await axios.get(url);
      results.axiosDirect = {
        status: r.status,
        dataKeys: Object.keys(r.data || {}),
        totalKilocalories: r.data?.totalKilocalories,
        activeKilocalories: r.data?.activeKilocalories,
        bmrKilocalories: r.data?.bmrKilocalories,
        raw: JSON.stringify(r.data).slice(0, 300),
      };
    } catch(e) { results.axiosDirect = { error: e.message, status: e.response?.status }; }

    // Try inner.get (their wrapper) — check what it actually returns
    try {
      const r = await inner.get(url);
      results.innerGet = {
        type: typeof r,
        isNull: r === null,
        keys: r && typeof r === 'object' ? Object.keys(r) : null,
        raw: JSON.stringify(r).slice(0, 300),
      };
    } catch(e) { results.innerGet = { error: e.message }; }

    // Check axios defaults to see auth headers
    results.axiosDefaults = {
      baseURL: axios?.defaults?.baseURL,
      authHeader: axios?.defaults?.headers?.common?.Authorization?.slice(0, 40),
    };

    return res.status(200).json(results);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
