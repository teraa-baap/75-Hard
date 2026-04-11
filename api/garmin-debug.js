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

    // Use client.client which is the internal axios-like instance with auth baked in
    const inner = client.client;
    const innerClientKeys = Object.keys(inner?.client || {});
    const innerInnerKeys = Object.keys(inner?.client?.client || {});

    // Try calling get directly on client.client
    const results = {};
    const urls = [
      `https://connect.garmin.com/proxy/usersummary-service/usersummary/daily/${date}`,
      `https://connect.garmin.com/proxy/usersummary-service/usersummary/daily/${date}?source=ALL`,
      `https://connect.garmin.com/proxy/usersummary-service/usersummary/f4dddd54-5802-4096-96cf-f15f39a7c40f/day/${date}`,
    ];

    for (const url of urls) {
      try {
        const key = url.split('/').slice(-2).join('/');
        // Try using inner.get if available
        if (typeof inner?.get === 'function') {
          const r = await inner.get(url);
          results[key] = { via: 'inner.get', data: r?.data || r };
        }
      } catch(e) {
        results[url.split('/').slice(-1)[0]] = { error: e.message };
      }
    }

    // Also try client.get with full URL
    try {
      const r = await client.get(`https://connect.garmin.com/proxy/usersummary-service/usersummary/daily/${date}`);
      results['client.get'] = r;
    } catch(e) {
      results['client.get'] = { error: e.message };
    }

    return res.status(200).json({
      innerKeys: Object.keys(inner || {}),
      innerClientKeys,
      results,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
