import pkg from "garmin-connect";
const { GarminConnect } = pkg;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: "date required" });

  try {
    const client = new GarminConnect({ username: process.env.GARMIN_EMAIL, password: process.env.GARMIN_PASSWORD });
    await client.login(process.env.GARMIN_EMAIL, process.env.GARMIN_PASSWORD);
    const inner = client.client;
    const axiosInstance = inner.client;

    // Intercept ALL requests to capture headers and URLs
    const intercepted = [];
    const interceptorId = axiosInstance.interceptors.request.use((config) => {
      intercepted.push({
        url: config.url,
        method: config.method,
        headers: {
          Authorization: config.headers?.Authorization?.slice(0, 60),
          Cookie: config.headers?.Cookie?.slice(0, 100),
          NK: config.headers?.NK,
          ...Object.fromEntries(
            Object.entries(config.headers || {})
              .filter(([k]) => !['common','delete','get','head','post','put','patch'].includes(k))
              .map(([k,v]) => [k, typeof v === 'string' ? v.slice(0,80) : v])
          )
        },
      });
      return config;
    });

    // Make a working call to capture what headers it uses
    const dateObj = new Date(`${date}T12:00:00`);
    await client.getSteps(dateObj).catch(() => {});

    // Remove interceptor
    axiosInstance.interceptors.request.eject(interceptorId);

    // Now use the EXACT same headers from the intercepted request
    // to call the daily summary endpoint
    const workingRequest = intercepted[0];
    let summaryResult = null;
    if (workingRequest) {
      const summaryUrl = `https://connect.garmin.com/proxy/usersummary-service/usersummary/daily/${date}`;
      const r = await fetch(summaryUrl, {
        headers: {
          ...workingRequest.headers,
          Authorization: workingRequest.headers.Authorization, // use exact same auth
        }
      });
      summaryResult = await r.json().catch(() => ({}));
    }

    return res.status(200).json({
      interceptedCount: intercepted.length,
      requestHeaders: intercepted[0]?.headers,
      requestUrl: intercepted[0]?.url,
      summaryResult: {
        totalKilocalories: summaryResult?.totalKilocalories,
        activeKilocalories: summaryResult?.activeKilocalories,
        bmrKilocalories: summaryResult?.bmrKilocalories,
        isEmpty: !summaryResult || JSON.stringify(summaryResult) === "{}",
        raw: JSON.stringify(summaryResult).slice(0, 200),
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
