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

    // Get user profile first to find the display name
    const profile = await client.getUserProfile();
    const displayName = profile?.displayName || profile?.userName;

    const [s1, s2, s3] = await Promise.allSettled([
      client.get(`https://connect.garmin.com/proxy/usersummary-service/usersummary/daily/${date}?source=ALL`),
      client.get(`https://connect.garmin.com/proxy/usersummary-service/usersummary/${displayName}/day/${date}`),
      client.get(`https://connect.garmin.com/proxy/wellness-service/wellness/dailySummaryChart/${displayName}?date=${date}`),
    ]);

    return res.status(200).json({
      displayName,
      endpoint1: s1.status === "fulfilled" ? s1.value : { error: s1.reason?.message },
      endpoint2: s2.status === "fulfilled"
        ? { totalKilocalories: s2.value?.totalKilocalories, activeKilocalories: s2.value?.activeKilocalories, bmrKilocalories: s2.value?.bmrKilocalories, totalSteps: s2.value?.totalSteps }
        : { error: s2.reason?.message },
      endpoint3: s3.status === "fulfilled" ? (Array.isArray(s3.value) ? s3.value?.slice(0,2) : s3.value) : { error: s3.reason?.message },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
