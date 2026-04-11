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

    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(client))
      .filter(m => m !== "constructor" && typeof client[m] === "function")
      .sort();

    const activities = await client.getActivities(0, 5);
    const dateObj = new Date(`${date}T12:00:00`);

    const [steps, sleep, wellness] = await Promise.allSettled([
      client.getSteps(dateObj),
      client.getSleepData ? client.getSleepData(dateObj) : Promise.reject("no getSleepData"),
      client.getDailyWellness ? client.getDailyWellness(dateObj) : Promise.reject("no getDailyWellness"),
    ]);

    return res.status(200).json({
      availableMethods: methods,
      activities: activities?.slice(0, 2),
      steps: steps.status === "fulfilled" ? steps.value : { error: steps.reason?.message || steps.reason },
      sleep: sleep.status === "fulfilled" ? sleep.value : { error: sleep.reason?.message || sleep.reason },
      wellness: wellness.status === "fulfilled" ? wellness.value : { error: wellness.reason?.message || wellness.reason },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message, stack: err.stack?.split('\n').slice(0,5) });
  }
}
