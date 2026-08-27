import { ChevronDown, type LucideIcon } from "lucide-react";
import { InfoPopover } from "@/components/info-popover";

/**
 * One number, scannable in about a second — and openable for the numbers it is
 * made of.
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

/** One row of a tile's drill-down: a part of the headline, with its share. */
export type BreakdownRow = { label: string; value: number };

export function MetricTile({
  icon: Icon,
  label,
  value,
  sub,
  accent = "var(--primary)",
  why,
  star = false,
  breakdown,
}: {
  icon: LucideIcon;
  label: string;
  value: string | null;
  sub: string;
  accent?: string;
  why?: string;
  star?: boolean;
  breakdown?: BreakdownRow[];
}) {
  const measured = value !== null;
  // No rows means no chevron and no <details> at all. An affordance that opens
  // onto an empty panel is worse than no affordance: it reads as broken.
  const openable = breakdown !== undefined && breakdown.length > 0;

  const body = (
    <>
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
        {openable ? (
          <ChevronDown className="metric-chevron" size={14} aria-hidden="true" style={{ marginLeft: "auto" }} />
        ) : null}
      </div>

      <p style={{ fontSize: 11.5, lineHeight: 1.4, color: "var(--muted-foreground)", margin: 0 }}>{sub}</p>
    </>
  );

  const tileStyle = {
    padding: 16,
    // The North Star gets a tinted edge rather than a bigger tile, so the
    // grid keeps its rhythm.
    borderColor: star ? `color-mix(in oklch, ${accent} 45%, var(--border))` : undefined,
  };

  if (openable) {
    const top = Math.max(...breakdown.map((row) => row.value), 1);
    return (
      <details className="card metric-tile" style={tileStyle}>
        <summary className="metric-summary">{body}</summary>
        <div className="metric-breakdown">
          {breakdown.map((row) => (
            <div key={row.label} style={{ display: "grid", gap: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11.5 }}>
                <span style={{ color: "var(--foreground)" }}>{row.label}</span>
                <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--muted-foreground)" }}>
                  {row.value}
                </span>
              </div>
              <div className="bar-track" style={{ height: 6 }}>
                <div
                  style={{
                    width: `${(row.value / top) * 100}%`,
                    height: "100%",
                    background: accent,
                    borderRadius: 99,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </details>
    );
  }

  return (
    <div
      className="card"
      style={{
        ...tileStyle,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {body}
    </div>
  );
}
