import pkg from "garmin-connect";
const { GarminConnect } = pkg;

let cachedClient = null;
let cacheExpiry = 0;

async function getClient() {
  if (cachedClient && Date.now() < cacheExpiry) return cachedClient;
  const client = new GarminConnect({
    username: process.env.GARMIN_EMAIL,
    password: process.env.GARMIN_PASSWORD,
  });
  await client.login(process.env.GARMIN_EMAIL, process.env.GARMIN_PASSWORD);
  cachedClient = client;
  cacheExpiry = Date.now() + 30 * 60 * 1000;
  return client;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { date } = req.query;
  if (!date) return res.status(400).json({ error: "date required (YYYY-MM-DD)" });

  try {
    const client = await getClient();
    const dateObj = new Date(`${date}T12:00:00`);

    const [summary, sleep] = await Promise.allSettled([
      client.getUserSummary(dateObj),
      client.getSleep(dateObj),
    ]);

    const s = summary.status === "fulfilled" ? summary.value : null;
    const sl = sleep.status === "fulfilled" ? sleep.value : null;

    return res.status(200).json({
      date,
      steps: s?.totalSteps || 0,
      calories: s?.totalKilocalories || 0,
      activeCalories: s?.activeKilocalories || 0,
      distanceMeters: s?.totalDistanceMeters || 0,
      floorsClimbed: s?.floorsAscended || 0,
      averageStressLevel: s?.averageStressLevel || null,
      sleep: sl ? {
        score: sl.dailySleepDTO?.sleepScores?.overall?.value || sl.dailySleepDTO?.sleepScore || null,
        durationSeconds: sl.dailySleepDTO?.sleepTimeSeconds || 0,
        startTime: sl.dailySleepDTO?.sleepStartTimestampLocal || null,
        endTime: sl.dailySleepDTO?.sleepEndTimestampLocal || null,
        deepSeconds: sl.dailySleepDTO?.deepSleepSeconds || 0,
        lightSeconds: sl.dailySleepDTO?.lightSleepSeconds || 0,
        remSeconds: sl.dailySleepDTO?.remSleepSeconds || 0,
        awakeSeconds: sl.dailySleepDTO?.awakeSleepSeconds || 0,
        averageSpO2: sl.dailySleepDTO?.averageSpO2Value || null,
        averageHrv: sl.dailySleepDTO?.averageHrvValue || null,
        restingHeartRate: sl.dailySleepDTO?.restingHeartRate || null,
        bodyBattery: sl.dailySleepDTO?.bodyBatteryChange || null,
      } : null,
    });
  } catch (err) {
    console.error("Garmin data error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
