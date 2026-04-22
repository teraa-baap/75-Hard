import pkg from "garmin-connect";
const { GarminConnect } = pkg;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { date } = req.query;
  if (!date) return res.status(400).json({ error: "date required (YYYY-MM-DD)" });

  try {
    // Fresh login every time — Vercel functions are stateless, caching causes stale tokens
    const client = new GarminConnect({
      username: process.env.GARMIN_EMAIL,
      password: process.env.GARMIN_PASSWORD,
    });
    await client.login(process.env.GARMIN_EMAIL, process.env.GARMIN_PASSWORD);

    const dateObj = new Date(`${date}T12:00:00`);
    const axiosInstance = client.client.client;

    const [stepsRes, sleepRes, caloriesRes, activitiesRes] = await Promise.allSettled([
      client.getSteps(dateObj),
      client.getSleepData(dateObj),
      axiosInstance.get(
        `https://connectapi.garmin.com/usersummary-service/stats/calories/daily/${date}/${date}`
      ),
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
    const dayActivities = allActivities.filter(a => {
      if (!a.startTimeLocal) return false;
      return a.startTimeLocal.startsWith(date);
    });

    const debugInfo = {
      stepsStatus: stepsRes.status,
      stepsError: stepsRes.status === "rejected" ? stepsRes.reason?.message : undefined,
      sleepStatus: sleepRes.status,
      caloriesStatus: caloriesRes.status,
      caloriesError: caloriesRes.status === "rejected" ? caloriesRes.reason?.message : undefined,
      activitiesStatus: activitiesRes.status,
      activitiesError: activitiesRes.status === "rejected" ? activitiesRes.reason?.message : undefined,
      totalActivitiesFetched: allActivities.length,
      activitiesForDate: dayActivities.length,
      sampleActivityDates: allActivities.slice(0, 5).map(a => ({
        date: a.startTimeLocal?.slice(0, 10),
        name: a.activityName,
      })),
    };

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
        isOutdoor: a.activityType?.parentTypeId === 17 ||
          ["running","cycling","walking","hiking","trail_running","open_water_swimming"].includes(
            a.activityType?.typeKey
          ),
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
      _debug: debugInfo,
    });

  } catch (err) {
    console.error("Garmin data error:", err.message);
    return res.status(500).json({ error: err.message, stack: err.stack?.split("\n").slice(0, 4) });
  }
}
