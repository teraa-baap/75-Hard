import pkg from "garmin-connect";
const { GarminConnect } = pkg;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: "date required" });

  try {
    const client = new GarminConnect({ username: "x", password: "x" });

    const oauth1 = JSON.parse(process.env.GARMIN_OAUTH1 || "null");
    const oauth2 = JSON.parse(process.env.GARMIN_OAUTH2 || "null");

    if (!oauth1 || !oauth2) {
      return res.status(500).json({ error: "No OAuth tokens in env vars", hasOauth1: !!oauth1, hasOauth2: !!oauth2 });
    }

    // Inject tokens — no login needed
    client.client.oauth1Token = oauth1;
    client.client.oauth2Token = oauth2;
    client.client.client.defaults.headers.common["Authorization"] = `Bearer ${oauth2.access_token}`;

    const dateObj = new Date(`${date}T12:00:00`);
    const axiosInstance = client.client.client;
    const results = {};

    try {
      const s = await client.getSteps(dateObj);
      results.steps = { ok: true, value: s };
    } catch(e) { results.steps = { ok: false, error: e.message }; }

    try {
      const c = await axiosInstance.get(
        `https://connectapi.garmin.com/usersummary-service/stats/calories/daily/${date}/${date}`
      );
      results.calories = { ok: true, data: c.data };
    } catch(e) { results.calories = { ok: false, error: e.message, status: e.response?.status }; }

    try {
      const a = await client.getActivities(0, 20);
      results.activities = {
        ok: true, count: a?.length,
        sample: a?.slice(0, 5).map(x => ({
          name: x.activityName,
          date: x.startTimeLocal?.slice(0, 10),
          calories: x.calories,
          type: x.activityType?.typeKey,
        }))
      };
    } catch(e) { results.activities = { ok: false, error: e.message }; }

    try {
      const sl = await client.getSleepData(dateObj);
      results.sleep = { ok: true, hasDto: !!sl?.dailySleepDTO, score: sl?.dailySleepDTO?.sleepScore };
    } catch(e) { results.sleep = { ok: false, error: e.message }; }

    return res.status(200).json({
      date,
      tokenStatus: { hasOauth1: !!oauth1, hasOauth2: !!oauth2, tokenExpiry: new Date(oauth2.expires_at * 1000).toISOString() },
      results
    });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}
