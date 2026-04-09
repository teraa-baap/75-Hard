import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  Dumbbell,
  Utensils,
  TreeDeciduous,
  BookOpen,
  Droplets,
  Flame,
  Scale,
  Target,
  ImagePlus,
  Lock,
  LockOpen,
  Trash2,
  Upload,
  X,
} from "lucide-react";

const TOTAL_DAYS = 75;
const STORAGE_KEY = "abhishek_75_hard_tracker_restored_v2";
const START_DATE = "2026-04-06";

const habitColumns = [
  { key: "photo", icon: Camera, label: "Progress Photo" },
  { key: "workout1", icon: Dumbbell, label: "Workout 1" },
  { key: "diet", icon: Utensils, label: "Diet" },
  { key: "workout2", icon: TreeDeciduous, label: "Outdoor Workout" },
  { key: "read", icon: BookOpen, label: "Read" },
  { key: "water", icon: Droplets, label: "Water" },
];

const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatDateLabel(date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  })
    .format(date)
    .replace(" ", "-");
}

function createRows(startDateString = START_DATE) {
  const start = new Date(`${startDateString}T00:00:00`);
  return Array.from({ length: TOTAL_DAYS }, (_, index) => {
    const current = new Date(start);
    current.setDate(start.getDate() + index);
    return {
      id: index + 1,
      date: current.toISOString().slice(0, 10),
      dateLabel: formatDateLabel(current),
      day: weekdayNames[current.getDay()],
      countdown: `Day ${index + 1}`,
      photo: false,
      photoUrl: "",
      workout1: false,
      diet: false,
      workout2: false,
      read: false,
      water: false,
      weight: "",
      calories: "",
      steps: "",
      locked: false,
    };
  });
}

function rowHasData(row) {
  return (
    habitColumns.some((item) => row[item.key]) ||
    Boolean(row.photoUrl) ||
    String(row.weight).trim() !== "" ||
    String(row.calories).trim() !== "" ||
    String(row.steps).trim() !== ""
  );
}

function isRowComplete(row) {
  return habitColumns.every((item) => row[item.key]);
}

