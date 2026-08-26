/**
 * One number, its definition, and how it's doing — the dashboard's unit.
 *
 * `value === null` renders "—" plus the reason, never 0%. An empty denominator
 * means "not measurable yet", and showing that as zero reads as failure.
 */
export function MetricTile({
  label,
  value,
  sub,
  accent = "var(--primary)",
  star = false,
}: {
  label: string;
  value: string | null;
  sub: string;
  accent?: string;
  star?: boolean;
}) {
  return (
    <div className="card" style={{ padding: 20, borderTop: `3px solid ${accent}` }}>
      <span className="card-label" style={{ color: accent, marginBottom: 10 }}>
        {star ? "★ " : ""}
        {label}
      </span>
      <div
        className="metric-big"
        style={{ fontSize: 38, color: value === null ? "var(--muted-foreground)" : "var(--foreground)" }}
      >
        {value ?? "—"}
      </div>
      <p style={{ fontSize: 12, lineHeight: 1.5, color: "var(--muted-foreground)", margin: "6px 0 0" }}>{sub}</p>
    </div>
  );
}
