
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Camera, Dumbbell, Utensils, TreeDeciduous, BookOpen, Droplets,
  Flame, Scale, Target, ImagePlus, Lock, LockOpen, X, Images,
  RefreshCw, ArrowLeft, Trophy, ChevronLeft,
  ChevronRight, User, Bell, Layers, Share2, Calendar,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ─── Constants ────────────────────────────────────────────────────────────────
const TOTAL_DAYS = 75;
const STORAGE_KEY = "premium_75_hard_tracker_pwa_v1";
const USER_KEY = "75_hard_user_v1";
const START_DATE_KEY = "75_hard_start_date_v1";
const NOTIF_KEY = "75_hard_notif_v1";
const STRAVA_TOKEN_KEY = "75_hard_strava_token_v1";
const STRAVA_CLIENT_ID = "223103";

const DAILY_QUOTES = [
  "Pain is temporary. Quitting lasts forever.",
  "Your only competition is who you were yesterday.",
  "Discipline is choosing between what you want now and what you want most.",
  "The body achieves what the mind believes.",
  "Hard days build champions.",
  "Don't stop when you're tired. Stop when you're done.",
  "Every rep, every mile, every page. It all counts.",
  "Be harder to kill.",
  "You don't find willpower. You build it.",
  "Suffer now and live the rest of your life as a champion.",
  "The only easy day was yesterday.",
  "Mental toughness is a skill. Train it daily.",
  "Results happen over time, not overnight.",
  "When you feel like quitting, remember why you started.",
  "Iron will. Iron body.",
];

const MILESTONE_MESSAGES: Record<number, { title: string; subtitle: string }> = {
  1:  { title: "WEEK 1 DONE", subtitle: "The hardest week is behind you. Most quit here. You didn't." },
  2:  { title: "2 WEEKS IN", subtitle: "Your body is adapting. This is where habits start forming." },
  3:  { title: "3 WEEKS STRONG", subtitle: "21 days. Science says that's a habit. You're wired differently now." },
  4:  { title: "HALFWAY THERE", subtitle: "30 days of relentless discipline. The other half is yours to take." },
  5:  { title: "WEEK 5 BEAST", subtitle: "Most people dream about this. You're living it." },
  6:  { title: "6 WEEKS LOCKED IN", subtitle: "Your mind is iron. Your body is following." },
  7:  { title: "FINAL WEEK", subtitle: "One week left. This is what legends are made of. Finish it." },
  8:  { title: "75 HARD COMPLETE", subtitle: "You did what most people only talk about. Elite." },
};

const habitColumns = [
  { key: "photo",    icon: Camera,        label: "Progress Photo" },
  { key: "workout1", icon: Dumbbell,      label: "Workout 1" },
  { key: "diet",     icon: Utensils,      label: "Diet" },
  { key: "workout2", icon: TreeDeciduous, label: "Outdoor Workout" },
  { key: "read",     icon: BookOpen,      label: "Read" },
  { key: "water",    icon: Droplets,      label: "Water" },
] as const;

const weekdayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
type HabitKey = (typeof habitColumns)[number]["key"];

// ─── Strava Types ─────────────────────────────────────────────────────────────
type StravaToken = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete: { firstname: string; lastname: string; profile: string };
};

type StravaActivity = {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  start_date_local: string;
  elapsed_time: number;
  moving_time: number;
  distance: number;
  total_elevation_gain: number;
  average_heartrate?: number;
  max_heartrate?: number;
  calories?: number;
  average_speed: number;
  max_speed: number;
  suffer_score?: number;
  kilojoules?: number;
};

// ─── Strava Helpers ───────────────────────────────────────────────────────────
function getStravaToken(): StravaToken | null {
  try { const s = localStorage.getItem(STRAVA_TOKEN_KEY); return s ? JSON.parse(s) : null; } catch { return null; }
}
function saveStravaToken(token: StravaToken) {
  localStorage.setItem(STRAVA_TOKEN_KEY, JSON.stringify(token));
}
function clearStravaToken() {
  localStorage.removeItem(STRAVA_TOKEN_KEY);
}
async function refreshStravaTokenIfNeeded(token: StravaToken): Promise<StravaToken> {
  if (Date.now() / 1000 < token.expires_at - 300) return token;
  const res = await fetch("/api/strava-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "refresh_token", refresh_token: token.refresh_token }),
  });
  if (!res.ok) throw new Error("Token refresh failed");
  const data = await res.json();
  const newToken = { ...token, access_token: data.access_token, refresh_token: data.refresh_token, expires_at: data.expires_at };
  saveStravaToken(newToken);
  return newToken;
}
async function fetchStravaActivities(token: StravaToken, date: string): Promise<StravaActivity[]> {
  const fresh = await refreshStravaTokenIfNeeded(token);
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(`${date}T23:59:59`);
  const after = Math.floor(start.getTime() / 1000);
  const before = Math.floor(end.getTime() / 1000);
  const res = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?after=${after}&before=${before}&per_page=10`,
    { headers: { Authorization: `Bearer ${fresh.access_token}` } }
  );
  if (!res.ok) throw new Error("Failed to fetch activities");
  return res.json();
}
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}
function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${Math.round(meters)} m`;
}
function formatPace(speed: number): string {
  if (speed === 0) return "—";
  const minPerKm = 1000 / speed / 60;
  const min = Math.floor(minPerKm);
  const sec = Math.round((minPerKm - min) * 60);
  return `${min}:${String(sec).padStart(2, "0")} /km`;
}
function getActivityEmoji(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("run")) return "🏃";
  if (t.includes("ride") || t.includes("cycling")) return "🚴";
  if (t.includes("swim")) return "🏊";
  if (t.includes("walk")) return "🚶";
  if (t.includes("hike")) return "🥾";
  if (t.includes("weight") || t.includes("crossfit") || t.includes("workout")) return "🏋️";
  if (t.includes("yoga")) return "🧘";
  return "⚡";
}

