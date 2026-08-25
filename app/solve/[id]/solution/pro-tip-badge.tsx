"use client";

import { useState } from "react";
import { Lightbulb } from "lucide-react";

/**
 * Was a full "Pro tips" section at the bottom of the page — moved up next to
 * the "Here's your solution" heading as a hover/click icon per user request,
 * so the tip is discoverable immediately rather than only after scrolling
 * past the whole step-by-step guide.
 */
export function ProTipBadge({ tips }: { tips: string[] }) {
  const [open, setOpen] = useState(false);
  if (tips.length === 0) return null;

  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        title="Pro tip"
        aria-label="Show pro tips"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 30,
          height: 30,
          borderRadius: 999,
          border: 0,
          cursor: "pointer",
          background: "color-mix(in oklch, #F59E0B 18%, transparent)",
          color: "#F59E0B",
        }}
      >
        <Lightbulb size={15} aria-hidden="true" />
      </button>

      {open ? (
        <div
          className="quote-card stack"
          role="dialog"
          aria-label="Pro tips"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            zIndex: 10,
            width: 280,
            padding: 16,
          }}
        >
          <span className="card-label" style={{ margin: 0 }}>Pro tips</span>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {tips.map((tip) => (
              <li key={tip} className="card-text">{tip}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </span>
  );
}
