"use client";

import type { ProgressSolveRow } from "./actions";

/**
 * Mirrors the mockup's trendChart() (UI Design Log.md): a running
 * cumulative first-guess accuracy line over chronological completed solves,
 * only shown once there's more than one attempt (a single point isn't a
 * trend). Manual month abbreviation (not toLocaleDateString) so server and
 * client render identically — the earlier from-scratch chart hit a real
 * hydration mismatch from locale-dependent date formatting.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function formatShortDate(iso: string) {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function ProgressTrend({ solves }: { solves: ProgressSolveRow[] }) {
  const chronological = [...solves]
    .filter((s) => s.correct !== null)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  if (chronological.length <= 1) {
    return (
      <div className="card">
        <p className="card-text" style={{ color: "var(--muted-foreground)" }}>
          {chronological.length === 0
            ? "No completed solves yet — your accuracy trend will appear here."
            : "One attempt logged so far — solve one more to start a trend line."}
        </p>
      </div>
    );
  }

  let runningCorrect = 0;
  const pcts = chronological.map((solve, i) => {
    if (solve.correct) runningCorrect++;
    return (runningCorrect / (i + 1)) * 100;
  });

  const n = pcts.length;
  const W = 284;
  const H = 104;
  const padTop = 14;
  const padBottom = 8;
  const leftGutter = 24;
  const plotH = H - padTop - padBottom;
  const plotW = W - leftGutter;
  const stepX = plotW / (n - 1);

  const points = pcts.map((p, i) => [leftGutter + i * stepX, padTop + plotH - (p / 100) * plotH] as const);
  const path = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = points[points.length - 1];

  const currentPct = Math.round(pcts[n - 1]);
  const startPct = Math.round(pcts[0]);
  const delta = currentPct - startPct;

  return (
    <div className="card">
      <div className="row-between">
        <div>
          <div className="metric-big" style={{ fontSize: 30 }}>{currentPct}%</div>
          <p className="card-text" style={{ color: "var(--muted-foreground)", marginTop: 2 }}>
            {n} attempts · {formatShortDate(chronological[0].createdAt)} – {formatShortDate(chronological[n - 1].createdAt)}
          </p>
        </div>
        {delta !== 0 && (
          <span
            className="trend-delta"
            style={{
              color: delta > 0 ? "var(--success)" : "var(--destructive)",
              background: delta > 0 ? "var(--success-soft)" : "var(--destructive-soft)",
            }}
          >
            {delta > 0 ? "▲" : "▼"} {Math.abs(delta)} pt{Math.abs(delta) === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <svg
        width="100%"
        height="118"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ overflow: "visible", marginTop: 16 }}
      >
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 50, 100].map((mark) => {
          const y = padTop + plotH - (mark / 100) * plotH;
          return (
            <g key={mark}>
              <line x1={leftGutter} y1={y} x2={W} y2={y} stroke="var(--border)" strokeWidth="1" />
              <text x={leftGutter - 6} y={y + 3} textAnchor="end" fontSize="9" fill="var(--muted-foreground)">{mark}%</text>
            </g>
          );
        })}

        <path d={`${path} L${last[0].toFixed(1)},${padTop + plotH} L${leftGutter},${padTop + plotH} Z`} fill="url(#trendFill)" stroke="none" />
        <path d={path} fill="none" stroke="var(--accent2)" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />

        {points.map(([x, y], i) => {
          const isLast = i === points.length - 1;
          return (
            <circle
              key={i}
              cx={x.toFixed(1)}
              cy={y.toFixed(1)}
              r={isLast ? 4 : 2.5}
              fill={isLast ? "var(--accent2)" : "var(--card)"}
              stroke="var(--accent2)"
              strokeWidth={isLast ? 0 : 1.5}
            />
          );
        })}
      </svg>
    </div>
  );
}
