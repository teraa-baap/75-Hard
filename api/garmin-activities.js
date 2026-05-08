import pkg from "garmin-connect";
const { GarminConnect } = pkg;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { date } = req.query;
  if (!date) return res.status(400).json({ error: "date required" });

  try {
    const client = new GarminConnect({ username: "x", password: "x" });

    const oauth1 = JSON.parse(process.env.GARMIN_OAUTH1 || "null");
    const oauth2 = JSON.parse(process.env.GARMIN_OAUTH2 || "null");

    if (!oauth1 || !oauth2) {
      return res.status(500).json({ error: "No OAuth tokens configured" });
    }

    client.client.oauth1Token = oauth1;
    client.client.oauth2Token = oauth2;
    client.client.client.defaults.headers.common["Authorization"] = `Bearer ${oauth2.access_token}`;

    const all = await client.getActivities(0, 100);
    const day = all.filter(a => a.startTimeLocal?.startsWith(date));

    const OUTDOOR_TYPES = [
      "running", "cycling", "walking", "hiking", "trail_running",
      "open_water_swimming", "road_biking", "mountain_biking",
      "outdoor_walking", "outdoor_running"
    ];

    return res.status(200).json({
      activities: day.map(a => ({
        name: a.activityName || "Workout",
        type: a.activityType?.typeKey || "other",
        calories: a.calories || 0,
        durationSeconds: Math.round(a.duration || a.elapsedDuration || 0),
        distanceMeters: a.distance ? Math.round(a.distance) : null,
        averageHR: a.averageHR || null,
        maxHR: a.maxHR || null,
        elevationGain: a.elevationGain || null,
        trainingEffect: a.aerobicTrainingEffect || null,
        vo2max: a.vO2MaxValue || null,
        startTime: a.startTimeLocal,
        isOutdoor: OUTDOOR_TYPES.includes(a.activityType?.typeKey),
      }))
    });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}
