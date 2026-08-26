"use client";

import { useEffect, useState } from "react";

// Themed off the app's own tokens (card/border/primary) instead of fixed
// colors, so it sits on the page like the rest of the UI in both themes.
const FACE = "var(--card)";
const RIM = "var(--border)";
const INK = "var(--muted-foreground)";
const HAND = "var(--primary)";

// The dial is a 120-second loop (one full sweep of the hand = 2 minutes),
// not a literal 12-hour clock face — quarter labels read the seconds into
// that loop.
const QUARTER_LABELS: Array<{ tickIndex: number; seconds: number }> = [
  { tickIndex: 0, seconds: 0 },
  { tickIndex: 15, seconds: 30 },
  { tickIndex: 30, seconds: 60 },
  { tickIndex: 45, seconds: 90 },
];

// Click-to-toggle analog stopwatch — never starts on its own. Mount with a
// `key` tied to the current question so it resets to 0:00 for each new one;
// set `frozen` once the answer is locked to stop and disable further clicks.
// Modeled on a plain wall clock face rather than a digital readout, themed
// off the app's own card/border/primary tokens; the sweep hand loops every
// 120 seconds so it stays legible even on a longer question, while the
// digital readout below keeps counting total elapsed time.
export function ElapsedTimer({
  frozen = false,
  onElapsedChange,
}: {
  frozen?: boolean;
  onElapsedChange?: (seconds: number) => void;
}) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running || frozen) return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running, frozen]);

  useEffect(() => {
    onElapsedChange?.(elapsed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed]);

  const active = running && !frozen;
  // One full sweep of the hand = 120 seconds.
  const sweepAngle = (elapsed % 120) * 3;
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <button
      type="button"
      disabled={frozen}
      aria-pressed={active}
      aria-label={`${active ? "Pause" : "Start"} timer — ${mm}:${ss} elapsed`}
      onClick={() => setRunning((r) => !r)}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        background: "transparent",
        border: 0,
        padding: 0,
        cursor: frozen ? "default" : "pointer",
        opacity: frozen ? 0.6 : 1,
      }}
    >
      <svg width="96" height="96" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="47" fill={FACE} stroke={RIM} strokeWidth="2" />

        {Array.from({ length: 60 }, (_, i) => {
          const isMajor = i % 5 === 0;
          const angle = i * 6;
          const outer = 41;
          const inner = isMajor ? 36 : 38.5;
          return (
            <line
              key={i}
              x1="50"
              y1={50 - outer}
              x2="50"
              y2={50 - inner}
              stroke={INK}
              strokeWidth={isMajor ? 1.6 : 0.8}
              strokeLinecap="round"
              transform={`rotate(${angle} 50 50)`}
            />
          );
        })}

        {QUARTER_LABELS.map(({ tickIndex, seconds }) => {
          const angle = (tickIndex * 6 * Math.PI) / 180;
          const x = 50 + Math.sin(angle) * 29;
          const y = 50 - Math.cos(angle) * 29;
          return (
            <text
              key={seconds}
              x={x}
              y={y}
              fill={INK}
              fontSize="9"
              fontWeight={600}
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily="inherit"
            >
              {seconds}
            </text>
          );
        })}

        <line x1="50" y1="58" x2="50" y2="14" stroke={HAND} strokeWidth="2.5" strokeLinecap="round" transform={`rotate(${sweepAngle} 50 50)`} />
        <circle cx="50" cy="50" r="3.5" fill={HAND} />
      </svg>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted-foreground)", fontVariantNumeric: "tabular-nums" }}>
        {mm}:{ss}
      </span>
    </button>
  );
}
