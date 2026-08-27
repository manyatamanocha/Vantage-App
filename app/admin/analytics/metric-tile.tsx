import type { LucideIcon } from "lucide-react";
import { InfoPopover } from "@/components/info-popover";

/**
 * One number, scannable in about a second.
 *
 * Was a wide card carrying two or three sentences of rationale under every
 * figure. The prose was correct and worth keeping, but it competed with the
 * numbers for attention, so a dashboard whose whole job is "what happened"
 * read as an essay. Now: icon chip, the figure, a caps label, one short line —
 * and the reasoning behind the definition moved into the ⓘ popover, where it
 * is one hover away instead of always on screen.
 *
 * `value === null` renders "—" in muted, never 0%. An empty denominator means
 * "not measurable yet", and showing that as zero reads as failure.
 */
export function MetricTile({
  icon: Icon,
  label,
  value,
  sub,
  accent = "var(--primary)",
  why,
  star = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string | null;
  sub: string;
  accent?: string;
  why?: string;
  star?: boolean;
}) {
  const measured = value !== null;

  return (
    <div
      className="card"
      style={{
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        // The North Star gets a tinted edge rather than a bigger tile, so the
        // grid keeps its rhythm.
        borderColor: star ? `color-mix(in oklch, ${accent} 45%, var(--border))` : undefined,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 34,
          height: 34,
          borderRadius: 999,
          color: accent,
          background: `color-mix(in oklch, ${accent} 14%, transparent)`,
        }}
      >
        <Icon size={17} />
      </span>

      <div
        className="metric-big"
        style={{ fontSize: 30, lineHeight: 1.05, color: measured ? accent : "var(--muted-foreground)" }}
      >
        {value ?? "—"}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--foreground)",
          }}
        >
          {star ? "★ " : ""}
          {label}
        </span>
        {why ? <InfoPopover label={label}>{why}</InfoPopover> : null}
      </div>

      <p style={{ fontSize: 11.5, lineHeight: 1.4, color: "var(--muted-foreground)", margin: 0 }}>{sub}</p>
    </div>
  );
}
