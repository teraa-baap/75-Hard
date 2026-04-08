
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
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const TOTAL_DAYS = 75;
const STORAGE_KEY = "premium_75_hard_tracker_pwa_v1";
const START_DATE = "2026-04-06";

const habitColumns = [
  { key: "photo", icon: Camera, label: "Progress Photo" },
  { key: "workout1", icon: Dumbbell, label: "Workout 1" },
  { key: "diet", icon: Utensils, label: "Diet" },
  { key: "workout2", icon: TreeDeciduous, label: "Outdoor Workout" },
  { key: "read", icon: BookOpen, label: "Read" },
  { key: "water", icon: Droplets, label: "Water" },
] as const;

const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type HabitKey = (typeof habitColumns)[number]["key"];

type TrackerRow = {
  id: number;
  date: string;
  dateLabel: string;
  day: string;
  countdown: string;
  photo: boolean;
  photoUrl: string;
  workout1: boolean;
  diet: boolean;
  workout2: boolean;
  read: boolean;
  water: boolean;
  weight: string;
  calories: string;
  steps: string;
  locked: boolean;
};

function formatDateLabel(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(date).replace(" ", "-");
}

function createRows(startDateString = START_DATE): TrackerRow[] {
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

function rowHasData(row: TrackerRow) {
  return (
    habitColumns.some((item) => row[item.key]) ||
    Boolean(row.photoUrl) ||
    row.weight.trim() !== "" ||
    row.calories.trim() !== "" ||
    row.steps.trim() !== ""
  );
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

function SummaryCard({
  title,
  value,
  subtext,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  subtext: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="summary-card">
      <CardContent className="summary-card-content">
        <div className="summary-grid">
          <div>
            <div className="summary-title">{title}</div>
            <div className="summary-value">{value}</div>
            <div className="summary-subtext">{subtext}</div>
          </div>
          <div className="summary-icon-wrap">
            <Icon className="summary-icon" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function WeeklySummaryModal({
  open,
  onClose,
  summary,
}: {
  open: boolean;
  onClose: () => void;
  summary: null | { weekNumber: number; averageCalories: string; averageSteps: string; completionRate: number };
}) {
  if (!summary) return null;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div
            className="modal-card"
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            transition={{ type: "spring", stiffness: 240, damping: 22 }}
          >
            <div className="modal-header">
              <button type="button" className="icon-close-btn" onClick={onClose} aria-label="Close weekly summary">
                <X className="mini-icon" />
              </button>
              <div className="mini-label">Weekly Summary</div>
              <h2 className="modal-title">WEEK {summary.weekNumber} COMPLETE</h2>
              <p className="modal-copy">Strong finish. Here is your weekly discipline snapshot.</p>
            </div>
            <div className="modal-stats">
              <div className="modal-stat">
                <div className="mini-label">Average Calories</div>
                <div className="modal-stat-value">{summary.averageCalories}</div>
              </div>
              <div className="modal-stat">
                <div className="mini-label">Average Steps</div>
                <div className="modal-stat-value">{summary.averageSteps}</div>
              </div>
              <div className="modal-stat">
                <div className="mini-label">Completion</div>
                <div className="modal-stat-value">{summary.completionRate}%</div>
              </div>
            </div>
            <div className="modal-footer">
              <Button className="w-full" onClick={onClose}>Keep Going</Button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default function App() {
  const [rows, setRows] = useState<TrackerRow[]>(() => createRows());
  const [loaded, setLoaded] = useState(false);
  const [activeRow, setActiveRow] = useState<number | null>(null);
  const [weeklySummary, setWeeklySummary] = useState<null | {
    weekNumber: number;
    averageCalories: string;
    averageSteps: string;
    completionRate: number;
  }>(null);
  const [isWeeklySummaryOpen, setIsWeeklySummaryOpen] = useState(false);

  const photoInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const todayRowRef = useRef<HTMLDivElement | null>(null);
  const openedWeekSummariesRef = useRef<Set<number>>(new Set());
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === TOTAL_DAYS) setRows(parsed);
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

  useEffect(() => {
    if (!loaded || !todayRowRef.current) return;
    const timer = window.setTimeout(() => {
      todayRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [loaded]);

  const triggerFeedback = () => {
    try {
      if (navigator.vibrate) navigator.vibrate(18);
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
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

  const updateRow = (index: number, patch: Partial<TrackerRow>) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const handleHabitToggle = (absoluteIndex: number, key: HabitKey) => {
    if (rows[absoluteIndex].locked) return;
    setActiveRow(absoluteIndex);
    triggerFeedback();
    updateRow(absoluteIndex, { [key]: !rows[absoluteIndex][key] } as Partial<TrackerRow>);
  };

  const handlePhotoUpload = async (absoluteIndex: number, file?: File | null) => {
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

  const toggleRowLock = (absoluteIndex: number) => {
    if (!rowHasData(rows[absoluteIndex])) return;
    triggerFeedback();
    updateRow(absoluteIndex, { locked: !rows[absoluteIndex].locked });
  };

  const todayIndex = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return rows.findIndex((row) => row.date === today);
  }, [rows]);

  const totalChecks = useMemo(
    () => rows.reduce((sum, row) => sum + habitColumns.reduce((inner, item) => inner + (row[item.key] ? 1 : 0), 0), 0),
    [rows]
  );

  const completedDays = useMemo(() => rows.filter((row) => isRowComplete(row)).length, [rows]);
  const progressPercent = Math.round((totalChecks / (TOTAL_DAYS * habitColumns.length)) * 100);

  const latestWeight = useMemo(() => {
    const match = [...rows].reverse().find((row) => row.weight.trim());
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
      const allComplete = group.rows.every((row) => isRowComplete(row));
      if (!allComplete || openedWeekSummariesRef.current.has(group.weekNumber)) return;

      const calories = group.rows.map((row) => Number(row.calories.replace(/,/g, ""))).filter((n) => Number.isFinite(n) && n > 0);
      const steps = group.rows.map((row) => Number(row.steps.replace(/,/g, ""))).filter((n) => Number.isFinite(n) && n > 0);
      const checksDone = group.rows.reduce(
        (sum, row) => sum + habitColumns.reduce((inner, item) => inner + (row[item.key] ? 1 : 0), 0),
        0
      );
      const completionRate = Math.round((checksDone / (group.rows.length * habitColumns.length)) * 100);

      openedWeekSummariesRef.current.add(group.weekNumber);
      setWeeklySummary({
        weekNumber: group.weekNumber,
        averageCalories: calories.length ? Math.round(calories.reduce((a, b) => a + b, 0) / calories.length).toLocaleString() : "—",
        averageSteps: steps.length ? Math.round(steps.reduce((a, b) => a + b, 0) / steps.length).toLocaleString() : "—",
        completionRate,
      });
      setIsWeeklySummaryOpen(true);
    });
  }, [rows]);

  return (
    <div className="app-shell">
      <div className="background-noise" />
      <div className="background-glow" />

      <WeeklySummaryModal open={isWeeklySummaryOpen} onClose={() => setIsWeeklySummaryOpen(false)} summary={weeklySummary} />

      <div className="page">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="hero-card">
          <div className="hero-header">
            <div className="pill">
              <Flame className="mini-icon" /> Discipline • Consistency • Power
            </div>
            <h1 className="hero-title">75 HARD TRACKER</h1>
          </div>

          <div className="hero-body">
            <div className="timeline-card">
              <div className="timeline-row">
                <div>
                  <div className="mini-label">Challenge Timeline</div>
                  <div className="timeline-day">Day {Math.min(Math.max(completedDays + 1, 1), TOTAL_DAYS)} / {TOTAL_DAYS}</div>
                </div>
                <div className="timeline-bars">
                  {timelineBars.map((filled, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0.5, scaleY: 0.85 }}
                      animate={{ opacity: 1, scaleY: 1 }}
                      transition={{ delay: index * 0.005 }}
                      className={filled ? "timeline-bar filled" : "timeline-bar"}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="summary-cards">
              <SummaryCard title="Completed Days" value={completedDays} subtext="All habit boxes finished" icon={Target} />
              <SummaryCard title="Overall Progress" value={`${progressPercent}%`} subtext="Based on all 450 habit ticks" icon={Flame} />
              <SummaryCard title="Latest Weight" value={latestWeight} subtext="Most recent value entered" icon={Scale} />
              <SummaryCard title="Average Metrics" value={`${averageCalories} / ${averageSteps}`} subtext="Calories / Steps" icon={Target} />
            </div>
          </div>
        </motion.div>

        <div className="mobile-tip">Swipe sideways to use the full sheet</div>

        <div className="sheet-wrap">
          <div className="sheet-inner">
            <div className="sheet-banner">Discipline • Consistency • Power</div>

            <div className="sheet-grid header">
              <div className="sheet-cell head date-col">Date</div>
              <div className="sheet-cell head day-col">Day</div>
              <div className="sheet-cell head week-col">Week</div>
              <div className="sheet-cell head count-col">Countdown</div>
              {habitColumns.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.key} className="sheet-cell head icon-col head-icon-cell" title={item.label}>
                    <Icon className="head-icon" />
                  </div>
                );
              })}
              <div className="sheet-cell head metric-col">Weight</div>
              <div className="sheet-cell head calories-col">Calories Burned</div>
              <div className="sheet-cell head metric-col">Steps</div>
            </div>

            {weekGroups.map((group, groupIndex) => (
              <div key={group.weekNumber} className="sheet-grid">
                {group.rows.map((row, rowIndex) => {
                  const absoluteIndex = group.startIndex + rowIndex;
                  const zebra = groupIndex % 2 === 0 ? "zebra-a" : "zebra-b";
                  const rowDone = isRowComplete(row);
                  const rowLocked = row.locked;
                  const rowIsActive = activeRow === absoluteIndex;
                  const rowTone = rowIsActive ? "active-row" : rowDone ? "complete-row" : zebra;
                  const showLockButton = rowHasData(row);

                  return (
                    <React.Fragment key={row.id}>
                      <div className={`sheet-cell body date-col ${rowTone}`}>
                        <div ref={absoluteIndex === todayIndex ? todayRowRef : undefined}>{row.dateLabel}</div>
                      </div>

                      <div className={`sheet-cell body day-col ${rowTone}`}>{row.day}</div>

                      {rowIndex === 0 ? (
                        <div className="merged-week" style={{ gridRow: `span ${group.rows.length} / span ${group.rows.length}` }}>
                          <div className="vertical-week">{`Week ${group.weekNumber}`}</div>
                        </div>
                      ) : null}

                      <div className={`sheet-cell body count-col count-cell ${rowTone}`}>
                        {showLockButton ? (
                          <button
                            type="button"
                            onClick={() => toggleRowLock(absoluteIndex)}
                            className={rowLocked ? "lock-btn locked" : "lock-btn"}
                            aria-label={rowLocked ? `Unlock ${row.countdown}` : `Lock ${row.countdown}`}
                          >
                            {rowLocked ? <Lock className="lock-icon" /> : <LockOpen className="lock-icon" />}
                          </button>
                        ) : null}

                        <div className="count-text">{row.countdown}</div>

                        <AnimatePresence>
                          {rowLocked ? (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.92 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.96 }}
                              transition={{ type: "spring", stiffness: 260, damping: 18 }}
                              className="badge-row muted"
                            >
                              LOCKED
                            </motion.div>
                          ) : rowDone ? (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.92 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.96 }}
                              transition={{ type: "spring", stiffness: 260, damping: 18 }}
                              className="badge-row"
                            >
                              DAY COMPLETE
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </div>

                      {habitColumns.map((item) => (
                        <div key={item.key} className={`sheet-cell body icon-col ${rowTone}`}>
                          {item.key === "photo" ? (
                            <>
                              <input
                                ref={(el) => {
                                  photoInputRefs.current[absoluteIndex] = el;
                                }}
                                type="file"
                                accept="image/*"
                                className="hidden-input"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  handlePhotoUpload(absoluteIndex, file);
                                  e.target.value = "";
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => photoInputRefs.current[absoluteIndex]?.click()}
                                disabled={rowLocked}
                                className={`photo-btn ${row.photo ? "has-photo" : ""} ${rowLocked ? "disabled" : ""}`}
                                aria-label={`Upload photo for ${row.countdown}`}
                              >
                                {row.photoUrl ? (
                                  <img src={row.photoUrl} alt={`Progress ${row.countdown}`} className="photo-thumb" />
                                ) : (
                                  <ImagePlus className="photo-placeholder-icon" />
                                )}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleHabitToggle(absoluteIndex, item.key)}
                              disabled={rowLocked}
                              className={`habit-btn ${row[item.key] ? "checked" : ""} ${rowLocked ? "disabled" : ""}`}
                              aria-label={`${item.label} ${row.countdown}`}
                            >
                              {row[item.key] ? (
                                <motion.span initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: [0.5, 1.18, 1], opacity: 1 }} transition={{ duration: 0.28, ease: "easeOut" }}>
                                  ✓
                                </motion.span>
                              ) : null}
                            </button>
                          )}
                        </div>
                      ))}

                      <div className={`sheet-cell body metric-col metric-pad ${rowTone}`}>
                        <Input
                          disabled={rowLocked}
                          readOnly={rowLocked}
                          onFocus={() => setActiveRow(absoluteIndex)}
                          onBlur={() => setActiveRow((current) => (current === absoluteIndex ? null : current))}
                          value={row.weight}
                          onChange={(e) => updateRow(absoluteIndex, { weight: e.target.value })}
                          placeholder="______"
                          inputMode="decimal"
                          className={rowLocked ? "disabled" : ""}
                        />
                      </div>

                      <div className={`sheet-cell body calories-col metric-pad ${rowTone}`}>
                        <Input
                          disabled={rowLocked}
                          readOnly={rowLocked}
                          onFocus={() => setActiveRow(absoluteIndex)}
                          onBlur={() => setActiveRow((current) => (current === absoluteIndex ? null : current))}
                          value={row.calories}
                          onChange={(e) => updateRow(absoluteIndex, { calories: e.target.value })}
                          placeholder="______"
                          inputMode="numeric"
                          className={rowLocked ? "disabled" : ""}
                        />
                      </div>

                      <div className={`sheet-cell body metric-col metric-pad ${rowTone}`}>
                        <Input
                          disabled={rowLocked}
                          readOnly={rowLocked}
                          onFocus={() => setActiveRow(absoluteIndex)}
                          onBlur={() => setActiveRow((current) => (current === absoluteIndex ? null : current))}
                          value={row.steps}
                          onChange={(e) => updateRow(absoluteIndex, { steps: e.target.value })}
                          placeholder="______"
                          inputMode="numeric"
                          className={rowLocked ? "disabled" : ""}
                        />
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