// ─── Strava Workout Drawer ────────────────────────────────────────────────────
function StravaWorkoutDrawer({ date, dateLabel, token, onClose, onAutoFill }: {
  date: string; dateLabel: string; token: StravaToken;
  onClose: () => void;
  onAutoFill: (calories: string, steps: string, workout1Done: boolean, workout2Done: boolean) => void;
}) {
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStravaActivities(token, date)
      .then(setActivities)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [date, token]);

  const totalCalories = activities.reduce((s, a) => s + (a.calories || Math.round((a.kilojoules || 0) * 0.239)), 0);
  const isOutdoor = (a: StravaActivity) => ["Run","Ride","Walk","Hike","VirtualRide","TrailRun"].includes(a.sport_type);

  const handleAutoFill = () => {
    const workout1Done = activities.length >= 1;
    const workout2Done = activities.some(a => isOutdoor(a));
    onAutoFill(
      totalCalories > 0 ? String(totalCalories) : "",
      "",
      workout1Done,
      workout2Done
    );
    onClose();
  };

  return (
    <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      style={{ position: "fixed", inset: 0, zIndex: 95, background: "#000", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid rgba(127,29,29,0.72)", background: "linear-gradient(180deg, rgba(69,10,10,0.5) 0%, transparent 100%)" }}>
        <button onClick={onClose} style={{ width: 38, height: 38, borderRadius: 12, background: "rgba(127,29,29,0.25)", border: "1px solid rgba(127,29,29,0.72)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fca5a5" }}>
          <ArrowLeft style={{ width: 18, height: 18 }} />
        </button>
        <div style={{ textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(252,165,165,0.6)" }}>Strava Activities</p>
          <p style={{ margin: "2px 0 0", fontSize: 14, fontWeight: 700, color: "#fff" }}>{dateLabel}</p>
        </div>
        <div style={{ width: 38 }} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 120px" }}>
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 200, gap: 16 }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              style={{ width: 32, height: 32, border: "3px solid rgba(127,29,29,0.3)", borderTop: "3px solid #dc2626", borderRadius: "50%" }} />
            <p style={{ color: "rgba(252,165,165,0.5)", fontSize: 13 }}>Fetching from Strava...</p>
          </div>
        )}

        {error && (
          <div style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 14, padding: 16, margin: "8px 0" }}>
            <p style={{ margin: 0, color: "#f87171", fontSize: 13 }}>Could not load activities: {error}</p>
          </div>
        )}

        {!loading && !error && activities.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 200, gap: 12 }}>
            <span style={{ fontSize: 48 }}>🏃</span>
            <p style={{ color: "rgba(252,165,165,0.5)", fontSize: 14, textAlign: "center" }}>No Strava activities found for this day</p>
          </div>
        )}

        {!loading && activities.map((activity, i) => (
          <motion.div key={activity.id}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            style={{ background: "linear-gradient(135deg, #0a0000, #1a0404)", border: "1px solid rgba(127,29,29,0.5)", borderRadius: 18, padding: 18, marginBottom: 12 }}>

            {/* Activity header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(127,29,29,0.3)", border: "1px solid rgba(127,29,29,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                {getActivityEmoji(activity.sport_type)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activity.name}</p>
                <p style={{ margin: "3px 0 0", fontSize: 11, color: "rgba(252,165,165,0.55)", letterSpacing: "0.06em" }}>
                  {activity.sport_type} · {new Date(activity.start_date_local).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              {isOutdoor(activity) && (
                <div style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, padding: "3px 8px" }}>
                  <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: "#4ade80", letterSpacing: "0.1em" }}>OUTDOOR</p>
                </div>
              )}
            </div>

            {/* Stats grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {[
                { label: "Duration", value: formatDuration(activity.moving_time) },
                { label: "Distance", value: activity.distance > 0 ? formatDistance(activity.distance) : "—" },
                { label: "Pace", value: activity.distance > 0 ? formatPace(activity.average_speed) : "—" },
                { label: "Avg HR", value: activity.average_heartrate ? `${Math.round(activity.average_heartrate)} bpm` : "—" },
                { label: "Max HR", value: activity.max_heartrate ? `${Math.round(activity.max_heartrate)} bpm` : "—" },
                { label: "Calories", value: activity.calories ? `${activity.calories} kcal` : activity.kilojoules ? `~${Math.round(activity.kilojoules * 0.239)} kcal` : "—" },
                { label: "Elevation", value: activity.total_elevation_gain > 0 ? `${Math.round(activity.total_elevation_gain)} m` : "—" },
                { label: "Suffer Score", value: activity.suffer_score ? String(activity.suffer_score) : "—" },
              ].map(stat => (
                <div key={stat.label} style={{ background: "rgba(0,0,0,0.4)", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                  <p style={{ margin: 0, fontSize: 9, color: "rgba(252,165,165,0.45)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{stat.label}</p>
                  <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 700, color: "#fff" }}>{stat.value}</p>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Auto-fill button */}
      {!loading && activities.length > 0 && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "16px", background: "linear-gradient(0deg, #000 60%, transparent)", borderTop: "1px solid rgba(127,29,29,0.3)" }}>
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleAutoFill}
            style={{ width: "100%", padding: "16px", background: "linear-gradient(135deg, #7f1d1d, #dc2626)", border: "1px solid rgba(248,113,113,0.35)", borderRadius: 16, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <RefreshCw style={{ width: 18, height: 18 }} />
            Sync This Day Now
          </motion.button>
          {totalCalories > 0 && (
            <p style={{ margin: "8px 0 0", textAlign: "center", fontSize: 12, color: "rgba(252,165,165,0.5)" }}>
              {totalCalories} cal · {activities.length} workout{activities.length > 1 ? "s" : ""} · auto-synced on load
            </p>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ─── Strava Connect Banner ────────────────────────────────────────────────────
function StravaConnectBanner({ onConnect }: { onConnect: () => void }) {
  return (
    <motion.button whileTap={{ scale: 0.97 }} onClick={onConnect}
      style={{ width: "100%", padding: "14px 18px", background: "linear-gradient(135deg, #fc4c02 0%, #e34402 100%)", border: "none", borderRadius: 14, display: "flex", alignItems: "center", gap: 14, cursor: "pointer", marginTop: 10 }}>
      <div style={{ width: 36, height: 36, background: "rgba(255,255,255,0.2)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ fontSize: 18 }}>⚡</span>
      </div>
      <div style={{ textAlign: "left" }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#fff" }}>Connect Strava</p>
        <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.7)" }}>Auto-fill workouts, calories & heart rate</p>
      </div>
    </motion.button>
  );
}

type SleepData = {
  score: number | null;
  durationSeconds: number;
  startTime: string | null;
  endTime: string | null;
  deepSeconds: number;
  lightSeconds: number;
  remSeconds: number;
  awakeSeconds: number;
  averageSpO2: number | null;
  averageHrv: number | null;
  restingHeartRate: number | null;
  bodyBattery: number | null;
};

type TrackerRow = {
  id: number; date: string; dateLabel: string; day: string; countdown: string;
  photo: boolean; photoUrl: string; workout1: boolean; diet: boolean;
  workout2: boolean; read: boolean; water: boolean;
  weight: string; calories: string; steps: string; locked: boolean;
  sleepData: SleepData | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDateLabel(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(date).replace(" ", "-");
}
function getStartDate(): string {
  return localStorage.getItem(START_DATE_KEY) || "2026-04-06";
}
function createRows(startDateString?: string): TrackerRow[] {
  const s = startDateString || getStartDate();
  const start = new Date(`${s}T00:00:00`);
  return Array.from({ length: TOTAL_DAYS }, (_, i) => {
    const current = new Date(start);
    current.setDate(start.getDate() + i);
    // Use local date to avoid UTC offset issues
    const localDate = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
    return {
      id: i + 1, date: localDate,
      dateLabel: formatDateLabel(current), day: weekdayNames[current.getDay()],
      countdown: `Day ${i + 1}`, photo: false, photoUrl: "", workout1: false,
      diet: false, workout2: false, read: false, water: false,
      weight: "", calories: "", steps: "", locked: false, sleepData: null,
    };
  });
}
function rowHasData(row: TrackerRow) {
  return habitColumns.some((item) => row[item.key]) || Boolean(row.photoUrl) ||
    row.weight.trim() !== "" || row.calories.trim() !== "" || row.steps.trim() !== "";
}
function isRowComplete(row: TrackerRow) {
  return habitColumns.every((item) => row[item.key]);
}
function compressImage(file: File, maxSize = 1200, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas not supported")); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

// ─── Garmin Helpers ───────────────────────────────────────────────────────────
function formatSleepDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}
function formatTime(ts: string | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}
function getSleepScoreColor(score: number | null): string {
  if (!score) return "rgba(252,165,165,0.4)";
  if (score >= 80) return "#4ade80";
  if (score >= 60) return "#fbbf24";
  return "#f87171";
}
function getActivityEmojiGarmin(type: string): string {
  const t = (type || "").toLowerCase();
  if (t.includes("run")) return "🏃";
  if (t.includes("cycling") || t.includes("bike")) return "🚴";
  if (t.includes("swim")) return "🏊";
  if (t.includes("walk")) return "🚶";
  if (t.includes("hike")) return "🥾";
  if (t.includes("strength") || t.includes("cardio") || t.includes("fitness")) return "🏋️";
  if (t.includes("yoga")) return "🧘";
  return "⚡";
}

// ─── Sleep Detail Popup ───────────────────────────────────────────────────────
function SleepPopup({ sleep, dateLabel, onClose }: { sleep: SleepData; dateLabel: string; onClose: () => void }) {
  const total = sleep.durationSeconds || 1;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.92)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid rgba(127,29,29,0.5)" }}>
        <button onClick={onClose} style={{ width: 38, height: 38, borderRadius: 12, background: "rgba(127,29,29,0.25)", border: "1px solid rgba(127,29,29,0.72)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fca5a5" }}>
          <ArrowLeft style={{ width: 18, height: 18 }} />
        </button>
        <div style={{ textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(252,165,165,0.5)" }}>Sleep Analysis</p>
          <p style={{ margin: "2px 0 0", fontSize: 14, fontWeight: 700, color: "#fff" }}>{dateLabel}</p>
        </div>
        <div style={{ width: 38 }} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 18px" }}>
        {/* Score */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 100, height: 100, borderRadius: "50%", border: `4px solid ${getSleepScoreColor(sleep.score)}`, marginBottom: 12 }}>
            <div>
              <p style={{ margin: 0, fontSize: 36, fontWeight: 900, color: getSleepScoreColor(sleep.score) }}>{sleep.score ?? "—"}</p>
              <p style={{ margin: 0, fontSize: 10, color: "rgba(252,165,165,0.5)", letterSpacing: "0.1em" }}>SCORE</p>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#fff" }}>{formatSleepDuration(sleep.durationSeconds)}</p>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "rgba(252,165,165,0.5)" }}>
            {formatTime(sleep.startTime)} → {formatTime(sleep.endTime)}
          </p>
        </div>

        {/* Sleep stages bar */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ margin: "0 0 8px", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(252,165,165,0.5)" }}>Sleep Stages</p>
          <div style={{ display: "flex", height: 16, borderRadius: 8, overflow: "hidden", gap: 2 }}>
            {[
              { seconds: sleep.deepSeconds, color: "#3b82f6", label: "Deep" },
              { seconds: sleep.lightSeconds, color: "#818cf8", label: "Light" },
              { seconds: sleep.remSeconds, color: "#a78bfa", label: "REM" },
              { seconds: sleep.awakeSeconds, color: "rgba(255,255,255,0.15)", label: "Awake" },
            ].map(stage => (
              <div key={stage.label} style={{ flex: stage.seconds / total, background: stage.color, minWidth: stage.seconds > 0 ? 4 : 0 }} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
            {[
              { seconds: sleep.deepSeconds, color: "#3b82f6", label: "Deep" },
              { seconds: sleep.lightSeconds, color: "#818cf8", label: "Light" },
              { seconds: sleep.remSeconds, color: "#a78bfa", label: "REM" },
              { seconds: sleep.awakeSeconds, color: "rgba(255,255,255,0.3)", label: "Awake" },
            ].map(stage => (
              <div key={stage.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: stage.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "rgba(252,165,165,0.7)" }}>{stage.label}: {formatSleepDuration(stage.seconds)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { label: "Avg SpO2", value: sleep.averageSpO2 ? `${sleep.averageSpO2.toFixed(1)}%` : "—" },
            { label: "Avg HRV", value: sleep.averageHrv ? `${Math.round(sleep.averageHrv)} ms` : "—" },
            { label: "Resting HR", value: sleep.restingHeartRate ? `${sleep.restingHeartRate} bpm` : "—" },
            { label: "Body Battery", value: sleep.bodyBattery ? `+${sleep.bodyBattery}` : "—" },
          ].map(stat => (
            <div key={stat.label} style={{ background: "linear-gradient(135deg, #0a0000, #1a0404)", border: "1px solid rgba(127,29,29,0.4)", borderRadius: 14, padding: "14px 16px" }}>
              <p style={{ margin: 0, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(252,165,165,0.45)" }}>{stat.label}</p>
              <p style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 700, color: "#fff" }}>{stat.value}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Garmin Workout Drawer ────────────────────────────────────────────────────
function GarminWorkoutDrawer({ date, dateLabel, onClose, onAutoFill }: {
  date: string; dateLabel: string; onClose: () => void;
  onAutoFill: (calories: string, steps: string, workout1Done: boolean, workout2Done: boolean) => void;
}) {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/garmin-activities?date=${date}`)
      .then(r => r.json())
      .then(d => setActivities(d.activities || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [date]);

  const totalCalories = activities.reduce((s, a) => s + (a.calories || 0), 0);
  const hasOutdoor = activities.some(a => a.isOutdoor);

  return (
    <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      style={{ position: "fixed", inset: 0, zIndex: 95, background: "#000", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid rgba(127,29,29,0.72)", background: "linear-gradient(180deg, rgba(69,10,10,0.5) 0%, transparent 100%)" }}>
        <button onClick={onClose} style={{ width: 38, height: 38, borderRadius: 12, background: "rgba(127,29,29,0.25)", border: "1px solid rgba(127,29,29,0.72)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fca5a5" }}>
          <ArrowLeft style={{ width: 18, height: 18 }} />
        </button>
        <div style={{ textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(252,165,165,0.6)" }}>Garmin Activities</p>
          <p style={{ margin: "2px 0 0", fontSize: 14, fontWeight: 700, color: "#fff" }}>{dateLabel}</p>
        </div>
        <div style={{ width: 38 }} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 120px" }}>
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 200, gap: 16 }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              style={{ width: 32, height: 32, border: "3px solid rgba(127,29,29,0.3)", borderTop: "3px solid #dc2626", borderRadius: "50%" }} />
            <p style={{ color: "rgba(252,165,165,0.5)", fontSize: 13 }}>Fetching from Garmin...</p>
          </div>
        )}
        {error && <div style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 14, padding: 16 }}><p style={{ margin: 0, color: "#f87171", fontSize: 13 }}>{error}</p></div>}
        {!loading && !error && activities.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 200, gap: 12 }}>
            <span style={{ fontSize: 48 }}>🏋️</span>
            <p style={{ color: "rgba(252,165,165,0.5)", fontSize: 14, textAlign: "center" }}>No activities found for this day</p>
          </div>
        )}
        {!loading && activities.map((a, i) => (
          <motion.div key={a.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            style={{ background: "linear-gradient(135deg, #0a0000, #1a0404)", border: "1px solid rgba(127,29,29,0.5)", borderRadius: 18, padding: 18, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(127,29,29,0.3)", border: "1px solid rgba(127,29,29,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                {getActivityEmojiGarmin(a.type)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</p>
                <p style={{ margin: "3px 0 0", fontSize: 11, color: "rgba(252,165,165,0.55)", letterSpacing: "0.06em" }}>
                  {a.type} · {a.startTime ? new Date(a.startTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : ""}
                </p>
              </div>
              {a.isOutdoor && <div style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, padding: "3px 8px" }}><p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: "#4ade80", letterSpacing: "0.1em" }}>OUTDOOR</p></div>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {[
                { label: "Duration", value: formatDuration(a.movingDurationSeconds || a.durationSeconds) },
                { label: "Distance", value: a.distanceMeters > 0 ? formatDistance(a.distanceMeters) : "—" },
                { label: "Calories", value: a.calories ? `${a.calories} kcal` : "—" },
                { label: "Avg HR", value: a.averageHR ? `${a.averageHR} bpm` : "—" },
                { label: "Max HR", value: a.maxHR ? `${a.maxHR} bpm` : "—" },
                { label: "Elevation", value: a.elevationGain > 0 ? `${Math.round(a.elevationGain)} m` : "—" },
                { label: "Training Effect", value: a.trainingEffect ? a.trainingEffect.toFixed(1) : "—" },
                { label: "VO2 Max", value: a.vo2max ? a.vo2max.toFixed(1) : "—" },
              ].map(stat => (
                <div key={stat.label} style={{ background: "rgba(0,0,0,0.4)", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                  <p style={{ margin: 0, fontSize: 9, color: "rgba(252,165,165,0.45)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{stat.label}</p>
                  <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 700, color: "#fff" }}>{stat.value}</p>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      {!loading && activities.length > 0 && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "16px", background: "linear-gradient(0deg, #000 60%, transparent)", borderTop: "1px solid rgba(127,29,29,0.3)" }}>
          <motion.button whileTap={{ scale: 0.97 }}
            onClick={() => { onAutoFill(totalCalories > 0 ? String(totalCalories) : "", "", activities.length >= 1, hasOutdoor); onClose(); }}
            style={{ width: "100%", padding: "16px", background: "linear-gradient(135deg, #7f1d1d, #dc2626)", border: "1px solid rgba(248,113,113,0.35)", borderRadius: 16, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <RefreshCw style={{ width: 18, height: 18 }} /> Sync This Day
          </motion.button>
          <p style={{ margin: "8px 0 0", textAlign: "center", fontSize: 12, color: "rgba(252,165,165,0.5)" }}>
            {totalCalories > 0 ? `${totalCalories} cal · ` : ""}{activities.length} workout{activities.length > 1 ? "s" : ""} · auto-synced on load
          </p>
        </div>
      )}
    </motion.div>
  );
}
function DateCell({ row, isToday, rowTone, todayRef, isFuture }: {
  row: TrackerRow; isToday: boolean; rowTone: string;
  todayRef?: React.RefObject<HTMLDivElement>; isFuture: boolean;
}) {
  return (
    <div className={`sheet-cell body date-col ${rowTone}`} style={{ position: "relative" }}>
      <div ref={todayRef} style={{ textAlign: "center", lineHeight: 1.35 }}>
        {isToday && <div style={{ fontSize: 8, letterSpacing: "0.2em", textTransform: "uppercase", color: "#f87171", fontWeight: 800, marginBottom: 2 }}>TODAY</div>}
        <div>{row.dateLabel}</div>
        <div style={{ fontSize: 11, color: "rgba(252,165,165,0.6)", letterSpacing: "0.06em", marginTop: 2 }}>{row.day}</div>
      </div>
    </div>
  );
}

function Confetti({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const particles = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * 100,
      vx: (Math.random() - 0.5) * 4,
      vy: 2 + Math.random() * 4,
      color: ["#dc2626","#f87171","#fca5a5","#fff","#fecaca","#ef4444"][Math.floor(Math.random()*6)],
      size: 4 + Math.random() * 8,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.2,
    }));
    let frame = 0;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.rotation += p.rotationSpeed;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.5);
        ctx.restore();
      });
      frame++;
      if (frame < 120) requestAnimationFrame(animate);
      else onDone();
    };
    animate();
  }, [onDone]);
  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, zIndex: 200, pointerEvents: "none" }} />;
}

// ─── Onboarding ───────────────────────────────────────────────────────────────
function OnboardingScreen({ onComplete }: { onComplete: (name: string, startDate: string) => void }) {
  const [name, setName] = useState("");
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const [startDate, setStartDate] = useState(todayStr);
  const canProceed = name.trim() && startDate;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{ position: "fixed", inset: 0, zIndex: 300, background: "#000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32 }}>
      <div className="background-noise" /><div className="background-glow" />
      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 20 }}
        style={{ position: "relative", zIndex: 1, textAlign: "center", width: "100%", maxWidth: 380 }}>
        <div className="pill" style={{ display: "inline-flex", marginBottom: 24 }}>
          <Flame style={{ width: 16, height: 16 }} /> Discipline • Consistency • Power
        </div>
        <h1 style={{ fontSize: 42, fontWeight: 900, letterSpacing: "0.14em", color: "#fff", margin: "0 0 8px" }}>75 HARD</h1>
        <p style={{ fontSize: 14, color: "rgba(252,165,165,0.7)", letterSpacing: "0.1em", marginBottom: 32 }}>YOUR TRANSFORMATION BEGINS NOW</p>
        <div style={{ background: "linear-gradient(135deg, #0c0000 0%, #1a0404 100%)", border: "1px solid rgba(127,29,29,0.72)", borderRadius: 24, padding: 28 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, borderRadius: "50%", background: "rgba(127,29,29,0.3)", border: "1px solid rgba(127,29,29,0.7)", margin: "0 auto 20px" }}>
            <User style={{ width: 28, height: 28, color: "#fca5a5" }} />
          </div>

          <p style={{ fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(252,165,165,0.6)", marginBottom: 10 }}>What should we call you?</p>
          <input value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && canProceed && onComplete(name.trim(), startDate)}
            placeholder="Enter your name" autoFocus
            style={{ width: "100%", padding: "14px 16px", background: "rgba(0,0,0,0.6)", border: "1px solid rgba(127,29,29,0.6)", borderRadius: 12, color: "#ffe8e8", fontSize: 16, outline: "none", textAlign: "center", letterSpacing: "0.04em", marginBottom: 20 }}
          />

          <p style={{ fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(252,165,165,0.6)", marginBottom: 10 }}>Challenge start date</p>
          <div style={{ position: "relative", marginBottom: 20 }}>
            <Calendar style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "#fca5a5", pointerEvents: "none" }} />
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              style={{ width: "100%", padding: "14px 16px 14px 40px", background: "rgba(0,0,0,0.6)", border: "1px solid rgba(127,29,29,0.6)", borderRadius: 12, color: "#ffe8e8", fontSize: 15, outline: "none", colorScheme: "dark" }}
            />
          </div>

          <motion.button whileTap={{ scale: 0.97 }} onClick={() => canProceed && onComplete(name.trim(), startDate)}
            style={{ width: "100%", padding: "16px", background: canProceed ? "linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)" : "rgba(127,29,29,0.2)", border: "1px solid rgba(220,38,38,0.5)", borderRadius: 14, color: canProceed ? "#fff" : "rgba(252,165,165,0.4)", fontSize: 15, fontWeight: 700, letterSpacing: "0.1em", cursor: canProceed ? "pointer" : "default", transition: "all 0.2s" }}>
            START THE CHALLENGE →
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Photo Gallery Modal ──────────────────────────────────────────────────────
function PhotoGalleryModal({ rows, onClose }: { rows: TrackerRow[]; onClose: () => void }) {
  const photos = rows.filter((r) => r.photoUrl);
  const [current, setCurrent] = useState(0);
  if (photos.length === 0) return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 80, background: "#000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <button onClick={onClose} style={{ position: "absolute", top: 20, left: 18, width: 38, height: 38, borderRadius: 12, background: "rgba(127,29,29,0.25)", border: "1px solid rgba(127,29,29,0.72)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fca5a5" }}>
        <ArrowLeft style={{ width: 18, height: 18 }} />
      </button>
      <Images style={{ width: 48, height: 48, color: "rgba(127,29,29,0.6)", marginBottom: 16 }} />
      <p style={{ color: "rgba(252,165,165,0.6)", fontSize: 14, letterSpacing: "0.08em" }}>No progress photos yet</p>
    </motion.div>
  );
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 80, background: "#000", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid rgba(127,29,29,0.72)", background: "linear-gradient(180deg, rgba(69,10,10,0.5) 0%, transparent 100%)" }}>
        <button onClick={onClose} style={{ width: 38, height: 38, borderRadius: 12, background: "rgba(127,29,29,0.25)", border: "1px solid rgba(127,29,29,0.72)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fca5a5" }}>
          <ArrowLeft style={{ width: 18, height: 18 }} />
        </button>
        <div style={{ textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(252,165,165,0.7)" }}>Progress Gallery</p>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#fff", fontWeight: 700 }}>{photos[current]?.countdown} — {photos[current]?.dateLabel}</p>
        </div>
        <div style={{ width: 38, fontSize: 12, color: "rgba(252,165,165,0.6)", textAlign: "right" }}>{current + 1}/{photos.length}</div>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", padding: "20px 60px" }}>
        <AnimatePresence mode="wait">
          <motion.img key={photos[current]?.id} src={photos[current]?.photoUrl}
            initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.2 }}
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 20, border: "1px solid rgba(127,29,29,0.5)", boxShadow: "0 0 80px rgba(185,28,28,0.2)" }}
          />
        </AnimatePresence>
        {current > 0 && (
          <button onClick={() => setCurrent((c) => c - 1)} style={{ position: "absolute", left: 12, width: 40, height: 40, borderRadius: 12, background: "rgba(127,29,29,0.3)", border: "1px solid rgba(127,29,29,0.6)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fca5a5" }}>
            <ChevronLeft style={{ width: 20, height: 20 }} />
          </button>
        )}
        {current < photos.length - 1 && (
          <button onClick={() => setCurrent((c) => c + 1)} style={{ position: "absolute", right: 12, width: 40, height: 40, borderRadius: 12, background: "rgba(127,29,29,0.3)", border: "1px solid rgba(127,29,29,0.6)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fca5a5" }}>
            <ChevronRight style={{ width: 20, height: 20 }} />
          </button>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, padding: "12px 16px 32px", overflowX: "auto", borderTop: "1px solid rgba(127,29,29,0.4)" }}>
        {photos.map((p, i) => (
          <button key={p.id} onClick={() => setCurrent(i)} style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 10, overflow: "hidden", padding: 0, border: i === current ? "2px solid #ef4444" : "2px solid transparent", cursor: "pointer", transition: "border-color 0.15s" }}>
            <img src={p.photoUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Weight Sparkline ─────────────────────────────────────────────────────────
function WeightSparkline({ rows }: { rows: TrackerRow[] }) {
  const points = rows.map((r, i) => ({ i, v: parseFloat(r.weight) })).filter((p) => !isNaN(p.v) && p.v > 0);
  if (points.length < 2) return null;
  const min = Math.min(...points.map((p) => p.v));
  const max = Math.max(...points.map((p) => p.v));
  const range = max - min || 1;
  const W = 80, H = 28;
  const toX = (i: number) => (i / (TOTAL_DAYS - 1)) * W;
  const toY = (v: number) => H - ((v - min) / range) * H;
  const d = points.map((p, idx) => `${idx === 0 ? "M" : "L"} ${toX(p.i).toFixed(1)} ${toY(p.v).toFixed(1)}`).join(" ");
  return (
    <svg width={W} height={H} style={{ display: "block", marginTop: 8 }}>
      <path d={d} fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={toX(points[points.length - 1].i)} cy={toY(points[points.length - 1].v)} r="2.5" fill="#f87171" />
    </svg>
  );
}

// ─── Animated Counter ─────────────────────────────────────────────────────────
function AnimatedCounter({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const duration = 800;
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);
  return <>{display.toLocaleString()}</>;
}

// ─── Summary Card ─────────────────────────────────────────────────────────────
function SummaryCard({ title, value, subtext, icon: Icon, extra }: {
  title: string; value: string | number; subtext: string;
  icon: React.ComponentType<{ className?: string }>; extra?: React.ReactNode;
}) {
  return (
    <Card className="summary-card">
      <CardContent className="summary-card-content">
        <div className="summary-grid">
          <div>
            <div className="summary-title">{title}</div>
            <div className="summary-value">
              {typeof value === "number" ? <AnimatedCounter value={value} /> : value}
            </div>
            <div className="summary-subtext">{subtext}</div>
            {extra}
          </div>
          <div className="summary-icon-wrap"><Icon className="summary-icon" /></div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Milestone Screen ─────────────────────────────────────────────────────────
function MilestoneScreen({ weekNumber, onClose }: { weekNumber: number; onClose: () => void }) {
  const msg = MILESTONE_MESSAGES[weekNumber] || { title: `WEEK ${weekNumber} DONE`, subtitle: "Keep going. Never stop." };
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ position: "fixed", inset: 0, zIndex: 250, background: "#000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div className="background-noise" /><div className="background-glow" />
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 18 }}
          style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: 380, width: "100%" }}>
          <motion.div animate={{ rotate: [0, -10, 10, -6, 6, 0] }} transition={{ delay: 0.4, duration: 0.6 }}
            style={{ fontSize: 72, marginBottom: 16 }}>🏆</motion.div>
          <div style={{ fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(252,165,165,0.6)", marginBottom: 12 }}>
            Week {weekNumber} of 75 Hard
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 900, letterSpacing: "0.1em", color: "#fff", margin: "0 0 16px", lineHeight: 1.1 }}>{msg.title}</h1>
          <p style={{ fontSize: 16, color: "rgba(252,165,165,0.8)", lineHeight: 1.6, marginBottom: 40 }}>{msg.subtitle}</p>
          <motion.button whileTap={{ scale: 0.97 }} onClick={onClose}
            style={{ width: "100%", padding: "18px", background: "linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)", border: "1px solid rgba(248,113,113,0.35)", borderRadius: 16, color: "#fff", fontSize: 16, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer" }}>
            KEEP GOING →
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Missed Day Banner ────────────────────────────────────────────────────────
function MissedDayBanner({ missedDay, onDismiss, onMarkComplete }: {
  missedDay: string; onDismiss: () => void; onMarkComplete: () => void;
}) {
  return (
    <motion.div initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -60, opacity: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 150, padding: "12px 16px", background: "linear-gradient(135deg, #1a0404, #2d0808)", borderBottom: "1px solid rgba(220,38,38,0.4)", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ fontSize: 20 }}>⚠️</div>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#fff" }}>Yesterday ({missedDay}) wasn't logged</p>
        <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(252,165,165,0.6)" }}>Want to mark it complete?</p>
      </div>
      <button onClick={onMarkComplete} style={{ background: "#dc2626", border: "none", borderRadius: 10, padding: "8px 14px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>Mark Done</button>
      <button onClick={onDismiss} style={{ background: "transparent", border: "none", color: "rgba(252,165,165,0.5)", cursor: "pointer", padding: 4 }}><X style={{ width: 16, height: 16 }} /></button>
    </motion.div>
  );
}

// ─── Weekly Export Modal ──────────────────────────────────────────────────────
function WeeklyExportModal({ group, userName, onClose }: {
  group: { weekNumber: number; rows: TrackerRow[]; startIndex: number };
  userName: string | null;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = 1080, H = 1080;
    canvas.width = W; canvas.height = H;

    // Background
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    const grad = ctx.createRadialGradient(W/2, 0, 0, W/2, 0, H);
    grad.addColorStop(0, "rgba(127,29,29,0.5)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.fillStyle = "#fff";
    ctx.font = "900 72px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(userName ? `${userName.toUpperCase()}'S 75 HARD` : "75 HARD CHALLENGE", W/2, 110);

    ctx.fillStyle = "rgba(252,165,165,0.7)";
    ctx.font = "500 36px sans-serif";
    ctx.fillText(`WEEK ${group.weekNumber} REPORT`, W/2, 165);

    // Grid
    const cols = habitColumns.length;
    const cellW = 120, cellH = 80, gridX = (W - (cols + 1) * cellW) / 2, gridY = 220;
    const labels = ["Date", ...habitColumns.map(h => h.label.split(" ")[0])];

    // Header row
    ctx.fillStyle = "rgba(127,29,29,0.8)";
    ctx.roundRect(gridX - 10, gridY - 10, (cols + 1) * cellW + 20, cellH + 20, 12);
    ctx.fill();
    labels.forEach((label, i) => {
      ctx.fillStyle = "#fca5a5";
      ctx.font = "700 24px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(label.substring(0, 8), gridX + i * cellW + cellW/2, gridY + 48);
    });

    // Data rows
    group.rows.forEach((row, ri) => {
      const y = gridY + (ri + 1) * (cellH + 8);
      ctx.fillStyle = isRowComplete(row) ? "rgba(185,28,28,0.3)" : "rgba(255,255,255,0.04)";
      ctx.roundRect(gridX - 10, y - 10, (cols + 1) * cellW + 20, cellH + 12, 8);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "600 26px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(row.dateLabel, gridX + cellW/2, y + 44);
      habitColumns.forEach((item, ci) => {
        const checked = row[item.key];
        ctx.fillStyle = checked ? "#ef4444" : "rgba(127,29,29,0.4)";
        ctx.beginPath();
        ctx.roundRect(gridX + (ci+1)*cellW + 20, y + 12, cellW - 40, cellH - 20, 8);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "700 28px sans-serif";
        ctx.fillText(checked ? "✓" : "–", gridX + (ci+1)*cellW + cellW/2, y + 44);
      });
    });

    // Stats
    const done = group.rows.reduce((s, r) => s + habitColumns.reduce((ss, item) => ss + (r[item.key] ? 1 : 0), 0), 0);
    const pct = Math.round((done / (group.rows.length * habitColumns.length)) * 100);
    const statY = gridY + (group.rows.length + 1) * (cellH + 8) + 20;
    ctx.fillStyle = "rgba(127,29,29,0.5)";
    ctx.roundRect(gridX - 10, statY, (cols + 1) * cellW + 20, 100, 16);
    ctx.fill();
    ctx.fillStyle = "#fca5a5";
    ctx.font = "700 28px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`COMPLETION ${pct}% • ${done}/${group.rows.length * habitColumns.length} HABITS`, W/2, statY + 58);

    // Footer
    ctx.fillStyle = "rgba(252,165,165,0.4)";
    ctx.font = "500 28px sans-serif";
    ctx.fillText("STAY RELENTLESS • 75 HARD", W/2, H - 50);

    setGenerated(true);
  }, [group, userName]);

  const handleShare = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `75hard-week${group.weekNumber}.png`, { type: "image/png" });
        if (navigator.share && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: `75 Hard Week ${group.weekNumber}` });
        } else {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = `75hard-week${group.weekNumber}.png`;
          a.click();
        }
      }, "image/png");
    } catch (e) { console.error(e); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(0,0,0,0.95)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid rgba(127,29,29,0.72)" }}>
        <button onClick={onClose} style={{ width: 38, height: 38, borderRadius: 12, background: "rgba(127,29,29,0.25)", border: "1px solid rgba(127,29,29,0.72)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fca5a5" }}>
          <ArrowLeft style={{ width: 18, height: 18 }} />
        </button>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#ffe8e8" }}>Week {group.weekNumber} Report</p>
        <motion.button whileTap={{ scale: 0.95 }} onClick={handleShare}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg, #7f1d1d, #dc2626)", border: "none", borderRadius: 12, padding: "9px 16px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          <Share2 style={{ width: 15, height: 15 }} /> Share
        </motion.button>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflow: "hidden" }}>
        <canvas ref={canvasRef} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 12, border: "1px solid rgba(127,29,29,0.4)" }} />
      </div>
    </motion.div>
  );
}

// ─── Daily Challenge Card ─────────────────────────────────────────────────────
function DailyChallengeCardModal({ todayIndex, userName, rows, onClose }: {
  todayIndex: number; userName: string | null; rows: TrackerRow[]; onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dayNumber = todayIndex + 1;
  const quote = DAILY_QUOTES[(todayIndex) % DAILY_QUOTES.length];
  const todayRow = rows[todayIndex];
  const completedHabits = todayRow ? habitColumns.filter(h => todayRow[h.key]).length : 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Instagram Story dimensions 1080x1920
    const W = 1080, H = 1920;
    canvas.width = W; canvas.height = H;

    // Background
    ctx.fillStyle = "#050000";
    ctx.fillRect(0, 0, W, H);

    // Top red glow
    const topGrad = ctx.createRadialGradient(W/2, 0, 0, W/2, 0, 900);
    topGrad.addColorStop(0, "rgba(127,29,29,0.7)");
    topGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, W, H);

    // Bottom glow
    const botGrad = ctx.createRadialGradient(W/2, H, 0, W/2, H, 700);
    botGrad.addColorStop(0, "rgba(69,10,10,0.5)");
    botGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = botGrad;
    ctx.fillRect(0, 0, W, H);

    // Top label
    ctx.fillStyle = "rgba(252,165,165,0.5)";
    ctx.font = "500 36px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("75 HARD CHALLENGE", W/2, 120);

    // Name
    if (userName) {
      ctx.fillStyle = "rgba(252,165,165,0.7)";
      ctx.font = "700 44px sans-serif";
      ctx.fillText(userName.toUpperCase(), W/2, 185);
    }

    // Big day number
    ctx.fillStyle = "#b91c1c";
    ctx.font = "900 320px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${dayNumber}`, W/2, 620);

    // "DAY" label above
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.font = "900 100px sans-serif";
    ctx.fillText("DAY", W/2, 340);

    // "OF 75" below
    ctx.fillStyle = "rgba(252,165,165,0.4)";
    ctx.font = "700 64px sans-serif";
    ctx.fillText(`OF 75`, W/2, 720);

    // Divider line
    ctx.strokeStyle = "rgba(127,29,29,0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W * 0.15, 790);
    ctx.lineTo(W * 0.85, 790);
    ctx.stroke();

    // Habit checklist
    const habitY = 860;
    const habitLabels = ["Progress Photo", "Workout 1", "Diet", "Outdoor Workout", "Read 10 Pages", "1 Gallon Water"];
    habitLabels.forEach((label, i) => {
      const done = todayRow ? todayRow[habitColumns[i].key] : false;
      const y = habitY + i * 110;
      // Pill background
      ctx.fillStyle = done ? "rgba(185,28,28,0.3)" : "rgba(255,255,255,0.04)";
      ctx.beginPath();
      ctx.roundRect(W*0.1, y, W*0.8, 86, 20);
      ctx.fill();
      // Checkbox
      ctx.fillStyle = done ? "#dc2626" : "rgba(127,29,29,0.4)";
      ctx.beginPath();
      ctx.roundRect(W*0.1 + 18, y + 18, 50, 50, 12);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "700 34px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(done ? "✓" : "–", W*0.1 + 28, y + 54);
      // Label
      ctx.fillStyle = done ? "#fff" : "rgba(255,255,255,0.5)";
      ctx.font = done ? "700 36px sans-serif" : "400 36px sans-serif";
      ctx.fillText(label, W*0.1 + 90, y + 54);
    });

    // Progress bar
    const barY = habitY + 6 * 110 + 30;
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath(); ctx.roundRect(W*0.1, barY, W*0.8, 20, 10); ctx.fill();
    ctx.fillStyle = "#dc2626";
    ctx.beginPath(); ctx.roundRect(W*0.1, barY, W*0.8*(dayNumber/75), 20, 10); ctx.fill();
    ctx.fillStyle = "rgba(252,165,165,0.5)";
    ctx.font = "500 32px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${Math.round((dayNumber/75)*100)}% COMPLETE`, W/2, barY + 60);

    // Quote
    const qY = barY + 110;
    ctx.fillStyle = "rgba(252,165,165,0.35)";
    ctx.font = "italic 500 38px sans-serif";
    ctx.textAlign = "center";
    // Word wrap quote
    const words = quote.split(" ");
    let line = ""; const lines: string[] = [];
    words.forEach(w => {
      const test = line + w + " ";
      if (ctx.measureText(test).width > W * 0.75) { lines.push(line.trim()); line = w + " "; }
      else line = test;
    });
    lines.push(line.trim());
    lines.forEach((l, i) => ctx.fillText(`"${i === 0 ? "" : ""}${l}${i === lines.length-1 ? "" : ""}"`, W/2, qY + i * 52));

    // Footer
    ctx.fillStyle = "rgba(252,165,165,0.2)";
    ctx.font = "500 30px sans-serif";
    ctx.fillText("STAY RELENTLESS", W/2, H - 60);
  }, [todayIndex, userName, rows]);

  const handleShare = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `75hard-day${dayNumber}.png`, { type: "image/png" });
      try {
        if (navigator.share && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: `75 Hard — Day ${dayNumber}` });
        } else {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = `75hard-day${dayNumber}.png`;
          a.click();
        }
      } catch (e) { console.error(e); }
    }, "image/png");
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(0,0,0,0.96)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid rgba(127,29,29,0.72)" }}>
        <button onClick={onClose} style={{ width: 38, height: 38, borderRadius: 12, background: "rgba(127,29,29,0.25)", border: "1px solid rgba(127,29,29,0.72)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fca5a5" }}>
          <ArrowLeft style={{ width: 18, height: 18 }} />
        </button>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#ffe8e8" }}>Day {dayNumber} Card</p>
        <motion.button whileTap={{ scale: 0.95 }} onClick={handleShare}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg, #7f1d1d, #dc2626)", border: "none", borderRadius: 12, padding: "9px 16px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          <Share2 style={{ width: 15, height: 15 }} /> Share
        </motion.button>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflow: "hidden" }}>
        <canvas ref={canvasRef} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 12, border: "1px solid rgba(127,29,29,0.4)" }} />
      </div>
    </motion.div>
  );
}

