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

const OUTDOOR_TYPES = ["running","cycling","walking","hiking","trail_running","open_water_swimming","road_biking","mountain_biking"];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { date } = req.query;
  if (!date) return res.status(400).json({ error: "date required" });

  try {
    const client = await getClient();
    const activities = await client.getActivities(0, 30);

    const dateActivities = (activities || []).filter(a => {
      if (!a.startTimeLocal) return false;
      return a.startTimeLocal.startsWith(date);
    });

    const formatted = dateActivities.map(a => ({
      id: a.activityId,
      name: a.activityName || a.activityType?.typeKey || "Workout",
      type: a.activityType?.typeKey || "unknown",
      startTime: a.startTimeLocal,
      durationSeconds: Math.round(a.duration || 0),
      movingDurationSeconds: Math.round(a.movingDuration || a.duration || 0),
      distanceMeters: a.distance || 0,
      calories: Math.round(a.calories || 0),
      averageHR: a.averageHR ? Math.round(a.averageHR) : null,
      maxHR: a.maxHR ? Math.round(a.maxHR) : null,
      elevationGain: a.elevationGain || 0,
      trainingEffect: a.aerobicTrainingEffect || null,
      vo2max: a.vO2MaxValue || null,
      isOutdoor: OUTDOOR_TYPES.includes((a.activityType?.typeKey || "").toLowerCase()),
    }));

    return res.status(200).json({ date, activities: formatted });
  } catch (err) {
    console.error("Garmin activities error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
