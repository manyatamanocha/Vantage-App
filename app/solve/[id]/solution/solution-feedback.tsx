"use client";

import { useState } from "react";
import { Heart, MessageCircleQuestion, PartyPopper } from "lucide-react";
import { recordSolutionFeedback } from "./actions";

const HELPFUL_COLOR = "var(--success)";
const NOT_HELPFUL_COLOR = "#EC4899";

/**
 * Replaces the old single "Try it yourself" CTA — a lighter-weight close
 * matching the "Got what you needed?" chip pattern used elsewhere
 * (components/ending-card.tsx), but scoped to this screen's own two options
 * rather than reusing that component's fixed label set.
 */
export function SolutionFeedback({ solveId }: { solveId: string }) {
  const [selected, setSelected] = useState<"helpful" | "explain" | null>(null);

  function choose(choice: "helpful" | "explain") {
    if (selected !== null) return; // one answer per solution; don't double-count
    setSelected(choice);
    // Fire-and-forget, like the rest of analytics: the thank-you must show
    // even if recording fails. Nothing here is worth blocking the UI on.
    void recordSolutionFeedback({ solveId, helpful: choice === "helpful" }).catch(() => {});
  }

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
    <section
      className="card ending-card"
      style={{
        textAlign: "center",
        background: `linear-gradient(135deg, color-mix(in oklch, var(--primary) 9%, var(--card)), color-mix(in oklch, ${NOT_HELPFUL_COLOR} 9%, var(--card)))`,
        borderColor: "color-mix(in oklch, var(--primary) 25%, var(--border))",
      }}
    >
      <span
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 40, height: 40, borderRadius: 999, marginBottom: 10,
          background: "color-mix(in oklch, var(--primary) 16%, transparent)", color: "var(--primary)",
        }}
      >
        <MessageCircleQuestion size={20} aria-hidden="true" />
      </span>
      <div style={{ fontFamily: "var(--font-heading)", fontSize: 18, fontWeight: 750, marginBottom: 14 }}>
        Was this helpful?
      </div>
      <div className="chip-row" style={{ justifyContent: "center" }}>
        <button
          type="button"
          onClick={() => choose("helpful")}
          aria-pressed={selected === "helpful"}
          className="chip-btn"
          style={{ ...chipStyle(HELPFUL_COLOR, selected === "helpful"), padding: "10px 20px", fontSize: 14.5 }}
        >
          It was helpful
        </button>
        <button
          type="button"
          onClick={() => choose("explain")}
          aria-pressed={selected === "explain"}
          className="chip-btn"
          style={{ ...chipStyle(NOT_HELPFUL_COLOR, selected === "explain"), padding: "10px 20px", fontSize: 14.5 }}
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