// ─── Certificate Modal ────────────────────────────────────────────────────────
function CertificateModal({ rows, userName, onClose }: { rows: TrackerRow[]; userName: string | null; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const completedDays = rows.filter(isRowComplete).length;
  const startDate = getStartDate();
  const endRow = rows[TOTAL_DAYS - 1];
  const firstW = rows.find(r => r.weight.trim());
  const lastW = [...rows].reverse().find(r => r.weight.trim());
  const weightLost = firstW && lastW ? (parseFloat(firstW.weight) - parseFloat(lastW.weight)).toFixed(1) : null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = 1400, H = 1000;
    canvas.width = W; canvas.height = H;

    // Background
    ctx.fillStyle = "#050000";
    ctx.fillRect(0, 0, W, H);
    const grad = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, 700);
    grad.addColorStop(0, "rgba(127,29,29,0.4)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

    // Border
    ctx.strokeStyle = "rgba(127,29,29,0.8)";
    ctx.lineWidth = 3;
    ctx.strokeRect(30, 30, W - 60, H - 60);
    ctx.strokeStyle = "rgba(127,29,29,0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(44, 44, W - 88, H - 88);

    // Header
    ctx.fillStyle = "rgba(252,165,165,0.5)";
    ctx.font = "500 28px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("CERTIFICATE OF COMPLETION", W/2, 110);

    // Trophy
    ctx.font = "80px sans-serif";
    ctx.fillText("🏆", W/2, 220);

    // Title
    ctx.fillStyle = "#fff";
    ctx.font = "900 72px sans-serif";
    ctx.fillText("75 HARD", W/2, 320);

    ctx.fillStyle = "#b91c1c";
    ctx.font = "900 36px sans-serif";
    ctx.fillText("CHALLENGE COMPLETE", W/2, 375);

    // Divider
    ctx.strokeStyle = "rgba(127,29,29,0.6)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(W*0.2, 410); ctx.lineTo(W*0.8, 410); ctx.stroke();

    // Name
    ctx.fillStyle = "rgba(252,165,165,0.5)";
    ctx.font = "400 28px sans-serif";
    ctx.fillText("This certifies that", W/2, 460);
    ctx.fillStyle = "#fff";
    ctx.font = "900 68px sans-serif";
    ctx.fillText((userName || "CHAMPION").toUpperCase(), W/2, 540);

    ctx.fillStyle = "rgba(252,165,165,0.5)";
    ctx.font = "400 28px sans-serif";
    ctx.fillText("has completed 75 days of relentless discipline", W/2, 590);

    // Stats row
    const stats = [
      { label: "Days Completed", value: `${completedDays}/75` },
      { label: "Started", value: new Date(`${startDate}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) },
      { label: "Finished", value: endRow?.dateLabel || "—" },
      ...(weightLost && Number(weightLost) > 0 ? [{ label: "Weight Lost", value: `${weightLost} kg` }] : []),
    ];
    const statW = (W - 120) / stats.length;
    stats.forEach((s, i) => {
      const x = 60 + i * statW + statW / 2;
      ctx.fillStyle = "rgba(127,29,29,0.4)";
      ctx.beginPath(); ctx.roundRect(60 + i * statW + 10, 630, statW - 20, 110, 16); ctx.fill();
      ctx.fillStyle = "rgba(252,165,165,0.6)";
      ctx.font = "500 22px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(s.label.toUpperCase(), x, 668);
      ctx.fillStyle = "#fff";
      ctx.font = "700 36px sans-serif";
      ctx.fillText(s.value, x, 712);
    });

    // Footer
    ctx.fillStyle = "rgba(252,165,165,0.25)";
    ctx.font = "400 24px sans-serif";
    ctx.fillText("STAY RELENTLESS • 75 HARD CHALLENGE", W/2, 820);

    // Signature line
    ctx.strokeStyle = "rgba(127,29,29,0.4)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(W*0.35, 890); ctx.lineTo(W*0.65, 890); ctx.stroke();
    ctx.fillStyle = "rgba(252,165,165,0.3)";
    ctx.font = "400 20px sans-serif";
    ctx.fillText("EARNED THROUGH DISCIPLINE", W/2, 920);
  }, [rows, userName]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "75hard-certificate.png";
    a.click();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(0,0,0,0.96)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid rgba(127,29,29,0.72)" }}>
        <button onClick={onClose} style={{ width: 38, height: 38, borderRadius: 12, background: "rgba(127,29,29,0.25)", border: "1px solid rgba(127,29,29,0.72)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fca5a5" }}>
          <ArrowLeft style={{ width: 18, height: 18 }} />
        </button>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#ffe8e8" }}>Your Certificate</p>
        <motion.button whileTap={{ scale: 0.95 }} onClick={handleDownload}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg, #7f1d1d, #dc2626)", border: "none", borderRadius: 12, padding: "9px 16px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          <Share2 style={{ width: 15, height: 15 }} /> Download
        </motion.button>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflow: "hidden" }}>
        <canvas ref={canvasRef} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 12, border: "1px solid rgba(127,29,29,0.4)" }} />
      </div>
    </motion.div>
  );
}

// ─── Scriptable Widget Export ─────────────────────────────────────────────────
function WidgetExportModal({ rows, todayIndex, userName, onClose }: {
  rows: TrackerRow[]; todayIndex: number; userName: string | null; onClose: () => void;
}) {
  const todayRow = rows[todayIndex];
  const completedHabits = todayRow ? habitColumns.filter(h => todayRow[h.key]).length : 0;
  const dayNumber = todayIndex + 1;

  const widgetData = {
    name: userName || "Athlete",
    day: dayNumber,
    total: TOTAL_DAYS,
    progress: Math.round((dayNumber / TOTAL_DAYS) * 100),
    habits: habitColumns.map(h => ({
      label: h.label,
      done: todayRow ? Boolean(todayRow[h.key]) : false,
    })),
    completedToday: completedHabits,
    totalHabits: habitColumns.length,
    lastUpdated: new Date().toISOString(),
  };

  const scriptableCode = `// 75 Hard Widget for iOS Scriptable
// Install Scriptable from App Store, paste this code
const data = ${JSON.stringify(widgetData, null, 2)};

const w = new ListWidget();
w.backgroundColor = new Color("#050000");
w.setPadding(12, 14, 12, 14);

// Header
const header = w.addText("75 HARD");
header.font = Font.boldSystemFont(11);
header.textColor = new Color("#b91c1c");
header.textOpacity = 0.9;
w.addSpacer(2);

// Day
const dayText = w.addText(\`DAY \${data.day} / \${data.total}\`);
dayText.font = Font.boldSystemFont(22);
dayText.textColor = Color.white();
w.addSpacer(6);

// Habits
data.habits.forEach(h => {
  const row = w.addText(\`\${h.done ? "✅" : "⬜"} \${h.label}\`);
  row.font = Font.systemFont(11);
  row.textColor = h.done ? Color.white() : new Color("#fca5a5", 0.4);
  w.addSpacer(2);
});

w.addSpacer(6);
const prog = w.addText(\`\${data.completedToday}/\${data.totalHabits} today • \${data.progress}% overall\`);
prog.font = Font.systemFont(10);
prog.textColor = new Color("#fca5a5", 0.5);

Script.setWidget(w);
w.presentSmall();`;

  const handleCopy = () => {
    navigator.clipboard.writeText(scriptableCode).catch(() => {
      const ta = document.createElement("textarea");
      ta.value = scriptableCode; document.body.appendChild(ta);
      ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
    });
  };

  const handleDownload = () => {
    const blob = new Blob([scriptableCode], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "75Hard-Widget.js";
    a.click();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 90, background: "#000", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid rgba(127,29,29,0.72)" }}>
        <button onClick={onClose} style={{ width: 38, height: 38, borderRadius: 12, background: "rgba(127,29,29,0.25)", border: "1px solid rgba(127,29,29,0.72)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fca5a5" }}>
          <ArrowLeft style={{ width: 18, height: 18 }} />
        </button>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#ffe8e8" }}>Home Screen Widget</p>
        <div style={{ width: 38 }} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 18px" }}>
        {/* Preview */}
        <div style={{ background: "linear-gradient(135deg, #050000, #1a0404)", border: "1px solid rgba(127,29,29,0.5)", borderRadius: 20, padding: 20, marginBottom: 20 }}>
          <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#b91c1c", letterSpacing: "0.1em" }}>75 HARD</p>
          <p style={{ margin: "0 0 12px", fontSize: 22, fontWeight: 900, color: "#fff" }}>DAY {dayNumber} / {TOTAL_DAYS}</p>
          {habitColumns.map(h => (
            <div key={h.key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 14 }}>{todayRow?.[h.key] ? "✅" : "⬜"}</span>
              <span style={{ fontSize: 12, color: todayRow?.[h.key] ? "#fff" : "rgba(252,165,165,0.35)" }}>{h.label}</span>
            </div>
          ))}
          <p style={{ margin: "10px 0 0", fontSize: 11, color: "rgba(252,165,165,0.4)" }}>{completedHabits}/{habitColumns.length} today • {Math.round((dayNumber/TOTAL_DAYS)*100)}% overall</p>
        </div>

        <p style={{ fontSize: 12, color: "rgba(252,165,165,0.6)", marginBottom: 16, lineHeight: 1.6 }}>
          Install <strong style={{ color: "#fca5a5" }}>Scriptable</strong> from the App Store, tap the button below to copy the code, then create a new script and paste it in.
        </p>

        <div style={{ display: "flex", gap: 10 }}>
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleCopy}
            style={{ flex: 1, padding: "14px", background: "linear-gradient(135deg, #7f1d1d, #dc2626)", border: "none", borderRadius: 14, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            Copy Code
          </motion.button>
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleDownload}
            style={{ flex: 1, padding: "14px", background: "rgba(127,29,29,0.2)", border: "1px solid rgba(127,29,29,0.5)", borderRadius: 14, color: "#fca5a5", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            Download .js
          </motion.button>
        </div>

        <div style={{ marginTop: 16, background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 14, maxHeight: 200, overflowY: "auto", border: "1px solid rgba(127,29,29,0.2)" }}>
          <pre style={{ margin: 0, fontSize: 10, color: "rgba(252,165,165,0.4)", whiteSpace: "pre-wrap", lineHeight: 1.5, fontFamily: "monospace" }}>{scriptableCode}</pre>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Weekly Summary Modal ─────────────────────────────────────────────────────
function WeeklySummaryModal({ open, onClose, summary }: {
  open: boolean; onClose: () => void;
  summary: null | { weekNumber: number; averageCalories: string; averageSteps: string; completionRate: number };
}) {
  if (!summary) return null;
  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="modal-card" initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 10 }} transition={{ type: "spring", stiffness: 240, damping: 22 }}>
            <div className="modal-header">
              <button type="button" className="icon-close-btn" onClick={onClose}><X className="mini-icon" /></button>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Trophy style={{ width: 18, height: 18, color: "#fca5a5" }} />
                <div className="mini-label">Weekly Summary</div>
              </div>
              <h2 className="modal-title">WEEK {summary.weekNumber} COMPLETE</h2>
              <p className="modal-copy">Strong finish. Here is your weekly discipline snapshot.</p>
            </div>
            <div className="modal-stats">
              <div className="modal-stat"><div className="mini-label">Avg Calories</div><div className="modal-stat-value">{summary.averageCalories}</div></div>
              <div className="modal-stat"><div className="mini-label">Avg Steps</div><div className="modal-stat-value">{summary.averageSteps}</div></div>
              <div className="modal-stat"><div className="mini-label">Completion</div><div className="modal-stat-value">{summary.completionRate}%</div></div>
            </div>
            <div className="modal-footer"><Button className="w-full" onClick={onClose}>Keep Going</Button></div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

// ─── Photo Source Modal ───────────────────────────────────────────────────────
function PhotoSourceModal({ onSelect, onClose }: { onSelect: (s: "camera" | "gallery") => void; onClose: () => void }) {
  return (
    <AnimatePresence>
      <motion.div className="modal-overlay" style={{ alignItems: "flex-end", padding: 0 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
        <motion.div onClick={(e) => e.stopPropagation()} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 320, damping: 32 }}
          style={{ width: "100%", maxWidth: 520, margin: "0 auto", background: "linear-gradient(160deg, #0a0000 0%, #140303 60%, #1c0505 100%)", borderRadius: "28px 28px 0 0", border: "1px solid rgba(127,29,29,0.72)", borderBottom: "none", padding: "14px 0 48px", boxShadow: "0 -20px 60px rgba(127,29,29,0.28)" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}><div style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(252,165,165,0.25)" }} /></div>
          <p style={{ textAlign: "center", margin: "0 0 28px", fontSize: 10, letterSpacing: "0.34em", textTransform: "uppercase", color: "rgba(252,165,165,0.55)" }}>Add Proof Photo</p>
          <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: 12 }}>
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => onSelect("camera")} style={{ background: "linear-gradient(135deg, #7f1d1d 0%, #b91c1c 100%)", border: "1px solid rgba(248,113,113,0.35)", borderRadius: 20, padding: "20px 22px", display: "flex", alignItems: "center", gap: 18, cursor: "pointer", width: "100%", boxShadow: "0 8px 32px rgba(185,28,28,0.3)" }}>
              <div style={{ width: 54, height: 54, borderRadius: 16, flexShrink: 0, background: "rgba(255,255,255,0.14)", display: "flex", alignItems: "center", justifyContent: "center" }}><Camera style={{ width: 26, height: 26, color: "#fff" }} /></div>
              <div style={{ textAlign: "left" }}><p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#fff" }}>Take Photo</p><p style={{ margin: "4px 0 0", fontSize: 13, color: "rgba(255,255,255,0.6)" }}>Open camera directly</p></div>
            </motion.button>
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => onSelect("gallery")} style={{ background: "rgba(20,5,5,0.9)", border: "1px solid rgba(127,29,29,0.72)", borderRadius: 20, padding: "20px 22px", display: "flex", alignItems: "center", gap: 18, cursor: "pointer", width: "100%" }}>
              <div style={{ width: 54, height: 54, borderRadius: 16, flexShrink: 0, background: "rgba(127,29,29,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}><Images style={{ width: 26, height: 26, color: "#fca5a5" }} /></div>
              <div style={{ textAlign: "left" }}><p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#ffe8e8" }}>Choose from Gallery</p><p style={{ margin: "4px 0 0", fontSize: 13, color: "rgba(252,165,165,0.6)" }}>Upload an existing photo</p></div>
            </motion.button>
            <button onClick={onClose} style={{ marginTop: 6, width: "100%", background: "transparent", border: "1px solid rgba(127,29,29,0.5)", borderRadius: 16, padding: "15px", color: "rgba(252,165,165,0.5)", fontSize: 15, cursor: "pointer" }}>Cancel</button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Photo Viewer Modal ───────────────────────────────────────────────────────
function PhotoViewerModal({ photo, rowLabel, onClose, onReplace }: { photo: string; rowLabel: string; onClose: () => void; onReplace: () => void }) {
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.97)", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid rgba(127,29,29,0.72)", background: "linear-gradient(180deg, rgba(69,10,10,0.5) 0%, transparent 100%)" }}>
          <button onClick={onClose} style={{ width: 38, height: 38, borderRadius: 12, background: "rgba(127,29,29,0.25)", border: "1px solid rgba(127,29,29,0.72)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fca5a5" }}><ArrowLeft style={{ width: 18, height: 18 }} /></button>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#ffe8e8" }}>{rowLabel}</p>
          <button onClick={onReplace} style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(127,29,29,0.25)", border: "1px solid rgba(220,38,38,0.55)", borderRadius: 12, padding: "8px 14px", color: "#f87171", fontSize: 13, fontWeight: 600, cursor: "pointer" }}><RefreshCw style={{ width: 14, height: 14 }} /> Replace</button>
        </div>
        <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 22 }} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <img src={photo} alt="Progress photo" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 20, border: "1px solid rgba(127,29,29,0.5)", boxShadow: "0 0 80px rgba(185,28,28,0.22)" }} />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Before / After Modal ─────────────────────────────────────────────────────
function BeforeAfterModal({ rows, onClose }: { rows: TrackerRow[]; onClose: () => void }) {
  const photos = rows.filter((r) => r.photoUrl);
  const first = photos[0];
  const latest = photos[photos.length - 1];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 85, background: "#000", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid rgba(127,29,29,0.72)", background: "linear-gradient(180deg, rgba(69,10,10,0.5) 0%, transparent 100%)" }}>
        <button onClick={onClose} style={{ width: 38, height: 38, borderRadius: 12, background: "rgba(127,29,29,0.25)", border: "1px solid rgba(127,29,29,0.72)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fca5a5" }}>
          <ArrowLeft style={{ width: 18, height: 18 }} />
        </button>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#ffe8e8" }}>Before vs After</p>
        <div style={{ width: 38 }} />
      </div>

      {photos.length < 2 ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 32 }}>
          <Layers style={{ width: 48, height: 48, color: "rgba(127,29,29,0.5)" }} />
          <p style={{ color: "rgba(252,165,165,0.6)", fontSize: 14, textAlign: "center", letterSpacing: "0.06em" }}>
            {photos.length === 0 ? "No progress photos yet" : "Need at least 2 photos to compare"}
          </p>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 16, gap: 12, overflow: "hidden" }}>
          {/* Labels */}
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1, textAlign: "center" }}>
              <span style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(252,165,165,0.5)" }}>BEFORE</span>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "#fca5a5", fontWeight: 700 }}>{first.countdown} · {first.dateLabel}</p>
            </div>
            <div style={{ width: 1, background: "rgba(127,29,29,0.6)" }} />
            <div style={{ flex: 1, textAlign: "center" }}>
              <span style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(252,165,165,0.5)" }}>AFTER</span>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "#fca5a5", fontWeight: 700 }}>{latest.countdown} · {latest.dateLabel}</p>
            </div>
          </div>

          {/* Split images */}
          <div style={{ flex: 1, display: "flex", gap: 12, overflow: "hidden" }}>
            <div style={{ flex: 1, borderRadius: 16, overflow: "hidden", border: "1px solid rgba(127,29,29,0.5)" }}>
              <img src={first.photoUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="Before" />
            </div>
            <div style={{ width: 2, background: "linear-gradient(180deg, transparent, rgba(220,38,38,0.8), transparent)", borderRadius: 1 }} />
            <div style={{ flex: 1, borderRadius: 16, overflow: "hidden", border: "1px solid rgba(127,29,29,0.5)" }}>
              <img src={latest.photoUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="After" />
            </div>
          </div>

          {/* Days elapsed */}
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <span style={{ fontSize: 11, color: "rgba(252,165,165,0.4)", letterSpacing: "0.1em" }}>
              {latest.id - first.id} DAYS OF PROGRESS
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── Notification Settings Modal ──────────────────────────────────────────────
function NotificationModal({ onClose }: { onClose: () => void }) {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [hour, setHour] = useState(() => {
    const saved = localStorage.getItem(NOTIF_KEY);
    return saved ? JSON.parse(saved).hour : 20;
  });
  const [minute, setMinute] = useState(() => {
    const saved = localStorage.getItem(NOTIF_KEY);
    return saved ? JSON.parse(saved).minute : 0;
  });
  const [enabled, setEnabled] = useState(() => {
    const saved = localStorage.getItem(NOTIF_KEY);
    return saved ? JSON.parse(saved).enabled : false;
  });
  const [saved, setSaved] = useState(false);

  const requestAndEnable = async () => {
    if (typeof Notification === "undefined") { alert("Notifications not supported on this browser."); return; }
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") {
      setEnabled(true);
      saveSettings(true);
    }
  };

  const saveSettings = (forceEnabled?: boolean) => {
    const isEnabled = forceEnabled ?? enabled;
    localStorage.setItem(NOTIF_KEY, JSON.stringify({ hour, minute, enabled: isEnabled }));
    scheduleNotification(hour, minute, isEnabled);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const scheduleNotification = (h: number, m: number, isEnabled: boolean) => {
    // Clear any existing scheduled notification
    const existingId = localStorage.getItem("75_hard_notif_timeout");
    if (existingId) clearTimeout(Number(existingId));
    if (!isEnabled || permission !== "granted") return;

    const schedule = () => {
      const now = new Date();
      const target = new Date();
      target.setHours(h, m, 0, 0);
      if (target <= now) target.setDate(target.getDate() + 1);
      const delay = target.getTime() - now.getTime();
      const id = window.setTimeout(() => {
        new Notification("75 Hard Tracker 🔥", {
          body: "Time to log your habits! Stay relentless.",
          icon: "/icon-192.png",
          badge: "/icon-192.png",
        });
        schedule(); // reschedule for next day
      }, delay);
      localStorage.setItem("75_hard_notif_timeout", String(id));
    };
    schedule();
  };

  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const ampm = hour < 12 ? "AM" : "PM";

  return (
    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}>
      <motion.div onClick={(e) => e.stopPropagation()}
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        style={{ width: "100%", maxWidth: 520, margin: "0 auto", background: "linear-gradient(160deg, #0a0000 0%, #140303 60%, #1c0505 100%)", borderRadius: "28px 28px 0 0", border: "1px solid rgba(127,29,29,0.72)", borderBottom: "none", padding: "14px 24px 52px", boxShadow: "0 -20px 60px rgba(127,29,29,0.28)" }}>

        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(252,165,165,0.25)" }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <Bell style={{ width: 20, height: 20, color: "#fca5a5" }} />
          <p style={{ margin: 0, fontSize: 10, letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(252,165,165,0.6)" }}>Daily Reminder</p>
        </div>

        {permission === "denied" ? (
          <div style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 14, padding: 16, marginBottom: 20 }}>
            <p style={{ margin: 0, fontSize: 13, color: "#f87171", lineHeight: 1.5 }}>
              Notifications are blocked. Please enable them in your browser/phone settings, then return here.
            </p>
          </div>
        ) : permission !== "granted" ? (
          <motion.button whileTap={{ scale: 0.97 }} onClick={requestAndEnable}
            style={{ width: "100%", padding: "18px", background: "linear-gradient(135deg, #7f1d1d 0%, #b91c1c 100%)", border: "1px solid rgba(248,113,113,0.35)", borderRadius: 16, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <Bell style={{ width: 18, height: 18 }} /> Enable Notifications
          </motion.button>
        ) : (
          <>
            {/* Toggle */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: "14px 16px", border: "1px solid rgba(127,29,29,0.4)" }}>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#ffe8e8" }}>Daily reminder</p>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "rgba(252,165,165,0.5)" }}>{enabled ? `Set for ${displayHour}:${String(minute).padStart(2,"0")} ${ampm}` : "Disabled"}</p>
              </div>
              <button onClick={() => { setEnabled(!enabled); }} style={{ width: 48, height: 26, borderRadius: 13, background: enabled ? "#dc2626" : "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
                <div style={{ position: "absolute", top: 3, left: enabled ? 25 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
              </button>
            </div>

            {/* Time picker */}
            {enabled && (
              <div style={{ marginBottom: 24 }}>
                <p style={{ margin: "0 0 12px", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(252,165,165,0.5)" }}>Reminder time</p>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: "0 0 6px", fontSize: 11, color: "rgba(252,165,165,0.4)" }}>Hour</p>
                    <input type="range" min={0} max={23} value={hour} onChange={(e) => setHour(Number(e.target.value))}
                      style={{ width: "100%", accentColor: "#dc2626" }} />
                    <p style={{ margin: "4px 0 0", fontSize: 16, fontWeight: 700, color: "#fff", textAlign: "center" }}>{displayHour} {ampm}</p>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: "0 0 6px", fontSize: 11, color: "rgba(252,165,165,0.4)" }}>Minute</p>
                    <input type="range" min={0} max={59} step={5} value={minute} onChange={(e) => setMinute(Number(e.target.value))}
                      style={{ width: "100%", accentColor: "#dc2626" }} />
                    <p style={{ margin: "4px 0 0", fontSize: 16, fontWeight: 700, color: "#fff", textAlign: "center" }}>{String(minute).padStart(2, "0")}</p>
                  </div>
                </div>
              </div>
            )}

            <motion.button whileTap={{ scale: 0.97 }} onClick={() => saveSettings()}
              style={{ width: "100%", padding: "16px", background: saved ? "rgba(34,197,94,0.2)" : "linear-gradient(135deg, #7f1d1d 0%, #b91c1c 100%)", border: saved ? "1px solid rgba(34,197,94,0.5)" : "1px solid rgba(248,113,113,0.35)", borderRadius: 16, color: saved ? "#4ade80" : "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "all 0.3s" }}>
              {saved ? "✓ Saved!" : "Save Reminder"}
            </motion.button>
          </>
        )}

        <button onClick={onClose} style={{ marginTop: 12, width: "100%", background: "transparent", border: "1px solid rgba(127,29,29,0.4)", borderRadius: 14, padding: "13px", color: "rgba(252,165,165,0.4)", fontSize: 14, cursor: "pointer" }}>Close</button>
      </motion.div>
    </motion.div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [rows, setRows] = useState<TrackerRow[]>(() => createRows());
  const [loaded, setLoaded] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [activeRow, setActiveRow] = useState<number | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showBeforeAfter, setShowBeforeAfter] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showDailyCard, setShowDailyCard] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);
  const [showWidget, setShowWidget] = useState(false);
  const [stravaToken, setStravaToken] = useState<StravaToken | null>(() => getStravaToken());
  const [stravaDrawer, setStravaDrawer] = useState<{ date: string; dateLabel: string } | null>(null);
  const [garminDrawer, setGarminDrawer] = useState<{ date: string; dateLabel: string } | null>(null);
  const [sleepPopup, setSleepPopup] = useState<{ sleep: SleepData; dateLabel: string } | null>(null);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("75_hard_theme");
    return saved ? saved === "dark" : true;
  });
  const [milestone, setMilestone] = useState<number | null>(null);
  const [missedDayIndex, setMissedDayIndex] = useState<number | null>(null);
  const [exportGroup, setExportGroup] = useState<{ weekNumber: number; rows: TrackerRow[]; startIndex: number } | null>(null);
  const [photoSourceTarget, setPhotoSourceTarget] = useState<number | null>(null);
  const [viewingPhotoIndex, setViewingPhotoIndex] = useState<number | null>(null);
  const [weeklySummary, setWeeklySummary] = useState<null | { weekNumber: number; averageCalories: string; averageSteps: string; completionRate: number }>(null);
  const [isWeeklySummaryOpen, setIsWeeklySummaryOpen] = useState(false);

  const photoInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const galleryInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const todayRowRef = useRef<HTMLDivElement | null>(null);
  const openedWeekSummariesRef = useRef<Set<number>>(new Set());
  const audioContextRef = useRef<AudioContext | null>(null);
  const prevCompletedDaysRef = useRef(0);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) { const parsed = JSON.parse(saved); if (Array.isArray(parsed) && parsed.length === TOTAL_DAYS) setRows(parsed); }
      const savedUser = localStorage.getItem(USER_KEY);
      if (savedUser) setUserName(savedUser);
      else setShowOnboarding(true);
      // Reschedule notification if previously set
      const notifSettings = localStorage.getItem(NOTIF_KEY);
      if (notifSettings && typeof Notification !== "undefined" && Notification.permission === "granted") {
        const { hour, minute, enabled } = JSON.parse(notifSettings);
        if (enabled) {
          const schedule = () => {
            const now = new Date();
            const target = new Date();
            target.setHours(hour, minute, 0, 0);
            if (target <= now) target.setDate(target.getDate() + 1);
            const delay = target.getTime() - now.getTime();
            const id = window.setTimeout(() => {
              new Notification("75 Hard Tracker 🔥", { body: "Time to log your habits! Stay relentless.", icon: "/icon-192.png" });
              schedule();
            }, delay);
            localStorage.setItem("75_hard_notif_timeout", String(id));
          };
          schedule();
        }
      }
    } catch { setShowOnboarding(true); }
    finally { setLoaded(true); }
  }, []);

  // Handle Strava OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    if (!code || state !== "75hard") return;
    // Clear the URL
    window.history.replaceState({}, "", window.location.pathname);
    // Exchange code for token
    fetch("/api/strava-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, grant_type: "authorization_code" }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.access_token) {
          const token: StravaToken = {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_at: data.expires_at,
            athlete: data.athlete,
          };
          saveStravaToken(token);
          setStravaToken(token);
        }
      })
      .catch(console.error);
  }, []);

  const handleStravaConnect = useCallback(() => {
    const scope = "activity:read_all";
    const url = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&redirect_uri=${encodeURIComponent(window.location.origin)}&response_type=code&approval_prompt=auto&scope=${scope}&state=75hard`;
    window.location.href = url;
  }, []);

  const handleStravaDisconnect = useCallback(() => {
    clearStravaToken();
    setStravaToken(null);
  }, []);

  // Auto-sync Garmin data for all past days silently on load
  useEffect(() => {
    if (!loaded || todayIndex < 0) return;
    const GARMIN_SYNC_KEY = "75_hard_garmin_synced_days";
    let syncedDays: string[] = [];
    try { syncedDays = JSON.parse(localStorage.getItem(GARMIN_SYNC_KEY) || "[]"); } catch {}

    const daysToSync = rows
      .slice(0, todayIndex + 1)
      .filter(row => !syncedDays.includes(row.date));

    if (daysToSync.length === 0) return;

    const syncDay = async (row: TrackerRow) => {
      try {
        const [dataRes, activitiesRes] = await Promise.allSettled([
          fetch(`/api/garmin-data?date=${row.date}`).then(r => r.json()),
          fetch(`/api/garmin-activities?date=${row.date}`).then(r => r.json()),
        ]);
        const data = dataRes.status === "fulfilled" ? dataRes.value : null;
        const acts = activitiesRes.status === "fulfilled" ? (activitiesRes.value?.activities || []) : [];

        const patch: Partial<TrackerRow> = {};
        if (data?.steps && !row.steps) patch.steps = String(data.steps);
        if (data?.activeCalories && !row.calories) patch.calories = String(Math.round(data.activeCalories));
        if (data?.sleep) patch.sleepData = data.sleep;
        if (acts.length >= 1 && !row.workout1) patch.workout1 = true;
        if (acts.some((a: any) => a.isOutdoor) && !row.workout2) patch.workout2 = true;

        if (Object.keys(patch).length > 0) {
          const idx = rows.findIndex(r => r.date === row.date);
          if (idx >= 0) setRows(prev => { const next = [...prev]; next[idx] = { ...next[idx], ...patch }; return next; });
        }
        syncedDays.push(row.date);
        localStorage.setItem(GARMIN_SYNC_KEY, JSON.stringify(syncedDays));
      } catch { /* silent */ }
    };

    daysToSync.forEach((row, i) => setTimeout(() => syncDay(row), i * 800));
  }, [loaded, todayIndex]);

  useEffect(() => {
    if (!loaded || !todayRowRef.current) return;
    const t = window.setTimeout(() => todayRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" }), 450);
    return () => window.clearTimeout(t);
  }, [loaded]);

  const triggerFeedback = useCallback((type: "check" | "uncheck" | "lock" = "check") => {
    try {
      if (navigator.vibrate) {
        if (type === "check") navigator.vibrate([18, 10, 8]);
        else if (type === "uncheck") navigator.vibrate([8]);
        else if (type === "lock") navigator.vibrate([12, 20, 12]);
      }
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      if (!audioContextRef.current) audioContextRef.current = new AC();
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") ctx.resume();
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.type = "triangle";
      if (type === "check") {
        osc.frequency.setValueAtTime(900, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1250, ctx.currentTime + 0.04);
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.03, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.085);
      } else {
        osc.frequency.setValueAtTime(500, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(350, ctx.currentTime + 0.06);
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.02, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.09);
      }
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.1);
    } catch { /* silent */ }
  }, []);

  const triggerDayCompleteSound = useCallback(() => {
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      if (!audioContextRef.current) audioContextRef.current = new AC();
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") ctx.resume();
      [523, 659, 784, 1047].forEach((freq, i) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.type = "sine"; osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + i * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.12 + 0.18);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.12); osc.stop(ctx.currentTime + i * 0.12 + 0.2);
      });
    } catch { /* silent */ }
  }, []);

  const updateRow = useCallback((index: number, patch: Partial<TrackerRow>) => {
    setRows((prev) => { const next = [...prev]; next[index] = { ...next[index], ...patch }; return next; });
  }, []);

  const handleHabitToggle = useCallback((absoluteIndex: number, key: HabitKey) => {
    if (rows[absoluteIndex].locked) return;
    setActiveRow(absoluteIndex);
    const newVal = !rows[absoluteIndex][key];
    triggerFeedback(newVal ? "check" : "uncheck");
    const after = { ...rows[absoluteIndex], [key]: newVal };
    if (habitColumns.every((item) => after[item.key])) {
      setTimeout(() => { setShowConfetti(true); triggerDayCompleteSound(); }, 100);
    }
    updateRow(absoluteIndex, { [key]: newVal } as Partial<TrackerRow>);
  }, [rows, triggerFeedback, triggerDayCompleteSound, updateRow]);

  const handlePhotoUpload = useCallback(async (absoluteIndex: number, file?: File | null) => {
    if (rows[absoluteIndex].locked || !file) return;
    try {
      const compressed = await compressImage(file);
      setActiveRow(absoluteIndex);
      updateRow(absoluteIndex, { photoUrl: compressed, photo: true });
      triggerFeedback();
      const after = { ...rows[absoluteIndex], photoUrl: compressed, photo: true };
      if (habitColumns.every((item) => after[item.key])) {
        setTimeout(() => { setShowConfetti(true); triggerDayCompleteSound(); }, 100);
      }
    } catch { window.alert("Photo upload failed. Please try another image."); }
  }, [rows, triggerFeedback, triggerDayCompleteSound, updateRow]);

  const toggleRowLock = useCallback((absoluteIndex: number) => {
    if (!rowHasData(rows[absoluteIndex])) return;
    triggerFeedback("lock");
    updateRow(absoluteIndex, { locked: !rows[absoluteIndex].locked });
  }, [rows, triggerFeedback, updateRow]);

  const handlePhotoSourceSelect = useCallback((source: "camera" | "gallery") => {
    const idx = photoSourceTarget; setPhotoSourceTarget(null);
    if (idx === null) return;
    setTimeout(() => { source === "camera" ? photoInputRefs.current[idx]?.click() : galleryInputRefs.current[idx]?.click(); }, 200);
  }, [photoSourceTarget]);

  const todayIndex = useMemo(() => {
    const now = new Date();
    const startDate = getStartDate();
    const start = new Date(`${startDate}T00:00:00`);
    const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startMid = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const diffDays = Math.floor((todayMid.getTime() - startMid.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays < TOTAL_DAYS) return diffDays;
    return -1;
  }, [rows]);

  const totalChecks = useMemo(() => rows.reduce((sum, r) => sum + habitColumns.reduce((s, item) => s + (r[item.key] ? 1 : 0), 0), 0), [rows]);
  const completedDays = useMemo(() => rows.filter(isRowComplete).length, [rows]);
  const progressPercent = Math.round((totalChecks / (TOTAL_DAYS * habitColumns.length)) * 100);

  const latestWeight = useMemo(() => { const m = [...rows].reverse().find((r) => r.weight.trim()); return m ? m.weight : "—"; }, [rows]);
  const firstWeight = useMemo(() => { const m = rows.find((r) => r.weight.trim()); return m ? parseFloat(m.weight) : null; }, [rows]);
  const latestWeightNum = useMemo(() => { const m = [...rows].reverse().find((r) => r.weight.trim()); return m ? parseFloat(m.weight) : null; }, [rows]);
  const weightDelta = useMemo(() => {
    if (firstWeight === null || latestWeightNum === null || firstWeight === latestWeightNum) return null;
    const diff = latestWeightNum - firstWeight;
    const pct = ((diff / firstWeight) * 100).toFixed(1);
    return { diff: diff.toFixed(1), pct, lost: diff < 0 };
  }, [firstWeight, latestWeightNum]);

  const averageCalories = useMemo(() => { const v = rows.map((r) => Number(String(r.calories).replace(/,/g, ""))).filter((n) => isFinite(n) && n > 0); return v.length ? Math.round(v.reduce((a, b) => a + b) / v.length).toLocaleString() : "—"; }, [rows]);
  const averageSteps = useMemo(() => { const v = rows.map((r) => Number(String(r.steps).replace(/,/g, ""))).filter((n) => isFinite(n) && n > 0); return v.length ? Math.round(v.reduce((a, b) => a + b) / v.length).toLocaleString() : "—"; }, [rows]);

  // Missed day detection
  useEffect(() => {
    if (!loaded || todayIndex <= 0) return;
    const yesterday = rows[todayIndex - 1];
    if (yesterday && !isRowComplete(yesterday) && rowHasData(yesterday) === false) {
      const dismissed = localStorage.getItem(`75_hard_missed_dismissed_${todayIndex - 1}`);
      if (!dismissed) setMissedDayIndex(todayIndex - 1);
    }
  }, [loaded, todayIndex, rows]);

  const timelineBars = Array.from({ length: TOTAL_DAYS }, (_, i) => i < completedDays);
  const weekGroups = Array.from({ length: Math.ceil(TOTAL_DAYS / 7) }, (_, i) => ({ weekNumber: i + 1, rows: rows.slice(i * 7, i * 7 + 7), startIndex: i * 7 }));

  useEffect(() => {
    if (!loaded) return;
    if (prevCompletedDaysRef.current === 0 && completedDays > 0) {
      // First load with existing data — set baseline without firing confetti
      prevCompletedDaysRef.current = completedDays;
      return;
    }
    if (completedDays > prevCompletedDaysRef.current) { setShowConfetti(true); triggerDayCompleteSound(); }
    prevCompletedDaysRef.current = completedDays;
  }, [completedDays, loaded, triggerDayCompleteSound]);

  useEffect(() => {
    weekGroups.forEach((group) => {
      if (!group.rows.every(isRowComplete) || openedWeekSummariesRef.current.has(group.weekNumber)) return;
      openedWeekSummariesRef.current.add(group.weekNumber);
      // Show milestone screen instead of old weekly summary
      setTimeout(() => setMilestone(group.weekNumber), 400);
    });
  }, [rows]);

  // Dark mode effect
  useEffect(() => {
    localStorage.setItem("75_hard_theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  return (
    <div className={`app-shell${darkMode ? "" : " light-mode"}`}>
      <div className="background-noise" />
      <div className="background-glow" />

      <AnimatePresence>{showOnboarding && <OnboardingScreen onComplete={(name, startDate) => {
        setUserName(name);
        localStorage.setItem(USER_KEY, name);
        localStorage.setItem(START_DATE_KEY, startDate);
        setRows(createRows(startDate));
        setShowOnboarding(false);
      }} />}</AnimatePresence>
      {showConfetti && <Confetti onDone={() => setShowConfetti(false)} />}
      <WeeklySummaryModal open={isWeeklySummaryOpen} onClose={() => setIsWeeklySummaryOpen(false)} summary={weeklySummary} />
      <AnimatePresence>{milestone !== null && <MilestoneScreen weekNumber={milestone} onClose={() => setMilestone(null)} />}</AnimatePresence>
      <AnimatePresence>{missedDayIndex !== null && (
        <MissedDayBanner
          missedDay={rows[missedDayIndex]?.dateLabel || ""}
          onDismiss={() => { localStorage.setItem(`75_hard_missed_dismissed_${missedDayIndex}`, "1"); setMissedDayIndex(null); }}
          onMarkComplete={() => {
            const patch: Partial<TrackerRow> = {};
            habitColumns.forEach((item) => { if (item.key !== "photo") (patch as any)[item.key] = true; });
            updateRow(missedDayIndex!, patch);
            setMissedDayIndex(null);
          }}
        />
      )}</AnimatePresence>
      <AnimatePresence>{exportGroup && <WeeklyExportModal group={exportGroup} userName={userName} onClose={() => setExportGroup(null)} />}</AnimatePresence>
      {photoSourceTarget !== null && <PhotoSourceModal onSelect={handlePhotoSourceSelect} onClose={() => setPhotoSourceTarget(null)} />}
      {viewingPhotoIndex !== null && rows[viewingPhotoIndex]?.photoUrl && (
        <PhotoViewerModal photo={rows[viewingPhotoIndex].photoUrl} rowLabel={rows[viewingPhotoIndex].countdown}
          onClose={() => setViewingPhotoIndex(null)}
          onReplace={() => { const idx = viewingPhotoIndex; setViewingPhotoIndex(null); setTimeout(() => setPhotoSourceTarget(idx), 150); }}
        />
      )}
      <AnimatePresence>{showGallery && <PhotoGalleryModal rows={rows} onClose={() => setShowGallery(false)} />}</AnimatePresence>
      <AnimatePresence>{showBeforeAfter && <BeforeAfterModal rows={rows} onClose={() => setShowBeforeAfter(false)} />}</AnimatePresence>
      <AnimatePresence>{showNotifications && <NotificationModal onClose={() => setShowNotifications(false)} />}</AnimatePresence>
      <AnimatePresence>{showDailyCard && <DailyChallengeCardModal todayIndex={todayIndex} userName={userName} rows={rows} onClose={() => setShowDailyCard(false)} />}</AnimatePresence>
      <AnimatePresence>{showCertificate && <CertificateModal rows={rows} userName={userName} onClose={() => setShowCertificate(false)} />}</AnimatePresence>
      <AnimatePresence>{showWidget && <WidgetExportModal rows={rows} todayIndex={todayIndex} userName={userName} onClose={() => setShowWidget(false)} />}</AnimatePresence>
      <AnimatePresence>{garminDrawer && (
        <GarminWorkoutDrawer
          date={garminDrawer.date} dateLabel={garminDrawer.dateLabel}
          onClose={() => setGarminDrawer(null)}
          onAutoFill={(calories, steps, w1, w2) => {
            const idx = rows.findIndex(r => r.date === garminDrawer.date);
            if (idx < 0) return;
            const patch: Partial<TrackerRow> = {};
            if (calories) patch.calories = calories;
            if (steps) patch.steps = steps;
            if (w1) patch.workout1 = true;
            if (w2) patch.workout2 = true;
            updateRow(idx, patch);
          }}
        />
      )}</AnimatePresence>
      <AnimatePresence>{sleepPopup && (
        <SleepPopup sleep={sleepPopup.sleep} dateLabel={sleepPopup.dateLabel} onClose={() => setSleepPopup(null)} />
      )}</AnimatePresence>

      <div className="page">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="hero-card">
          <div className="hero-header">
            <div className="pill"><Flame className="mini-icon" /> Discipline • Consistency • Power</div>
            {userName ? (
              <>
                <h1 className="hero-title" style={{ marginBottom: 0 }}>{userName.toUpperCase()}'S</h1>
                <h1 className="hero-title" style={{ marginTop: 4, color: "#b91c1c" }}>75 HARD CHALLENGE</h1>
              </>
            ) : (
              <h1 className="hero-title">75 HARD CHALLENGE</h1>
            )}
          </div>

          <div className="hero-body">
            <div className="timeline-card">
              <div className="timeline-row">
                <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
                  <div>
                    <div className="mini-label">Challenge Timeline</div>
                    <div className="timeline-day">Day {Math.min(Math.max(completedDays + 1, 1), TOTAL_DAYS)} / {TOTAL_DAYS}</div>
                  </div>
                </div>
                <div className="timeline-bars">
                  {timelineBars.map((filled, i) => (
                    <motion.div key={i} initial={{ opacity: 0.5, scaleY: 0.85 }} animate={{ opacity: 1, scaleY: 1 }} transition={{ delay: i * 0.005 }}
                      className={filled ? "timeline-bar filled" : "timeline-bar"} />
                  ))}
                </div>
              </div>
            </div>

            <div className="summary-cards">
              <SummaryCard title="Overall Progress" value={`${progressPercent}%`} subtext="Based on all 450 habit ticks" icon={Flame} />
              <SummaryCard title="Latest Weight" value={latestWeight} subtext="Most recent value entered" icon={Scale}
                extra={<>
                  <WeightSparkline rows={rows} />
                  {weightDelta && (
                    <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: weightDelta.lost ? "#4ade80" : "#f87171" }}>
                      {weightDelta.lost ? "▼" : "▲"} {Math.abs(Number(weightDelta.diff))} kg ({Math.abs(Number(weightDelta.pct))}% {weightDelta.lost ? "lost" : "gained"})
                    </div>
                  )}
                </>}
              />
              <SummaryCard title="Avg Calories / Steps" value={`${averageCalories} / ${averageSteps}`} subtext="Daily averages" icon={Target} />
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              {[
                { icon: Images, label: "Gallery", action: () => setShowGallery(true) },
                { icon: Layers, label: "Before/After", action: () => setShowBeforeAfter(true) },
                { icon: Bell, label: "Reminder", action: () => setShowNotifications(true) },
                { icon: Share2, label: "Day Card", action: () => setShowDailyCard(true) },
                { icon: Trophy, label: "Certificate", action: () => setShowCertificate(true) },
                { icon: Target, label: "Widget", action: () => setShowWidget(true) },
              ].map(({ icon: Icon, label, action }) => (
                <motion.button key={label} whileTap={{ scale: 0.95 }} onClick={action}
                  style={{ flex: "1 1 calc(33% - 6px)", minWidth: 80, background: "rgba(127,29,29,0.18)", border: "1px solid rgba(127,29,29,0.55)", borderRadius: 14, padding: "12px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: "pointer" }}>
                  <Icon style={{ width: 18, height: 18, color: "#fca5a5" }} />
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(252,165,165,0.75)" }}>{label}</span>
                </motion.button>
              ))}
            </div>

            {/* Strava */}
            {stravaToken ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, padding: "10px 14px", background: "rgba(252,76,2,0.1)", border: "1px solid rgba(252,76,2,0.3)", borderRadius: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 16 }}>⚡</span>
                  <div>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#fc4c02" }}>Strava Connected</p>
                    <p style={{ margin: 0, fontSize: 11, color: "rgba(252,165,165,0.5)" }}>{stravaToken.athlete?.firstname} {stravaToken.athlete?.lastname}</p>
                  </div>
                </div>
                <button onClick={handleStravaDisconnect} style={{ background: "transparent", border: "1px solid rgba(252,76,2,0.3)", borderRadius: 8, padding: "5px 10px", color: "rgba(252,165,165,0.5)", fontSize: 11, cursor: "pointer" }}>
                  Disconnect
                </button>
              </div>
            ) : (
              <StravaConnectBanner onConnect={handleStravaConnect} />
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, padding: "10px 14px", background: "rgba(127,29,29,0.1)", borderRadius: 12, border: "1px solid rgba(127,29,29,0.3)" }}>
              <span style={{ fontSize: 12, color: "rgba(252,165,165,0.6)", fontWeight: 600, letterSpacing: "0.06em" }}>
                {darkMode ? "🌙 Dark Mode" : "☀️ Light Mode"}
              </span>
              <button onClick={() => setDarkMode(!darkMode)}
                style={{ width: 44, height: 24, borderRadius: 12, background: darkMode ? "#dc2626" : "rgba(255,255,255,0.3)", border: "none", cursor: "pointer", position: "relative", transition: "background 0.25s" }}>
                <div style={{ position: "absolute", top: 3, left: darkMode ? 22 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.25s", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }} />
              </button>
            </div>
          </div>
        </motion.div>

        <div className="mobile-tip">Swipe sideways to use the full sheet</div>

        <div className="sheet-wrap">
          <div className="sheet-inner">
            <div className="sheet-banner">Discipline • Consistency • Power</div>
            <div className="sheet-grid header">
              <div className="sheet-cell head date-col">Date</div>
              <div className="sheet-cell head week-col">Week</div>
              <div className="sheet-cell head count-col">Countdown</div>
              {habitColumns.map((item) => { const Icon = item.icon; return (<div key={item.key} className="sheet-cell head icon-col head-icon-cell" title={item.label}><Icon className="head-icon" /></div>); })}
              <div className="sheet-cell head metric-col">Weight</div>
              <div className="sheet-cell head calories-col">Calories Burned</div>
              <div className="sheet-cell head metric-col">Steps</div>
              <div className="sheet-cell head metric-col">Sleep</div>
            </div>

            {weekGroups.map((group, groupIndex) => (
              <div key={group.weekNumber} className="sheet-grid">
                {group.rows.map((row, rowIndex) => {
                  const absoluteIndex = group.startIndex + rowIndex;
                  const isToday = absoluteIndex === todayIndex;
                  const isFuture = todayIndex >= 0 && absoluteIndex > todayIndex;
                  const zebra = groupIndex % 2 === 0 ? "zebra-a" : "zebra-b";
                  const rowDone = isRowComplete(row);
                  const rowLocked = row.locked || isFuture;
                  const rowIsActive = activeRow === absoluteIndex;
                  const rowTone = isFuture ? "future-row" : rowIsActive ? "active-row" : isToday ? "today-row" : rowDone ? "complete-row" : zebra;
                  const showLockButton = rowHasData(row) && !isFuture;

                  return (
                    <React.Fragment key={row.id}>
                      <DateCell
                        row={row}
                        isToday={isToday}
                        isFuture={isFuture}
                        rowTone={rowTone}
                        todayRef={isToday ? todayRowRef : undefined}
                      />

                      {rowIndex === 0 ? (
                        <div className="merged-week" style={{ gridRow: `span ${group.rows.length} / span ${group.rows.length}` }}>
                          <div className="vertical-week">{`Week ${group.weekNumber}`}</div>
                        </div>
                      ) : null}

                      <div className={`sheet-cell body count-col count-cell ${rowTone}`}>
                        {showLockButton ? (
                          <button type="button" onClick={() => toggleRowLock(absoluteIndex)} className={row.locked ? "lock-btn locked" : "lock-btn"}>
                            {row.locked ? <Lock className="lock-icon" /> : <LockOpen className="lock-icon" />}
                          </button>
                        ) : null}
                        <div className="count-text">{row.countdown}</div>
                        <AnimatePresence>
                          {rowDone ? (
                            <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ type: "spring", stiffness: 260, damping: 18 }} className="badge-row">DAY COMPLETE</motion.div>
                          ) : null}
                        </AnimatePresence>
                      </div>

                      {habitColumns.map((item) => (
                        <div key={item.key} className={`sheet-cell body icon-col ${rowTone}`}>
                          {item.key === "photo" ? (
                            <>
                              <input ref={(el) => { photoInputRefs.current[absoluteIndex] = el; }} type="file" accept="image/*" capture="environment" className="hidden-input" onChange={(e) => { handlePhotoUpload(absoluteIndex, e.target.files?.[0]); e.target.value = ""; }} />
                              <input ref={(el) => { galleryInputRefs.current[absoluteIndex] = el; }} type="file" accept="image/*" className="hidden-input" onChange={(e) => { handlePhotoUpload(absoluteIndex, e.target.files?.[0]); e.target.value = ""; }} />
                              <button type="button" onClick={() => { if (rowLocked) return; row.photoUrl ? setViewingPhotoIndex(absoluteIndex) : setPhotoSourceTarget(absoluteIndex); }} disabled={rowLocked} className={`photo-btn ${row.photo ? "has-photo" : ""} ${rowLocked ? "disabled" : ""}`}>
                                {row.photoUrl ? <img src={row.photoUrl} alt="" className="photo-thumb" /> : <ImagePlus className="photo-placeholder-icon" />}
                              </button>
                            </>
                          ) : (
                            <button type="button" onClick={() => {
                              if (rowLocked) return;
                              if (item.key === "workout1" || item.key === "workout2") {
                                setGarminDrawer({ date: row.date, dateLabel: row.dateLabel });
                                return;
                              }
                              handleHabitToggle(absoluteIndex, item.key);
                            }} disabled={rowLocked} className={`habit-btn ${row[item.key] ? "checked" : ""} ${rowLocked ? "disabled" : ""}`}>
                              {row[item.key] ? (
                                <motion.span initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: [0.5, 1.18, 1], opacity: 1 }} transition={{ duration: 0.28, ease: "easeOut" }}>✓</motion.span>
                              ) : null}
                            </button>
                          )}
                        </div>
                      ))}

                      <div className={`sheet-cell body metric-col metric-pad ${rowTone}`}>
                        <Input disabled={rowLocked} readOnly={rowLocked} onFocus={() => setActiveRow(absoluteIndex)} onBlur={() => setActiveRow((c) => (c === absoluteIndex ? null : c))} value={row.weight} onChange={(e) => updateRow(absoluteIndex, { weight: e.target.value })} placeholder="——" inputMode="decimal" className={rowLocked ? "disabled" : ""} />
                      </div>
                      <div className={`sheet-cell body calories-col metric-pad ${rowTone}`}>
                        <Input disabled={rowLocked} readOnly={rowLocked} onFocus={() => setActiveRow(absoluteIndex)} onBlur={() => setActiveRow((c) => (c === absoluteIndex ? null : c))} value={row.calories} onChange={(e) => updateRow(absoluteIndex, { calories: e.target.value })} placeholder="——" inputMode="numeric" className={rowLocked ? "disabled" : ""} />
                      </div>
                      <div className={`sheet-cell body metric-col metric-pad ${rowTone}`}>
                        <Input disabled={rowLocked} readOnly={rowLocked} onFocus={() => setActiveRow(absoluteIndex)} onBlur={() => setActiveRow((c) => (c === absoluteIndex ? null : c))} value={row.steps} onChange={(e) => updateRow(absoluteIndex, { steps: e.target.value })} placeholder="——" inputMode="numeric" className={rowLocked ? "disabled" : ""} />
                      </div>
                      {/* Sleep cell */}
                      <div className={`sheet-cell body metric-col ${rowTone}`} style={{ cursor: row.sleepData ? "pointer" : "default" }}
                        onClick={() => row.sleepData && setSleepPopup({ sleep: row.sleepData, dateLabel: row.dateLabel })}>
                        {row.sleepData ? (
                          <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: getSleepScoreColor(row.sleepData.score) }}>
                              {row.sleepData.score ?? "—"}
                            </div>
                            <div style={{ fontSize: 9, color: "rgba(252,165,165,0.45)", letterSpacing: "0.06em", marginTop: 2 }}>
                              {formatSleepDuration(row.sleepData.durationSeconds)}
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: "rgba(252,165,165,0.2)" }}>——</span>
                        )}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            ))}
            <div className="sheet-footer">Stay Relentless</div>
          </div>
        </div>
      </div>
    </div>
  );
}
