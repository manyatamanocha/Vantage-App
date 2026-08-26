"use client";

import { useId, useMemo, useRef, useState } from "react";

type Granularity = "day" | "week";

const DAY_MS = 24 * 60 * 60 * 1000;
const BUCKET_COUNT: Record<Granularity, number> = { day: 14, week: 8 };
const VIEW_W = 600;
const VIEW_H = 160;
const PAD_X = 10;
const PAD_TOP = 14;
const PAD_BOTTOM = 26;

// Explicit locale, not `undefined`: this renders on the server first (Node's
// default locale) then hydrates on the client (the browser's locale) — the
// same class of bug already fixed once in ProgressTrend. "en-US" pins both
// to the same output regardless of either environment's actual locale.
function formatDay(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type Point = { x: number; y: number };

// Catmull-Rom -> cubic Bezier, so the line reads as a smooth growth curve
// instead of a jagged connect-the-dots — the points themselves are exact
// (real cumulative totals), only the interpolation between them is curved.
function smoothPath(points: Point[]): string {
  if (points.length < 2) return points.length === 1 ? `M ${points[0].x} ${points[0].y}` : "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

// Signup growth, day- or week-bucketed, as a smooth cumulative line with a
// gradient fill. Hover (mouse or touch drag) shows the running total and
// the increase for whichever bucket is nearest the pointer.
export function SignupChart({ signupTimestamps }: { signupTimestamps: number[] }) {
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [hovered, setHovered] = useState<number | null>(null);
  const gradientId = useId();
  const svgRef = useRef<SVGSVGElement>(null);

  const sorted = useMemo(() => [...signupTimestamps].sort((a, b) => a - b), [signupTimestamps]);

  const buckets = useMemo(() => {
    const count = BUCKET_COUNT[granularity];
    const spanMs = (granularity === "day" ? 1 : 7) * DAY_MS;
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const windowEnd = endOfToday.getTime();

    return Array.from({ length: count }, (_, i) => {
      const bucketEnd = windowEnd - (count - 1 - i) * spanMs;
      const bucketStart = bucketEnd - spanMs + 1;
      const signups = sorted.filter((t) => t >= bucketStart && t <= bucketEnd).length;
      const totalAsOf = sorted.filter((t) => t <= bucketEnd).length;
      const label = granularity === "day" ? formatDay(bucketEnd) : `${formatDay(bucketStart)}–${formatDay(bucketEnd)}`;
      return { label, signups, totalAsOf };
    });
  }, [sorted, granularity]);

  const maxTotal = Math.max(1, ...buckets.map((b) => b.totalAsOf));
  const minTotal = Math.min(...buckets.map((b) => b.totalAsOf));
  const range = Math.max(1, maxTotal - minTotal);

  const points = useMemo<Point[]>(() => {
    const n = buckets.length;
    return buckets.map((b, i) => {
      const x = n === 1 ? PAD_X : PAD_X + (i * (VIEW_W - 2 * PAD_X)) / (n - 1);
      const usable = VIEW_H - PAD_TOP - PAD_BOTTOM;
      const y = PAD_TOP + usable - ((b.totalAsOf - minTotal) / range) * usable;
      return { x, y };
    });
  }, [buckets, minTotal, range]);

  const linePath = useMemo(() => smoothPath(points), [points]);
  const baselineY = VIEW_H - PAD_BOTTOM;
  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`
    : "";

  const shown = hovered ?? buckets.length - 1;
  const active = buckets[shown];
  const activePoint = points[shown];

  function handlePointerMove(clientX: number) {
    const svg = svgRef.current;
    if (!svg || points.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * VIEW_W;
    let nearest = 0;
    let nearestDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(p.x - relX);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    });
    setHovered(nearest);
  }

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 750, color: "var(--foreground)", fontVariantNumeric: "tabular-nums" }}>
            {active.totalAsOf} <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted-foreground)" }}>users</span>
          </div>
          <div className="text-sm text-muted-foreground">
            {active.signups > 0 ? `+${active.signups}` : "No change"} · {active.label}
            {hovered === null ? " (latest)" : ""}
          </div>
        </div>
        <div className="segmented" role="group" aria-label="Chart granularity">
          <button
            type="button"
            aria-pressed={granularity === "day"}
            onClick={() => {
              setGranularity("day");
              setHovered(null);
            }}
          >
            Daily
          </button>
          <button
            type="button"
            aria-pressed={granularity === "week"}
            onClick={() => {
              setGranularity("week");
              setHovered(null);
            }}
          >
            Weekly
          </button>
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width="100%"
        height={VIEW_H}
        role="img"
        aria-label={`Signup growth, ${granularity === "day" ? "daily" : "weekly"}: ${active.totalAsOf} users as of ${active.label}`}
        onMouseMove={(e) => handlePointerMove(e.clientX)}
        onMouseLeave={() => setHovered(null)}
        onTouchMove={(e) => e.touches[0] && handlePointerMove(e.touches[0].clientX)}
        onTouchEnd={() => setHovered(null)}
        style={{ cursor: "crosshair", overflow: "visible" }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <line x1={PAD_X} y1={baselineY} x2={VIEW_W - PAD_X} y2={baselineY} stroke="var(--border)" strokeWidth="1" />

        {areaPath ? <path d={areaPath} fill={`url(#${gradientId})`} /> : null}
        {linePath ? <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" /> : null}

        {activePoint ? (
          <>
            <line
              x1={activePoint.x}
              y1={PAD_TOP}
              x2={activePoint.x}
              y2={baselineY}
              stroke="var(--muted-foreground)"
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity={hovered === null ? 0 : 0.5}
            />
            <circle cx={activePoint.x} cy={activePoint.y} r="4.5" fill="var(--primary)" stroke="var(--card)" strokeWidth="2" />
          </>
        ) : null}
      </svg>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        {buckets.map((b, i) => (
          <span
            key={b.label + i}
            className="text-sm text-muted-foreground"
            style={{ fontWeight: shown === i ? 700 : 400, color: shown === i ? "var(--foreground)" : undefined }}
          >
            {granularity === "day" ? b.label.slice(-2) : i === 0 || i === buckets.length - 1 ? b.label.split("–")[0] : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
