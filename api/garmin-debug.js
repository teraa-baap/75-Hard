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

    // Use axiosInstance directly — it has auth baked in via interceptors
    // We know connectapi.garmin.com works for steps, try same domain for calories
    const urls = [
      `https://connectapi.garmin.com/usersummary-service/usersummary/daily/${date}`,
      `https://connectapi.garmin.com/usersummary-service/usersummary/daily/${date}?source=ALL`,
      `https://connectapi.garmin.com/usersummary-service/stats/daily/${date}/${date}`,
      `https://connectapi.garmin.com/usersummary-service/stats/calories/daily/${date}/${date}`,
      `https://connectapi.garmin.com/wellness-service/wellness/dailySummaryChart/f4dddd54-5802-4096-96cf-f15f39a7c40f?date=${date}`,
      `https://connectapi.garmin.com/usersummary-service/stats/stress/daily/${date}/${date}`,
    ];

    const results = {};
    for (const url of urls) {
      try {
        const r = await axiosInstance.get(url);
        const d = r.data;
        const key = url.replace("https://connectapi.garmin.com/", "").split("?")[0];
        results[key] = {
          status: r.status,
          totalKilocalories: d?.totalKilocalories,
          activeKilocalories: d?.activeKilocalories,
          bmrKilocalories: d?.bmrKilocalories,
          isEmpty: !d || JSON.stringify(d) === "{}",
          isArray: Array.isArray(d),
          sample: JSON.stringify(Array.isArray(d) ? d[0] : d).slice(0, 200),
        };
      } catch(e) {
        const key = url.replace("https://connectapi.garmin.com/", "").split("?")[0];
        results[key] = { error: e.message, status: e.response?.status };
      }
    }

    return res.status(200).json(results);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
