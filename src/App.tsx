
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Camera, Dumbbell, Utensils, TreeDeciduous, BookOpen, Droplets,
  Flame, Scale, Target, ImagePlus, Lock, LockOpen, X, Images,
  RefreshCw, ArrowLeft, Trophy, ChevronLeft,
  ChevronRight, User, Bell, Layers,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ─── Constants ────────────────────────────────────────────────────────────────
const TOTAL_DAYS = 75;
const STORAGE_KEY = "premium_75_hard_tracker_pwa_v1";
const USER_KEY = "75_hard_user_v1";
const START_DATE = "2026-04-06";

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

type TrackerRow = {
  id: number; date: string; dateLabel: string; day: string; countdown: string;
  photo: boolean; photoUrl: string; workout1: boolean; diet: boolean;
  workout2: boolean; read: boolean; water: boolean;
  weight: string; calories: string; steps: string; locked: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDateLabel(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(date).replace(" ", "-");
}
function createRows(startDateString = START_DATE): TrackerRow[] {
  const start = new Date(`${startDateString}T00:00:00`);
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
      weight: "", calories: "", steps: "", locked: false,
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

// ─── Swipe Hook ───────────────────────────────────────────────────────────────
function useSwipeRow(onSwipeRight: () => void, onSwipeLeft: () => void, disabled: boolean) {
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const swiping = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    swiping.current = true;
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!swiping.current || disabled) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    // Only trigger if mostly horizontal swipe (not a scroll)
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx) * 0.7) return;
    if (dx > 0) onSwipeRight();
    else onSwipeLeft();
    swiping.current = false;
  }, [disabled, onSwipeRight, onSwipeLeft]);

  return { onTouchStart, onTouchEnd };
}

