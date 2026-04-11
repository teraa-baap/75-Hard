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

    const [stepsRes, sleepRes] = await Promise.allSettled([
      client.getSteps(dateObj),
      client.getSleepData(dateObj),
    ]);

    const steps = stepsRes.status === "fulfilled" ? stepsRes.value : 0;
    const sl = sleepRes.status === "fulfilled" ? sleepRes.value : null;
    const dto = sl?.dailySleepDTO || null;

    return res.status(200).json({
      date,
      steps: steps || 0,
      activeCalories: 0, // not available via this method
      sleep: dto ? {
        score: dto.sleepScores?.overall?.value || dto.sleepScore || null,
        durationSeconds: dto.sleepTimeSeconds || 0,
        startTime: dto.sleepStartTimestampLocal
          ? new Date(dto.sleepStartTimestampLocal).toISOString()
          : null,
        endTime: dto.sleepEndTimestampLocal
          ? new Date(dto.sleepEndTimestampLocal).toISOString()
          : null,
        deepSeconds: dto.deepSleepSeconds || 0,
        lightSeconds: dto.lightSleepSeconds || 0,
        remSeconds: dto.remSleepSeconds || 0,
        awakeSeconds: dto.awakeSleepSeconds || 0,
        averageSpO2: sl?.wellnessSpO2SleepSummaryDTO?.averageSPO2 || dto.averageSpO2Value || null,
        averageHrv: sl?.avgOvernightHrv || dto.averageHrvValue || null,
        restingHeartRate: sl?.restingHeartRate || dto.restingHeartRate || null,
        bodyBattery: sl?.bodyBatteryChange || dto.bodyBatteryChange || null,
      } : null,
    });
  } catch (err) {
    console.error("Garmin data error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
