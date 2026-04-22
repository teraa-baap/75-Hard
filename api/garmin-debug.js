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
    const axiosInstance = client.client.client;
    const dateObj = new Date(`${date}T12:00:00`);

    // Test each call independently and capture full errors
    const results = {};

    // Steps
    try {
      const s = await client.getSteps(dateObj);
      results.steps = { ok: true, value: s };
    } catch(e) {
      results.steps = { ok: false, error: e.message };
    }

    // Calories
    try {
      const c = await axiosInstance.get(
        `https://connectapi.garmin.com/usersummary-service/stats/calories/daily/${date}/${date}`
      );
      results.calories = { ok: true, data: c.data };
    } catch(e) {
      results.calories = { ok: false, error: e.message, status: e.response?.status };
    }

    // Activities — try different counts
    try {
      const a = await client.getActivities(0, 20);
      results.activities = {
        ok: true,
        count: a?.length,
        all: a?.slice(0, 10).map(x => ({
          name: x.activityName,
          startTimeLocal: x.startTimeLocal,
          startTimeGMT: x.startTimeGMT,
          calories: x.calories,
          type: x.activityType?.typeKey,
        }))
      };
    } catch(e) {
      results.activities = { ok: false, error: e.message };
    }

    // Sleep
    try {
      const sl = await client.getSleepData(dateObj);
      results.sleep = { ok: true, hasDto: !!sl?.dailySleepDTO, score: sl?.dailySleepDTO?.sleepScore };
    } catch(e) {
      results.sleep = { ok: false, error: e.message };
    }

    return res.status(200).json({ date, results });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}
