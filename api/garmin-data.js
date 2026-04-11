// Garmin Connect unofficial API - fetches daily health stats
const GARMIN_BASE = "https://connect.garmin.com";

async function getGarminAuth() {
  // Step 1: Get SSO login page to extract CSRF token
  const ssoRes = await fetch(
    `https://sso.garmin.com/sso/signin?service=${encodeURIComponent(GARMIN_BASE + "/modern/")}&clientId=GarminConnect&consumeServiceTicket=false`,
    { headers: { "User-Agent": "Mozilla/5.0", "Accept": "text/html" }, redirect: "follow" }
  );
  const ssoHtml = await ssoRes.text();
  const csrfMatch = ssoHtml.match(/name="_csrf"\s+value="([^"]+)"/);
  const csrf = csrfMatch ? csrfMatch[1] : "";
  const cookies = ssoRes.headers.get("set-cookie") || "";

  // Step 2: POST credentials
  const loginRes = await fetch(
    `https://sso.garmin.com/sso/signin?service=${encodeURIComponent(GARMIN_BASE + "/modern/")}&clientId=GarminConnect&consumeServiceTicket=false`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0",
        "Cookie": cookies,
        "Origin": "https://sso.garmin.com",
        "Referer": "https://sso.garmin.com/",
      },
      body: new URLSearchParams({
        username: process.env.GARMIN_EMAIL,
        password: process.env.GARMIN_PASSWORD,
        embed: "false",
        _csrf: csrf,
      }).toString(),
      redirect: "manual",
    }
  );

  // Step 3: Follow redirect to get session cookies
  const loginCookies = loginRes.headers.get("set-cookie") || "";
  const ticketUrl = loginRes.headers.get("location") || "";
  const allCookies = [cookies, loginCookies].filter(Boolean).join("; ");

  if (!ticketUrl) throw new Error("Login failed - check credentials");

  // Step 4: Visit the ticket URL to establish session
  const sessionRes = await fetch(ticketUrl, {
    headers: { "Cookie": allCookies, "User-Agent": "Mozilla/5.0" },
    redirect: "manual",
  });
  const sessionCookies = sessionRes.headers.get("set-cookie") || "";
  const finalCookies = [allCookies, sessionCookies].filter(Boolean).join("; ");

  // Step 5: Follow to modern
  const modernRes = await fetch(`${GARMIN_BASE}/modern/`, {
    headers: { "Cookie": finalCookies, "User-Agent": "Mozilla/5.0" },
    redirect: "manual",
  });
  const modernCookies = modernRes.headers.get("set-cookie") || "";

  return [finalCookies, modernCookies].filter(Boolean).join("; ");
}

async function garminFetch(url, cookies) {
  const res = await fetch(url, {
    headers: {
      "Cookie": cookies,
      "User-Agent": "Mozilla/5.0",
      "NK": "NT",
      "Accept": "application/json",
      "X-app-ver": "4.6.1.4",
    },
  });
  if (!res.ok) throw new Error(`Garmin API error: ${res.status} ${url}`);
  return res.json();
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { date } = req.query;
  if (!date) return res.status(400).json({ error: "date required (YYYY-MM-DD)" });

  try {
    const cookies = await getGarminAuth();

    // Fetch in parallel
    const [steps, sleep, stress, hrv, calories] = await Promise.allSettled([
      garminFetch(`${GARMIN_BASE}/proxy/usersummary-service/usersummary/daily/${date}`, cookies),
      garminFetch(`${GARMIN_BASE}/proxy/wellness-service/wellness/dailySleepData/${date}`, cookies),
      garminFetch(`${GARMIN_BASE}/proxy/wellness-service/wellness/dailyStress/${date}`, cookies),
      garminFetch(`${GARMIN_BASE}/proxy/hrv-service/hrv/${date}`, cookies),
      garminFetch(`${GARMIN_BASE}/proxy/usersummary-service/usersummary/daily/${date}`, cookies),
    ]);

    const stepsData = steps.status === "fulfilled" ? steps.value : null;
    const sleepData = sleep.status === "fulfilled" ? sleep.value : null;
    const stressData = stress.status === "fulfilled" ? stress.value : null;
    const hrvData = hrv.status === "fulfilled" ? hrv.value : null;

    return res.status(200).json({
      date,
      steps: stepsData?.totalSteps || 0,
      calories: stepsData?.totalKilocalories || 0,
      activeCalories: stepsData?.activeKilocalories || 0,
      distanceMeters: stepsData?.totalDistanceMeters || 0,
      floorsClimbed: stepsData?.floorsAscended || 0,
      averageStressLevel: stressData?.avgStressLevel || null,
      sleep: sleepData ? {
        score: sleepData.dailySleepDTO?.sleepScores?.overall?.value || sleepData.dailySleepDTO?.sleepScore || null,
        durationSeconds: sleepData.dailySleepDTO?.sleepTimeSeconds || 0,
        startTime: sleepData.dailySleepDTO?.sleepStartTimestampLocal || null,
        endTime: sleepData.dailySleepDTO?.sleepEndTimestampLocal || null,
        deepSeconds: sleepData.dailySleepDTO?.deepSleepSeconds || 0,
        lightSeconds: sleepData.dailySleepDTO?.lightSleepSeconds || 0,
        remSeconds: sleepData.dailySleepDTO?.remSleepSeconds || 0,
        awakeSeconds: sleepData.dailySleepDTO?.awakeSleepSeconds || 0,
        averageSpO2: sleepData.dailySleepDTO?.averageSpO2Value || null,
        averageHrv: sleepData.dailySleepDTO?.averageHrvValue || null,
        restingHeartRate: sleepData.dailySleepDTO?.restingHeartRate || null,
        bodyBattery: sleepData.dailySleepDTO?.bodyBatteryChange || null,
      } : null,
      hrv: hrvData ? {
        weeklyAvg: hrvData.hrvSummary?.weeklyAvg || null,
        lastNight: hrvData.hrvSummary?.lastNight || null,
        status: hrvData.hrvSummary?.status || null,
      } : null,
    });
  } catch (err) {
    console.error("Garmin data error:", err);
    return res.status(500).json({ error: err.message });
  }
}
