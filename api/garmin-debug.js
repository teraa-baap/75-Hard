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

    const [summary1, summary2] = await Promise.allSettled([
      client.get(`https://connect.garmin.com/proxy/usersummary-service/usersummary/daily/${date}?source=ALL`),
      client.get(`https://connect.garmin.com/proxy/usersummary-service/usersummary/daily/${date}`),
    ]);

    return res.status(200).json({
      withSource: summary1.status === "fulfilled"
        ? { totalKilocalories: summary1.value?.totalKilocalories, activeKilocalories: summary1.value?.activeKilocalories, bmrKilocalories: summary1.value?.bmrKilocalories }
        : { error: summary1.reason?.message },
      withoutSource: summary2.status === "fulfilled"
        ? { totalKilocalories: summary2.value?.totalKilocalories, activeKilocalories: summary2.value?.activeKilocalories, bmrKilocalories: summary2.value?.bmrKilocalories }
        : { error: summary2.reason?.message },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
