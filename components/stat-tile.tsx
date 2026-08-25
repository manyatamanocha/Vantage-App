import type { LucideIcon } from "lucide-react";

// Same ring math as the quiz timer (app/practice/jargon/jargon-session.tsx) —
// r=54 in a 120x120 viewBox — so this reads as the same motif at a smaller
// physical size, not a new one.
const RING = 2 * Math.PI * 54;

export function StatTile({
  icon: Icon,
  color,
  label,
  percentage,
  subtext,
}: {
  icon: LucideIcon;
  color: string;
  label: string;
  percentage: number;
  subtext: string;
}) {
  const progress = Math.max(0, Math.min(1, percentage / 100));

  return (
    <div
      className="stat-tile"
      style={{
        background: `linear-gradient(155deg, color-mix(in oklch, ${color} 10%, var(--card)), var(--card))`,
        border: `1px solid color-mix(in oklch, ${color} 24%, var(--border))`,
      }}
    >
      <div className="stat-tile-ring" style={{ color }}>
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle className="stat-tile-ring-track" cx="60" cy="60" r="54" style={{ stroke: `color-mix(in oklch, ${color} 18%, var(--border))` }} />
          <circle
            className="stat-tile-ring-progress"
            cx="60"
            cy="60"
            r="54"
            style={{ stroke: color, strokeDasharray: RING, strokeDashoffset: RING * (1 - progress) }}
          />
        </svg>
        <span className="stat-tile-ring-icon" style={{ background: color }}>
          <Icon size={18} aria-hidden="true" />
        </span>
      </div>

      <div className="stat-tile-body">
        <span className="card-label" style={{ color }}>{label}</span>
        <div className="metric-big">{percentage}%</div>
        <p className="card-text" style={{ color: "var(--muted-foreground)", marginTop: 4 }}>{subtext}</p>
      </div>
    </div>
  );
}
