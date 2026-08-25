"use client";

import { useState } from "react";

/**
 * Replaces the old single "Try it yourself" CTA — a lighter-weight close
 * matching the "Got what you needed?" chip pattern used elsewhere
 * (components/ending-card.tsx), but scoped to this screen's own two options
 * rather than reusing that component's fixed label set.
 */
export function SolutionFeedback({ overview }: { overview: string }) {
  const [selected, setSelected] = useState<"helpful" | "explain" | null>(null);

  return (
    <section className="card ending-card" style={{ textAlign: "center" }}>
      <span className="card-label" style={{ textAlign: "center" }}>Was this helpful?</span>
      <div className="chip-row" style={{ justifyContent: "center" }}>
        <button
          type="button"
          onClick={() => setSelected("helpful")}
          aria-pressed={selected === "helpful"}
          className="chip-btn"
          style={
            selected !== "helpful"
              ? { background: "color-mix(in oklch, var(--primary) 10%, var(--card))", borderColor: "color-mix(in oklch, var(--primary) 35%, var(--border))", color: "var(--primary)", fontWeight: 650 }
              : undefined
          }
        >
          It was helpful
        </button>
        <button
          type="button"
          onClick={() => setSelected("explain")}
          aria-pressed={selected === "explain"}
          className="chip-btn"
          style={
            selected !== "explain"
              ? { background: "color-mix(in oklch, var(--primary) 10%, var(--card))", borderColor: "color-mix(in oklch, var(--primary) 35%, var(--border))", color: "var(--primary)", fontWeight: 650 }
              : undefined
          }
        >
          Explain more
        </button>
      </div>

      {selected === "helpful" ? (
        <p className="ending-panel card-text">Glad that helped.</p>
      ) : null}

      {selected === "explain" ? (
        <p className="ending-panel card-text">{overview}</p>
      ) : null}
    </section>
  );
}
