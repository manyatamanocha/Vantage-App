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
    <section className="card ending-card">
      <span className="card-label">Was this helpful?</span>
      <div className="chip-row">
        <button
          type="button"
          onClick={() => setSelected("helpful")}
          aria-pressed={selected === "helpful"}
          className="chip-btn"
        >
          It was helpful
        </button>
        <button
          type="button"
          onClick={() => setSelected("explain")}
          aria-pressed={selected === "explain"}
          className="chip-btn"
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
