"use client";

import type { ProgressSolveRow } from "./actions";

/**
 * Mirrors the mockup's trendChart() (UI Design Log.md) exactly: a running
 * cumulative first-guess accuracy line over chronological completed solves,
 * only shown once there's more than one attempt (a single point isn't a
 * trend). Replaces an earlier from-scratch weekly-bar-chart implementation
 * that was both unstyled (its .trend-* classes were never defined in
 * globals.css) and had a real hydration bug — it called
 * `date.toLocaleDateString()` with no explicit locale, which formats
 * differently between the server's and the browser's locale.
 */
export function ProgressTrend({ solves }: { solves: ProgressSolveRow[] }) {
  const chronological = [...solves]
    .filter((s) => s.correct !== null)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  if (chronological.length <= 1) {
    return <p className="card-text">No data yet</p>;
  }

  let runningCorrect = 0;
  const pcts = chronological.map((solve, i) => {
    if (solve.correct) runningCorrect++;
    return (runningCorrect / (i + 1)) * 100;
  });

  const n = pcts.length;
  const stepX = 284 / (n - 1);
  const points = pcts.map((p, i) => [i * stepX, 58 - (p / 100) * 50] as const);
  const path = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = points[points.length - 1];

  return (
    <div className="card">
      <svg width="100%" height="86" viewBox="0 0 284 60" preserveAspectRatio="none" style={{ overflow: "visible" }}>
        <line x1="0" y1="15" x2="284" y2="15" stroke="var(--border)" strokeWidth="1" />
        <line x1="0" y1="30" x2="284" y2="30" stroke="var(--border)" strokeWidth="1" />
        <line x1="0" y1="45" x2="284" y2="45" stroke="var(--border)" strokeWidth="1" />
        <path d={`${path} L${last[0].toFixed(1)},60 L0,60 Z`} fill="var(--accent2)" opacity="0.12" stroke="none" />
        <path d={path} fill="none" stroke="var(--accent2)" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={last[0].toFixed(1)} cy={last[1].toFixed(1)} r="3.5" fill="var(--accent2)" />
      </svg>
    </div>
  );
}