// ─── Swipeable Date Cell ──────────────────────────────────────────────────────
function SwipeDateCell({ row, isToday, rowTone, todayRef, onSwipeRight, onSwipeLeft, locked }: {
  row: TrackerRow; isToday: boolean; rowTone: string;
  todayRef?: React.RefObject<HTMLDivElement>;
  onSwipeRight: () => void; onSwipeLeft: () => void; locked: boolean;
}) {
  const [swipeHint, setSwipeHint] = useState<"right" | "left" | null>(null);
  const { onTouchStart, onTouchEnd } = useSwipeRow(
    () => { setSwipeHint("right"); setTimeout(() => setSwipeHint(null), 500); onSwipeRight(); },
    () => { setSwipeHint("left"); setTimeout(() => setSwipeHint(null), 500); onSwipeLeft(); },
    locked
  );
  return (
    <div
      className={`sheet-cell body date-col ${rowTone}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{ position: "relative", overflow: "hidden", userSelect: "none" }}
    >
      <AnimatePresence>
        {swipeHint && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "absolute", inset: 0, zIndex: 5, pointerEvents: "none",
              background: swipeHint === "right" ? "rgba(220,38,38,0.35)" : "rgba(0,0,0,0.5)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 16, color: "#fff", fontWeight: 900 }}>{swipeHint === "right" ? "✓" : "✕"}</span>
          </motion.div>
        )}
      </AnimatePresence>
      <div ref={todayRef} style={{ textAlign: "center", lineHeight: 1.35, position: "relative", zIndex: 1 }}>
        {isToday && <div style={{ fontSize: 8, letterSpacing: "0.2em", textTransform: "uppercase", color: "#f87171", fontWeight: 800, marginBottom: 2 }}>TODAY</div>}
        <div>{row.dateLabel}</div>
        <div style={{ fontSize: 11, color: "rgba(252,165,165,0.6)", letterSpacing: "0.06em", marginTop: 2 }}>{row.day}</div>
        {!locked && <div style={{ fontSize: 8, color: "rgba(252,165,165,0.18)", marginTop: 3 }}>⟵ swipe ⟶</div>}
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
function OnboardingScreen({ onComplete }: { onComplete: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{
        position: "fixed", inset: 0, zIndex: 300, background: "#000",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32,
      }}
    >
      <div className="background-noise" /><div className="background-glow" />
      <motion.div
        initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 20 }}
        style={{ position: "relative", zIndex: 1, textAlign: "center", width: "100%", maxWidth: 380 }}
      >
        <div className="pill" style={{ display: "inline-flex", marginBottom: 24 }}>
          <Flame style={{ width: 16, height: 16 }} /> Discipline • Consistency • Power
        </div>
        <h1 style={{ fontSize: 42, fontWeight: 900, letterSpacing: "0.14em", color: "#fff", margin: "0 0 8px" }}>75 HARD</h1>
        <p style={{ fontSize: 14, color: "rgba(252,165,165,0.7)", letterSpacing: "0.1em", marginBottom: 48 }}>YOUR TRANSFORMATION BEGINS NOW</p>
        <div style={{ background: "linear-gradient(135deg, #0c0000 0%, #1a0404 100%)", border: "1px solid rgba(127,29,29,0.72)", borderRadius: 24, padding: 28 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, borderRadius: "50%", background: "rgba(127,29,29,0.3)", border: "1px solid rgba(127,29,29,0.7)", margin: "0 auto 20px" }}>
            <User style={{ width: 28, height: 28, color: "#fca5a5" }} />
          </div>
          <p style={{ fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(252,165,165,0.6)", marginBottom: 12 }}>What should we call you?</p>
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && name.trim() && onComplete(name.trim())}
            placeholder="Enter your name" autoFocus
            style={{
              width: "100%", padding: "14px 16px", background: "rgba(0,0,0,0.6)",
              border: "1px solid rgba(127,29,29,0.6)", borderRadius: 12, color: "#ffe8e8",
              fontSize: 16, outline: "none", textAlign: "center", letterSpacing: "0.04em", marginBottom: 16,
            }}
          />
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => name.trim() && onComplete(name.trim())}
            style={{
              width: "100%", padding: "16px",
              background: name.trim() ? "linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)" : "rgba(127,29,29,0.2)",
              border: "1px solid rgba(220,38,38,0.5)", borderRadius: 14,
              color: name.trim() ? "#fff" : "rgba(252,165,165,0.4)",
              fontSize: 15, fontWeight: 700, letterSpacing: "0.1em",
              cursor: name.trim() ? "pointer" : "default", transition: "all 0.2s",
            }}
          >START THE CHALLENGE →</motion.button>
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
const NOTIF_KEY = "75_hard_notif_v1";

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

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rows)); }
    catch { window.alert("Storage is full. Large photos may not save properly."); }
  }, [rows, loaded]);

  useEffect(() => {
    if (!loaded || !todayRowRef.current) return;
    const t = window.setTimeout(() => todayRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" }), 450);
    return () => window.clearTimeout(t);
  }, [loaded]);

  const triggerFeedback = useCallback(() => {
    try {
      if (navigator.vibrate) navigator.vibrate(18);
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      if (!audioContextRef.current) audioContextRef.current = new AC();
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") ctx.resume();
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(900, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1250, ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.03, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.085);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.09);
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
    triggerFeedback();
    const newVal = !rows[absoluteIndex][key];
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
    triggerFeedback();
    updateRow(absoluteIndex, { locked: !rows[absoluteIndex].locked });
  }, [rows, triggerFeedback, updateRow]);

  const handleSwipeComplete = useCallback((absoluteIndex: number) => {
    if (rows[absoluteIndex].locked) return;
    const row = rows[absoluteIndex];
    const allDone = habitColumns.every((item) => row[item.key]);
    // Right swipe = check all non-photo habits, Left swipe = uncheck all
    triggerFeedback();
    const patch: Partial<TrackerRow> = {};
    habitColumns.forEach((item) => {
      if (item.key !== "photo") (patch as any)[item.key] = !allDone;
    });
    const after = { ...row, ...patch };
    if (!allDone && habitColumns.every((item) => after[item.key])) {
      setTimeout(() => { setShowConfetti(true); triggerDayCompleteSound(); }, 100);
    }
    updateRow(absoluteIndex, patch);
  }, [rows, triggerFeedback, triggerDayCompleteSound, updateRow]);

  const handleSwipeUncomplete = useCallback((absoluteIndex: number) => {
    if (rows[absoluteIndex].locked) return;
    triggerFeedback();
    const patch: Partial<TrackerRow> = {};
    habitColumns.forEach((item) => { if (item.key !== "photo") (patch as any)[item.key] = false; });
    updateRow(absoluteIndex, patch);
  }, [rows, triggerFeedback, updateRow]);

  const handlePhotoSourceSelect = useCallback((source: "camera" | "gallery") => {
    const idx = photoSourceTarget; setPhotoSourceTarget(null);
    if (idx === null) return;
    setTimeout(() => { source === "camera" ? photoInputRefs.current[idx]?.click() : galleryInputRefs.current[idx]?.click(); }, 200);
  }, [photoSourceTarget]);

  const todayIndex = useMemo(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    // Also try matching by day number offset from start date as fallback
    const start = new Date(`${START_DATE}T00:00:00`);
    const diffMs = now.setHours(0,0,0,0) - start.setHours(0,0,0,0);
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays < TOTAL_DAYS) return diffDays;
    return rows.findIndex((r) => r.date === today);
  }, [rows]);

  const totalChecks = useMemo(() => rows.reduce((sum, r) => sum + habitColumns.reduce((s, item) => s + (r[item.key] ? 1 : 0), 0), 0), [rows]);
  const completedDays = useMemo(() => rows.filter(isRowComplete).length, [rows]);
  const progressPercent = Math.round((totalChecks / (TOTAL_DAYS * habitColumns.length)) * 100);

  const latestWeight = useMemo(() => { const m = [...rows].reverse().find((r) => r.weight.trim()); return m ? m.weight : "—"; }, [rows]);
  const averageCalories = useMemo(() => { const v = rows.map((r) => Number(String(r.calories).replace(/,/g, ""))).filter((n) => isFinite(n) && n > 0); return v.length ? Math.round(v.reduce((a, b) => a + b) / v.length).toLocaleString() : "—"; }, [rows]);
  const averageSteps = useMemo(() => { const v = rows.map((r) => Number(String(r.steps).replace(/,/g, ""))).filter((n) => isFinite(n) && n > 0); return v.length ? Math.round(v.reduce((a, b) => a + b) / v.length).toLocaleString() : "—"; }, [rows]);

  const timelineBars = Array.from({ length: TOTAL_DAYS }, (_, i) => i < completedDays);
  const weekGroups = Array.from({ length: Math.ceil(TOTAL_DAYS / 7) }, (_, i) => ({ weekNumber: i + 1, rows: rows.slice(i * 7, i * 7 + 7), startIndex: i * 7 }));

  useEffect(() => {
    if (completedDays > prevCompletedDaysRef.current && completedDays > 0) { setShowConfetti(true); triggerDayCompleteSound(); }
    prevCompletedDaysRef.current = completedDays;
  }, [completedDays, triggerDayCompleteSound]);

  useEffect(() => {
    weekGroups.forEach((group) => {
      if (!group.rows.every(isRowComplete) || openedWeekSummariesRef.current.has(group.weekNumber)) return;
      const cal = group.rows.map((r) => Number(r.calories.replace(/,/g, ""))).filter((n) => isFinite(n) && n > 0);
      const stp = group.rows.map((r) => Number(r.steps.replace(/,/g, ""))).filter((n) => isFinite(n) && n > 0);
      const done = group.rows.reduce((sum, r) => sum + habitColumns.reduce((s, item) => s + (r[item.key] ? 1 : 0), 0), 0);
      openedWeekSummariesRef.current.add(group.weekNumber);
      setWeeklySummary({
        weekNumber: group.weekNumber,
        averageCalories: cal.length ? Math.round(cal.reduce((a, b) => a + b) / cal.length).toLocaleString() : "—",
        averageSteps: stp.length ? Math.round(stp.reduce((a, b) => a + b) / stp.length).toLocaleString() : "—",
        completionRate: Math.round((done / (group.rows.length * habitColumns.length)) * 100),
      });
      setIsWeeklySummaryOpen(true);
    });
  }, [rows]);

  return (
    <div className="app-shell">
      <div className="background-noise" />
      <div className="background-glow" />

      <AnimatePresence>{showOnboarding && <OnboardingScreen onComplete={(name) => { setUserName(name); localStorage.setItem(USER_KEY, name); setShowOnboarding(false); }} />}</AnimatePresence>
      {showConfetti && <Confetti onDone={() => setShowConfetti(false)} />}
      <WeeklySummaryModal open={isWeeklySummaryOpen} onClose={() => setIsWeeklySummaryOpen(false)} summary={weeklySummary} />
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

      <div className="page">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="hero-card">
          <div className="hero-header">
            <div className="pill"><Flame className="mini-icon" /> Discipline • Consistency • Power</div>
            {userName ? (
              <>
                <h1 className="hero-title" style={{ marginBottom: 0 }}>{userName.toUpperCase()}'S</h1>
                <h1 className="hero-title" style={{ marginTop: 4, color: "#b91c1c" }}>75 HARD</h1>
              </>
            ) : (
              <h1 className="hero-title">75 HARD TRACKER</h1>
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
              <SummaryCard title="Completed Days" value={completedDays} subtext="All habit boxes finished" icon={Target} />
              <SummaryCard title="Overall Progress" value={`${progressPercent}%`} subtext="Based on all 450 habit ticks" icon={Flame} />
              <SummaryCard title="Latest Weight" value={latestWeight} subtext="Most recent value entered" icon={Scale} extra={<WeightSparkline rows={rows} />} />
              <SummaryCard title="Avg Calories / Steps" value={`${averageCalories} / ${averageSteps}`} subtext="Daily averages" icon={Target} />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowGallery(true)}
                style={{ flex: 1, background: "rgba(127,29,29,0.18)", border: "1px solid rgba(127,29,29,0.55)", borderRadius: 14, padding: "13px 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <Images style={{ width: 18, height: 18, color: "#fca5a5" }} />
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(252,165,165,0.75)" }}>Gallery</span>
              </motion.button>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowBeforeAfter(true)}
                style={{ flex: 1, background: "rgba(127,29,29,0.18)", border: "1px solid rgba(127,29,29,0.55)", borderRadius: 14, padding: "13px 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <Layers style={{ width: 18, height: 18, color: "#fca5a5" }} />
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(252,165,165,0.75)" }}>Before/After</span>
              </motion.button>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowNotifications(true)}
                style={{ flex: 1, background: "rgba(127,29,29,0.18)", border: "1px solid rgba(127,29,29,0.55)", borderRadius: 14, padding: "13px 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <Bell style={{ width: 18, height: 18, color: "#fca5a5" }} />
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(252,165,165,0.75)" }}>Reminder</span>
              </motion.button>
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
            </div>

            {weekGroups.map((group, groupIndex) => (
              <div key={group.weekNumber} className="sheet-grid">
                {group.rows.map((row, rowIndex) => {
                  const absoluteIndex = group.startIndex + rowIndex;
                  const isToday = absoluteIndex === todayIndex;
                  const zebra = groupIndex % 2 === 0 ? "zebra-a" : "zebra-b";
                  const rowDone = isRowComplete(row);
                  const rowLocked = row.locked;
                  const rowIsActive = activeRow === absoluteIndex;
                  const rowTone = rowIsActive ? "active-row" : isToday ? "today-row" : rowDone ? "complete-row" : zebra;
                  const showLockButton = rowHasData(row);

                  return (
                    <React.Fragment key={row.id}>
                      <SwipeDateCell
                        row={row}
                        isToday={isToday}
                        rowTone={rowTone}
                        todayRef={isToday ? todayRowRef : undefined}
                        onSwipeRight={() => handleSwipeComplete(absoluteIndex)}
                        onSwipeLeft={() => handleSwipeUncomplete(absoluteIndex)}
                        locked={rowLocked}
                      />

                      {rowIndex === 0 ? (
                        <div className="merged-week" style={{ gridRow: `span ${group.rows.length} / span ${group.rows.length}` }}>
                          <div className="vertical-week">{`Week ${group.weekNumber}`}</div>
                        </div>
                      ) : null}

                      <div className={`sheet-cell body count-col count-cell ${rowTone}`}>
                        {showLockButton ? (
                          <button type="button" onClick={() => toggleRowLock(absoluteIndex)} className={rowLocked ? "lock-btn locked" : "lock-btn"}>
                            {rowLocked ? <Lock className="lock-icon" /> : <LockOpen className="lock-icon" />}
                          </button>
                        ) : null}
                        <div className="count-text">{row.countdown}</div>
                        <AnimatePresence>
                          {rowLocked ? (
                            <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ type: "spring", stiffness: 260, damping: 18 }} className="badge-row muted">LOCKED</motion.div>
                          ) : rowDone ? (
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
                            <button type="button" onClick={() => handleHabitToggle(absoluteIndex, item.key)} disabled={rowLocked} className={`habit-btn ${row[item.key] ? "checked" : ""} ${rowLocked ? "disabled" : ""}`}>
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
