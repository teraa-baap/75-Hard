import pkg from "garmin-connect";
const { GarminConnect } = pkg;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { date } = req.query;
  if (!date) return res.status(400).json({ error: "date required (YYYY-MM-DD)" });

  try {
    const client = new GarminConnect({ username: "x", password: "x" });

    const oauth1 = JSON.parse(process.env.GARMIN_OAUTH1 || "null");
    const oauth2 = JSON.parse(process.env.GARMIN_OAUTH2 || "null");

    if (!oauth1 || !oauth2) {
      return res.status(500).json({ error: "No OAuth tokens — add GARMIN_OAUTH1 and GARMIN_OAUTH2 to Vercel env vars", setup: true });
    }

    client.client.oauth1Token = oauth1;
    client.client.oauth2Token = oauth2;
    client.client.client.defaults.headers.common["Authorization"] = `Bearer ${oauth2.access_token}`;

    const dateObj = new Date(`${date}T12:00:00`);
    const axiosInstance = client.client.client;

    const [stepsRes, sleepRes, caloriesRes, activitiesRes] = await Promise.allSettled([
      client.getSteps(dateObj),
      client.getSleepData(dateObj),
      axiosInstance.get(`https://connectapi.garmin.com/usersummary-service/stats/calories/daily/${date}/${date}`),
      client.getActivities(0, 100),
    ]);

    const steps = stepsRes.status === "fulfilled" ? (stepsRes.value || 0) : 0;
    const sl = sleepRes.status === "fulfilled" ? sleepRes.value : null;
    const dto = sl?.dailySleepDTO || null;

    const calData = caloriesRes.status === "fulfilled"
      ? (Array.isArray(caloriesRes.value?.data) ? caloriesRes.value.data[0]?.values : null)
      : null;

    const totalCalories = calData?.totalCalories || 0;
    const activeCalories = calData?.activeCalories || 0;
    const bmrCalories = calData?.restingCalories || 0;

    const allActivities = activitiesRes.status === "fulfilled" ? (activitiesRes.value || []) : [];
    const dayActivities = allActivities.filter(a => a.startTimeLocal?.startsWith(date));

    return res.status(200).json({
      date,
      steps: steps || 0,
      totalCalories,
      activeCalories,
      bmrCalories,
      activityCalories: dayActivities.map(a => ({
        name: a.activityName || a.activityType?.typeKey || "Workout",
        type: a.activityType?.typeKey || "unknown",
        calories: a.calories || 0,
        bmrCalories: a.bmrCalories || 0,
        duration: Math.round(a.duration || 0),
        startTime: a.startTimeLocal,
        isOutdoor: ["running","cycling","walking","hiking","trail_running","open_water_swimming"].includes(a.activityType?.typeKey),
      })),
      sleep: dto ? {
        score: dto.sleepScores?.overall?.value || dto.sleepScore || null,
        durationSeconds: dto.sleepTimeSeconds || 0,
        startTime: dto.sleepStartTimestampLocal || null,
        endTime: dto.sleepEndTimestampLocal || null,
        deepSeconds: dto.deepSleepSeconds || 0,
        lightSeconds: dto.lightSleepSeconds || 0,
        remSeconds: dto.remSleepSeconds || 0,
        awakeSeconds: dto.awakeSleepSeconds || 0,
        averageSpO2: sl?.wellnessSpO2SleepSummaryDTO?.averageSPO2 || dto.averageSpO2Value || null,
        averageHrv: sl?.avgOvernightHrv || dto.averageHrvValue || null,
        restingHeartRate: sl?.restingHeartRate || dto.restingHeartRate || null,
        bodyBattery: sl?.bodyBatteryChange || dto.bodyBatteryChange || null,
      } : null,
      _debug: {
        stepsStatus: stepsRes.status,
        stepsError: stepsRes.reason?.message,
        caloriesStatus: caloriesRes.status,
        caloriesError: caloriesRes.reason?.message,
        activitiesStatus: activitiesRes.status,
        activitiesError: activitiesRes.reason?.message,
        activitiesTotal: allActivities.length,
        activitiesForDate: dayActivities.length,
        sampleDates: allActivities.slice(0,3).map(a => a.startTimeLocal?.slice(0,10)),
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
