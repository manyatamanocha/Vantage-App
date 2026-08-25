"use client";

import { useState } from "react";
import { Heart, PartyPopper } from "lucide-react";

const HELPFUL_COLOR = "var(--success)";
const NOT_HELPFUL_COLOR = "#EC4899";

/**
 * Replaces the old single "Try it yourself" CTA — a lighter-weight close
 * matching the "Got what you needed?" chip pattern used elsewhere
 * (components/ending-card.tsx), but scoped to this screen's own two options
 * rather than reusing that component's fixed label set.
 */
export function SolutionFeedback() {
  const [selected, setSelected] = useState<"helpful" | "explain" | null>(null);

  function chipStyle(color: string, active: boolean) {
    return active
      ? { background: color, borderColor: color, color: "#fff", fontWeight: 650 }
      : {
          background: `color-mix(in oklch, ${color} 14%, var(--card))`,
          borderColor: `color-mix(in oklch, ${color} 45%, var(--border))`,
          color,
          fontWeight: 650,
        };
  }

  return (
    <section className="card ending-card" style={{ textAlign: "center" }}>
      <span className="card-label" style={{ textAlign: "center" }}>Was this helpful?</span>
      <div className="chip-row" style={{ justifyContent: "center" }}>
        <button
          type="button"
          onClick={() => setSelected("helpful")}
          aria-pressed={selected === "helpful"}
          className="chip-btn"
          style={chipStyle(HELPFUL_COLOR, selected === "helpful")}
        >
          It was helpful
        </button>
        <button
          type="button"
          onClick={() => setSelected("explain")}
          aria-pressed={selected === "explain"}
          className="chip-btn"
          style={chipStyle(NOT_HELPFUL_COLOR, selected === "explain")}
        >
          Not really
        </button>
      </div>

      {selected === "helpful" ? (
        <div className="feedback-pop" style={{ color: HELPFUL_COLOR }}>
          <span className="feedback-pop-icon" style={{ background: `color-mix(in oklch, ${HELPFUL_COLOR} 20%, transparent)` }}>
            <PartyPopper size={20} aria-hidden="true" />
          </span>
          <span>Glad that helped!</span>
        </div>
      ) : null}

      {selected === "explain" ? (
        <div className="feedback-pop" style={{ color: NOT_HELPFUL_COLOR }}>
          <span className="feedback-pop-icon" style={{ background: `color-mix(in oklch, ${NOT_HELPFUL_COLOR} 20%, transparent)` }}>
            <Heart size={20} aria-hidden="true" />
          </span>
          <span>Thanks for your feedback!</span>
        </div>
      ) : null}
    </section>
  );
}