function compressImage(file, maxSize = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas not supported"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

function SummaryCard({ title, value, subtext, icon: Icon }) {
  return (
    <div className="rounded-[28px] border border-red-900/70 bg-gradient-to-br from-black via-zinc-950/95 to-red-950/80 text-red-50 shadow-2xl shadow-red-950/30 backdrop-blur-xl">
      <div className="relative overflow-hidden p-5">
        <div className='pointer-events-none absolute inset-0 opacity-[0.08] [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.35)_1px,transparent_0)] [background-size:18px_18px]' />
        <div className='pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(127,29,29,0.15),transparent_40%,rgba(127,29,29,0.08))]' />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.32em] text-red-300/70">{title}</div>
            <div className="mt-2 text-3xl font-black tracking-tight text-white">{value}</div>
            <div className="mt-1 text-sm text-red-100/65">{subtext}</div>
          </div>
          <div className="rounded-2xl border border-red-800/70 bg-red-950/40 p-2.5 shadow-lg shadow-red-950/30 backdrop-blur-md">
            <Icon className="h-5 w-5 text-red-300" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ButtonBase({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold transition ${className}`}
    >
      {children}
    </button>
  );
}

function TextInput(props) {
  return (
    <input
      {...props}
      className={`h-9 w-full rounded-md border border-red-900/70 bg-black px-2 text-center text-red-50 placeholder:text-red-300/35 shadow-inner shadow-red-950/20 outline-none focus:ring-2 focus:ring-red-600 ${props.className || ""}`}
    />
  );
}

function WeeklySummaryModal({ open, onClose, summary }) {
  if (!summary) return null;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            transition={{ type: "spring", stiffness: 240, damping: 22 }}
            className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-red-800/70 bg-gradient-to-br from-black via-zinc-950 to-red-950 text-red-50 shadow-2xl shadow-red-950/40"
          >
            <div className='pointer-events-none absolute inset-0 opacity-[0.08] [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.4)_1px,transparent_0)] [background-size:18px_18px]' />
            <div className="relative border-b border-red-900/70 px-5 py-4">
              <button
                type="button"
                onClick={onClose}
                className="absolute right-4 top-4 rounded-full border border-red-800/70 bg-red-950/40 p-2 text-red-200 transition hover:bg-red-900/50 hover:text-white"
                aria-label="Close weekly summary"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="text-[10px] uppercase tracking-[0.35em] text-red-300/70">Weekly Summary</div>
              <h2 className="mt-2 text-2xl font-black tracking-[0.14em] text-white">
                WEEK {summary.weekNumber} COMPLETE
              </h2>
              <p className="mt-2 text-sm text-red-100/70">Strong finish. Here is your weekly discipline snapshot.</p>
            </div>

            <div className="relative grid gap-3 p-5 sm:grid-cols-3">
              <div className="rounded-2xl border border-red-900/70 bg-black/50 p-4 text-center backdrop-blur-md">
                <div className="text-[10px] uppercase tracking-[0.24em] text-red-300/70">Average Calories</div>
                <div className="mt-2 text-2xl font-black text-white">{summary.averageCalories}</div>
              </div>
              <div className="rounded-2xl border border-red-900/70 bg-black/50 p-4 text-center backdrop-blur-md">
                <div className="text-[10px] uppercase tracking-[0.24em] text-red-300/70">Average Steps</div>
                <div className="mt-2 text-2xl font-black text-white">{summary.averageSteps}</div>
              </div>
              <div className="rounded-2xl border border-red-900/70 bg-black/50 p-4 text-center backdrop-blur-md">
                <div className="text-[10px] uppercase tracking-[0.24em] text-red-300/70">Completion</div>
                <div className="mt-2 text-2xl font-black text-white">{summary.completionRate}%</div>
              </div>
            </div>

            <div className="relative px-5 pb-5">
              <ButtonBase
                className="w-full border border-red-700 bg-red-700 text-white hover:bg-red-600"
                onClick={onClose}
              >
                Keep Going
              </ButtonBase>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function PhotoViewerModal({ open, row, onClose, onReplace, onRemove }) {
  if (!row?.photoUrl) return null;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 12 }}
            transition={{ type: "spring", stiffness: 240, damping: 22 }}
            className="relative w-full max-w-3xl overflow-hidden rounded-[28px] border border-red-800/70 bg-gradient-to-br from-black via-zinc-950 to-red-950 text-red-50 shadow-2xl shadow-red-950/40"
          >
            <div className='pointer-events-none absolute inset-0 opacity-[0.08] [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.4)_1px,transparent_0)] [background-size:18px_18px]' />
            <div className="relative flex items-center justify-between border-b border-red-900/70 px-5 py-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.35em] text-red-300/70">Progress Photo</div>
                <div className="mt-1 text-lg font-black tracking-[0.14em] text-white">{row.countdown}</div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-red-800/70 bg-red-950/40 p-2 text-red-200 transition hover:bg-red-900/50 hover:text-white"
                aria-label="Close photo viewer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative p-4 sm:p-5">
              <div className="overflow-hidden rounded-[24px] border border-red-900/70 bg-black/70">
                <img src={row.photoUrl} alt={`${row.countdown} progress`} className="max-h-[70vh] w-full object-contain" />
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <ButtonBase
                  className="flex-1 border border-red-700 bg-red-700 text-white hover:bg-red-600"
                  onClick={onReplace}
                >
                  <Upload className="mr-2 h-4 w-4" /> Replace Photo
                </ButtonBase>
                <ButtonBase
                  className="flex-1 border border-red-800 bg-transparent text-red-50 hover:bg-red-950/40"
                  onClick={onRemove}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Remove Photo
                </ButtonBase>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function SheetCell({ children, className = "", tone = "body" }) {
  const toneClasses = {
    header: "bg-gradient-to-b from-red-950 via-black to-black text-red-50",
    body: "bg-black text-red-50",
    footer: "bg-gradient-to-r from-black via-red-950 to-black text-red-100",
  };

  return (
    <div className={`border-r border-b border-red-950/80 px-2 ${toneClasses[tone]} ${className}`}>
      {children}
    </div>
  );
}

export default function App() {
  const [rows, setRows] = useState(() => createRows());
  const [loaded, setLoaded] = useState(false);
  const [activeRow, setActiveRow] = useState(null);
  const [weeklySummary, setWeeklySummary] = useState(null);
  const [isWeeklySummaryOpen, setIsWeeklySummaryOpen] = useState(false);
  const [photoViewerRowIndex, setPhotoViewerRowIndex] = useState(null);

  const photoInputRefs = useRef({});
  const todayRowRef = useRef(null);
  const openedWeekSummariesRef = useRef(new Set());
  const audioContextRef = useRef(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === TOTAL_DAYS) {
          setRows(parsed);
        }
      }
    } catch (error) {
      console.error("Could not load tracker data", error);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    } catch (error) {
      console.error("Could not save tracker data", error);
      window.alert("Storage is full. Large photos may not save properly. Try replacing some photos with smaller ones.");
    }
  }, [rows, loaded]);

  const todayIndex = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return rows.findIndex((row) => row.date === today);
  }, [rows]);

  useEffect(() => {
    if (!loaded || !todayRowRef.current) return;
    const timer = window.setTimeout(() => {
      todayRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [loaded]);

  const triggerFeedback = () => {
    try {
      if (navigator?.vibrate) navigator.vibrate(18);
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!audioContextRef.current) audioContextRef.current = new AudioContextClass();
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") ctx.resume();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(900, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1250, ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.03, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.085);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.09);
    } catch (error) {
      console.error("Feedback trigger failed", error);
    }
  };

  const updateRow = (index, patch) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const handleHabitToggle = (absoluteIndex, key) => {
    if (rows[absoluteIndex].locked) return;
    setActiveRow(absoluteIndex);
    triggerFeedback();
    updateRow(absoluteIndex, { [key]: !rows[absoluteIndex][key] });
  };

  const handlePhotoUpload = async (absoluteIndex, file) => {
    if (rows[absoluteIndex].locked || !file) return;
    try {
      const compressedImage = await compressImage(file);
      setActiveRow(absoluteIndex);
      updateRow(absoluteIndex, { photoUrl: compressedImage, photo: true });
      triggerFeedback();
    } catch (error) {
      console.error("Photo upload failed", error);
      window.alert("Photo upload failed. Please try another image.");
    }
  };

  const toggleRowLock = (absoluteIndex) => {
    if (!rowHasData(rows[absoluteIndex])) return;
    triggerFeedback();
    updateRow(absoluteIndex, { locked: !rows[absoluteIndex].locked });
  };

  const openPhotoViewer = (absoluteIndex) => {
    if (!rows[absoluteIndex]?.photoUrl) return;
    setPhotoViewerRowIndex(absoluteIndex);
  };

  const closePhotoViewer = () => {
    setPhotoViewerRowIndex(null);
  };

  const replacePhoto = () => {
    if (photoViewerRowIndex == null) return;
    closePhotoViewer();
    photoInputRefs.current[photoViewerRowIndex]?.click();
  };

  const removePhoto = () => {
    if (photoViewerRowIndex == null) return;
    const idx = photoViewerRowIndex;
    const row = rows[idx];
    const nextRow = { ...row, photoUrl: "", photo: false };
    setRows((prev) => {
      const next = [...prev];
      next[idx] = nextRow;
      if (!rowHasData(nextRow)) next[idx].locked = false;
      return next;
    });
    closePhotoViewer();
  };

  const totalChecks = useMemo(
    () => rows.reduce((sum, row) => sum + habitColumns.reduce((inner, item) => inner + (row[item.key] ? 1 : 0), 0), 0),
    [rows]
  );

  const completedDays = useMemo(() => rows.filter((row) => isRowComplete(row)).length, [rows]);

  const progressPercent = Math.round((totalChecks / (TOTAL_DAYS * habitColumns.length)) * 100);

  const latestWeight = useMemo(() => {
    const match = [...rows].reverse().find((row) => String(row.weight).trim());
    return match ? match.weight : "—";
  }, [rows]);

  const averageCalories = useMemo(() => {
    const values = rows
      .map((row) => Number(String(row.calories).replace(/,/g, "")))
      .filter((value) => Number.isFinite(value) && value > 0);
    return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length).toLocaleString() : "—";
  }, [rows]);

  const averageSteps = useMemo(() => {
    const values = rows
      .map((row) => Number(String(row.steps).replace(/,/g, "")))
      .filter((value) => Number.isFinite(value) && value > 0);
    return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length).toLocaleString() : "—";
  }, [rows]);

  const timelineBars = Array.from({ length: TOTAL_DAYS }, (_, index) => index < completedDays);

  const weekGroups = Array.from({ length: Math.ceil(TOTAL_DAYS / 7) }, (_, index) => ({
    weekNumber: index + 1,
    rows: rows.slice(index * 7, index * 7 + 7),
    startIndex: index * 7,
  }));

  useEffect(() => {
    weekGroups.forEach((group) => {
      const complete = group.rows.every((row) => isRowComplete(row));
      if (!complete || openedWeekSummariesRef.current.has(group.weekNumber)) return;

      const calories = group.rows
        .map((row) => Number(String(row.calories).replace(/,/g, "")))
        .filter((value) => Number.isFinite(value) && value > 0);

      const steps = group.rows
        .map((row) => Number(String(row.steps).replace(/,/g, "")))
        .filter((value) => Number.isFinite(value) && value > 0);

      const checksDone = group.rows.reduce(
        (sum, row) => sum + habitColumns.reduce((inner, item) => inner + (row[item.key] ? 1 : 0), 0),
        0
      );

      const completionRate = Math.round((checksDone / (group.rows.length * habitColumns.length)) * 100);

      openedWeekSummariesRef.current.add(group.weekNumber);
      setWeeklySummary({
        weekNumber: group.weekNumber,
        averageCalories: calories.length
          ? Math.round(calories.reduce((a, b) => a + b, 0) / calories.length).toLocaleString()
          : "—",
        averageSteps: steps.length
          ? Math.round(steps.reduce((a, b) => a + b, 0) / steps.length).toLocaleString()
          : "—",
        completionRate,
      });
      setIsWeeklySummaryOpen(true);
    });
  }, [rows]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-red-50">
      <div className='pointer-events-none absolute inset-0 opacity-[0.055] [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.55)_1px,transparent_0)] [background-size:18px_18px]' />
      <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(127,29,29,0.24),transparent_38%),radial-gradient(circle_at_bottom,rgba(69,10,10,0.28),transparent_42%)]' />

      <WeeklySummaryModal
        open={isWeeklySummaryOpen}
        onClose={() => setIsWeeklySummaryOpen(false)}
        summary={weeklySummary}
      />

      <PhotoViewerModal
        open={photoViewerRowIndex != null}
        row={photoViewerRowIndex != null ? rows[photoViewerRowIndex] : null}
        onClose={closePhotoViewer}
        onReplace={replacePhoto}
        onRemove={removePhoto}
      />

      <div className="relative mx-auto max-w-[1900px] px-3 py-4 sm:px-4 lg:px-6">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-[30px] border border-red-900/70 bg-gradient-to-br from-black via-zinc-950 to-red-950 shadow-2xl shadow-red-950/30"
        >
          <div className="border-b border-red-900/70 px-4 py-5 sm:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-red-800/70 bg-red-950/40 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.35em] text-red-300">
                  <Flame className="h-4 w-4" /> Discipline • Consistency • Power
                </div>
                <h1 className="text-2xl font-black tracking-[0.18em] text-white sm:text-4xl">75 HARD TRACKER</h1>
              </div>
            </div>
          </div>

          <div className="border-y border-red-900/60 bg-black/20 px-4 py-4 backdrop-blur-[2px] sm:px-6">
            <div className="mb-4 rounded-[24px] border border-red-900/70 bg-gradient-to-r from-black via-red-950/50 to-black p-4 shadow-xl shadow-red-950/20 backdrop-blur-md">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.34em] text-red-300/70">Challenge Timeline</div>
                  <div className="mt-2 text-xl font-black tracking-[0.16em] text-white">
                    Day {Math.min(Math.max(completedDays + 1, 1), TOTAL_DAYS)} / {TOTAL_DAYS}
                  </div>
                </div>

                <div className="grid flex-1 grid-cols-15 gap-1.5 lg:ml-6">
                  {timelineBars.map((filled, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0.5, scaleY: 0.85 }}
                      animate={{ opacity: 1, scaleY: 1 }}
                      transition={{ delay: index * 0.005 }}
                      className={`h-3 rounded-full border ${
                        filled
                          ? "border-red-400/80 bg-gradient-to-r from-red-700 to-red-500 shadow-[0_0_10px_rgba(220,38,38,0.35)]"
                          : "border-red-950/70 bg-black"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard title="Completed Days" value={completedDays} subtext="All habit boxes finished" icon={Target} />
              <SummaryCard title="Overall Progress" value={`${progressPercent}%`} subtext="Based on all 450 habit ticks" icon={Flame} />
              <SummaryCard title="Latest Weight" value={latestWeight} subtext="Most recent value entered" icon={Scale} />
              <SummaryCard title="Average Metrics" value={`${averageCalories} / ${averageSteps}`} subtext="Calories / Steps" icon={Target} />
            </div>
          </div>
        </motion.div>

        <div className="mt-4 mb-3 text-xs uppercase tracking-[0.22em] text-red-300/60 sm:hidden">
          Swipe sideways to use the full sheet
        </div>

        <div className="overflow-auto rounded-[30px] border border-red-900/70 bg-black/90 shadow-2xl shadow-red-950/25 backdrop-blur-md">
          <div className="w-fit min-w-fit">
            <div className="border-b border-red-900/70 bg-gradient-to-r from-black via-red-950 to-black px-4 py-3 text-center text-[15px] font-black uppercase tracking-[0.42em] text-red-50">
              Discipline • Consistency • Power
            </div>

            <div className="grid grid-cols-[86px_110px_92px_108px_repeat(6,50px)_110px_150px_110px] border-b border-red-900/70 text-[13px] font-black">
              <SheetCell tone="header" className="flex h-11 items-center justify-center">Date</SheetCell>
              <SheetCell tone="header" className="flex h-11 items-center justify-center">Day</SheetCell>
              <SheetCell tone="header" className="flex h-11 items-center justify-center">Week</SheetCell>
              <SheetCell tone="header" className="flex h-11 items-center justify-center">Countdown</SheetCell>

              {habitColumns.map((item) => {
                const Icon = item.icon;
                return (
                  <SheetCell
                    key={item.key}
                    tone="header"
                    className="group flex h-11 items-center justify-center transition-all duration-300 hover:bg-red-950/50 hover:shadow-[inset_0_0_18px_rgba(127,29,29,0.55)]"
                  >
                    <span className="sr-only">{item.label}</span>
                    <Icon className="h-4 w-4 text-red-300 transition-all duration-300 group-hover:scale-110 group-hover:text-red-100 group-hover:drop-shadow-[0_0_12px_rgba(252,165,165,0.95)]" />
                  </SheetCell>
                );
              })}

              <SheetCell tone="header" className="flex h-11 items-center justify-center">Weight</SheetCell>
              <SheetCell tone="header" className="flex h-11 items-center justify-center">Calories Burned</SheetCell>
              <SheetCell tone="header" className="flex h-11 items-center justify-center">Steps</SheetCell>
            </div>

            {weekGroups.map((group, groupIndex) => (
              <div key={group.weekNumber} className="grid grid-cols-[86px_110px_92px_108px_repeat(6,50px)_110px_150px_110px]">
                {group.rows.map((row, rowIndex) => {
                  const absoluteIndex = group.startIndex + rowIndex;
                  const zebra = groupIndex % 2 === 0 ? "bg-black" : "bg-red-950/20";
                  const rowIsActive = activeRow === absoluteIndex;
                  const rowDone = isRowComplete(row);
                  const rowTone = rowIsActive
                    ? "bg-red-950/40 shadow-[inset_0_0_0_1px_rgba(248,113,113,0.5),inset_0_0_22px_rgba(127,29,29,0.28)]"
                    : rowDone
                      ? "bg-red-950/30 shadow-[inset_0_0_0_1px_rgba(248,113,113,0.22),inset_0_0_28px_rgba(185,28,28,0.22)]"
                      : zebra;

                  const rowRef = absoluteIndex === todayIndex ? todayRowRef : null;
                  const rowLocked = row.locked;
                  const showLockButton = rowHasData(row);

                  return (
                    <React.Fragment key={row.id}>
                      <SheetCell className={`flex h-14 items-center justify-center text-[13px] font-semibold transition-all duration-200 ${rowTone}`}>
                        <div ref={rowRef}>{row.dateLabel}</div>
                      </SheetCell>

                      <SheetCell className={`flex h-14 items-center justify-center text-[13px] font-semibold transition-all duration-200 ${rowTone}`}>
                        {row.day}
                      </SheetCell>

                      {rowIndex === 0 ? (
                        <div
                          className="row-span-7 flex min-h-[392px] items-center justify-center border-r border-b border-red-900/70 bg-gradient-to-b from-red-950 via-black to-black"
                          style={{ gridRow: `span ${group.rows.length} / span ${group.rows.length}` }}
                        >
                          <div
                            className="text-center text-[13px] font-black uppercase tracking-[0.2em] text-red-50"
                            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                          >
                            {`Week ${group.weekNumber}`}
                          </div>
                        </div>
                      ) : null}

                      <SheetCell className={`relative flex h-14 flex-col items-center justify-center pt-2 text-[13px] font-semibold transition-all duration-200 ${rowTone}`}>
                        {showLockButton ? (
                          <button
                            type="button"
                            onClick={() => toggleRowLock(absoluteIndex)}
                            className={`absolute right-2 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full border transition-all duration-200 ${
                              rowLocked
                                ? "border-red-300 bg-red-600/25 text-red-50 shadow-[0_0_10px_rgba(220,38,38,0.25)]"
                                : "border-red-800 bg-black/70 text-red-200 hover:border-red-500 hover:bg-red-950/40"
                            }`}
                            aria-label={rowLocked ? `Unlock ${row.countdown}` : `Lock ${row.countdown}`}
                          >
                            {rowLocked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
                          </button>
                        ) : null}

                        <div className="leading-tight">{row.countdown}</div>

                        <AnimatePresence>
                          {rowLocked ? (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.92 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.96 }}
                              transition={{ type: "spring", stiffness: 260, damping: 18 }}
                              className="mt-1 rounded-full border border-red-400/35 bg-black/70 px-2 py-[2px] text-center text-[9px] font-black uppercase tracking-[0.18em] text-red-100 shadow-[0_0_10px_rgba(220,38,38,0.2)]"
                            >
                              LOCKED
                            </motion.div>
                          ) : rowDone ? (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.92 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.96 }}
                              transition={{ type: "spring", stiffness: 260, damping: 18 }}
                              className="mt-1 rounded-full border border-red-500/40 bg-red-600/20 px-2 py-[2px] text-center text-[9px] font-black uppercase tracking-[0.18em] text-red-100 shadow-[0_0_12px_rgba(220,38,38,0.25)]"
                            >
                              DAY COMPLETE
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </SheetCell>

                      {habitColumns.map((item) => (
                        <SheetCell key={item.key} className={`relative flex h-14 items-center justify-center transition-all duration-200 ${rowTone}`}>
                          {item.key === "photo" ? (
                            <>
                              <input
                                ref={(el) => {
                                  if (el) photoInputRefs.current[absoluteIndex] = el;
                                }}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  handlePhotoUpload(absoluteIndex, file);
                                  e.target.value = "";
                                }}
                              />

                              <button
                                type="button"
                                onClick={() => {
                                  if (row.photoUrl) {
                                    openPhotoViewer(absoluteIndex);
                                  } else {
                                    const useCamera = window.confirm("Use Camera?\nPress Cancel for Gallery");

                                    const input = photoInputRefs.current[absoluteIndex];

                                    if (input) {
                                      if (useCamera) {
                                        input.setAttribute("capture", "environment");
                                      } else {
                                        input.removeAttribute("capture");
                                      }
                                      input.click();
                                    }
                                  }
                                }}
                                disabled={rowLocked}
                                className={`group relative flex h-8 w-8 items-center justify-center rounded-xl border transition-all duration-300 ${
                                  rowLocked ? "cursor-not-allowed opacity-55" : ""
                                } ${
                                  row.photo
                                    ? "border-red-300 bg-red-600/20 text-white shadow-[0_0_18px_rgba(220,38,38,0.28)]"
                                    : "border-red-800 bg-transparent text-red-200 hover:border-red-500 hover:bg-red-950/30"
                                }`}
                                aria-label={row.photoUrl ? `View photo for ${row.countdown}` : `Upload photo for ${row.countdown}`}
                              >
                                {row.photoUrl ? (
                                  <img src={row.photoUrl} alt={`Progress ${row.countdown}`} className="h-full w-full rounded-[10px] object-cover" />
                                ) : (
                                  <ImagePlus className="h-4 w-4 transition-all duration-300 group-hover:scale-110 group-hover:drop-shadow-[0_0_10px_rgba(248,113,113,0.85)]" />
                                )}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleHabitToggle(absoluteIndex, item.key)}
                              disabled={rowLocked}
                              className={`flex h-5 w-5 items-center justify-center border text-[12px] font-black transition-all duration-200 ${
                                rowLocked ? "cursor-not-allowed opacity-55" : ""
                              } ${
                                row[item.key]
                                  ? "border-red-200 bg-red-600 text-white shadow-[0_0_14px_rgba(220,38,38,0.35)]"
                                  : "border-red-800 bg-transparent text-red-200 hover:border-red-500 hover:bg-red-950/30"
                              }`}
                              aria-label={`${item.label} ${row.countdown}`}
                            >
                              {row[item.key] ? (
                                <motion.span
                                  initial={{ scale: 0.5, opacity: 0 }}
                                  animate={{ scale: [0.5, 1.18, 1], opacity: 1 }}
                                  transition={{ duration: 0.28, ease: "easeOut" }}
                                >
                                  ✓
                                </motion.span>
                              ) : null}
                            </button>
                          )}
                        </SheetCell>
                      ))}

                      <SheetCell className={`flex h-14 items-center justify-center p-2 transition-all duration-200 ${rowTone}`}>
                        <TextInput
                          disabled={rowLocked}
                          readOnly={rowLocked}
                          onFocus={() => setActiveRow(absoluteIndex)}
                          onBlur={() => setActiveRow((current) => (current === absoluteIndex ? null : current))}
                          value={row.weight}
                          onChange={(e) => updateRow(absoluteIndex, { weight: e.target.value })}
                          placeholder="______"
                          inputMode="decimal"
                          className={rowLocked ? "cursor-not-allowed opacity-55" : ""}
                        />
                      </SheetCell>

                      <SheetCell className={`flex h-14 items-center justify-center p-2 transition-all duration-200 ${rowTone}`}>
                        <TextInput
                          disabled={rowLocked}
                          readOnly={rowLocked}
                          onFocus={() => setActiveRow(absoluteIndex)}
                          onBlur={() => setActiveRow((current) => (current === absoluteIndex ? null : current))}
                          value={row.calories}
                          onChange={(e) => updateRow(absoluteIndex, { calories: e.target.value })}
                          placeholder="______"
                          inputMode="numeric"
                          className={rowLocked ? "cursor-not-allowed opacity-55" : ""}
                        />
                      </SheetCell>

                      <SheetCell className={`flex h-14 items-center justify-center p-2 transition-all duration-200 ${rowTone}`}>
                        <TextInput
                          disabled={rowLocked}
                          readOnly={rowLocked}
                          onFocus={() => setActiveRow(absoluteIndex)}
                          onBlur={() => setActiveRow((current) => (current === absoluteIndex ? null : current))}
                          value={row.steps}
                          onChange={(e) => updateRow(absoluteIndex, { steps: e.target.value })}
                          placeholder="______"
                          inputMode="numeric"
                          className={rowLocked ? "cursor-not-allowed opacity-55" : ""}
                        />
                      </SheetCell>
                    </React.Fragment>
                  );
                })}
              </div>
            ))}

            <div className="border-t border-red-900/70 bg-gradient-to-r from-black via-red-950 to-black px-4 py-3 text-center text-[12px] font-black uppercase tracking-[0.55em] text-red-200">
              Stay Relentless
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
