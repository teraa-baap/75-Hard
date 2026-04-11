import { GarminConnect } from "garmin-connect";

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
    const dateObj = new Date(`${date}T12:00:00`);

    const [summary, sleep] = await Promise.allSettled([
      client.getUserSummary(dateObj),
      client.getSleep(dateObj),
    ]);

    return res.status(200).json({
      summary: summary.status === "fulfilled" ? summary.value : { error: summary.reason?.message },
      sleep: sleep.status === "fulfilled" ? sleep.value : { error: sleep.reason?.message },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
