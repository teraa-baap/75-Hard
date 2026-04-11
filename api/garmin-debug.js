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

    const accessToken = client.oauth2Token?.access_token;
    const displayName = "f4dddd54-5802-4096-96cf-f15f39a7c40f";

    const headers = {
      "Authorization": `Bearer ${accessToken}`,
      "Accept": "application/json",
      "NK": "NT",
      "X-app-ver": "4.6.1.4",
    };

    // Try multiple endpoint variants
    const endpoints = [
      `https://connect.garmin.com/proxy/usersummary-service/usersummary/daily/${date}`,
      `https://connect.garmin.com/proxy/usersummary-service/usersummary/daily/${date}?source=ALL`,
      `https://connect.garmin.com/proxy/usersummary-service/usersummary/${displayName}/day/${date}`,
      `https://connect.garmin.com/proxy/wellness-service/wellness/dailySummaryChart/${displayName}?date=${date}`,
    ];

    const results = await Promise.all(endpoints.map(async (url) => {
      const r = await fetch(url, { headers });
      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch { data = text.slice(0, 200); }
      return {
        url: url.replace("https://connect.garmin.com/proxy/", ""),
        status: r.status,
        data: Array.isArray(data)
          ? { isArray: true, length: data.length, first: data[0] }
          : typeof data === "object"
            ? { totalKilocalories: data.totalKilocalories, activeKilocalories: data.activeKilocalories, bmrKilocalories: data.bmrKilocalories, error: data.error || data.message }
            : data,
      };
    }));

    return res.status(200).json({ results });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
