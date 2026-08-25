"use client";

import { useEffect, useRef, useState } from "react";
import { Lightbulb } from "lucide-react";

/**
 * Was a full "Pro tips" section at the bottom of the page — moved up next to
 * the "Here's your solution" heading as a hover/click icon per user request,
 * so the tip is discoverable immediately rather than only after scrolling
 * past the whole step-by-step guide.
 */
export function ProTipBadge({ tips }: { tips: string[] }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  // Click anywhere outside the badge/popover closes it — without this the
  // only way to close was clicking the bulb again, which reads as a trap
  // once the popover is covering other content the user wants to click.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  if (tips.length === 0) return null;

  return (
    <span ref={containerRef} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        title="Pro tip"
        aria-label="Show pro tips"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="pro-tip-bulb"
      >
        <Lightbulb size={19} aria-hidden="true" />
      </button>

      {open ? (
        <div
          className="quote-card stack"
          role="dialog"
          aria-label="Pro tips"
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
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
