"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Lightbulb } from "lucide-react";

/**
 * Was a full "Pro tips" section at the bottom of the page — moved up next to
 * the "Here's your solution" heading as a hover/click icon per user request.
 * The popover itself portals into #pro-tip-anchor (rendered by the page
 * right under the "Step 2 of 2" row) instead of positioning relative to the
 * bulb, so it always opens flush under that row regardless of where the
 * bulb sits in the (variable-width) heading.
 */
export function ProTipBadge({ tips }: { tips: string[] }) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const containerRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAnchor(document.getElementById("pro-tip-anchor"));
  }, []);

  // Click anywhere outside the bulb or the (portaled) popover closes it.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
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

      {open && anchor
        ? createPortal(
            <div
              ref={popoverRef}
              className="quote-card"
              role="dialog"
              aria-label="Pro tips"
              style={{
                position: "absolute",
                top: "8px",
                right: 0,
                zIndex: 10,
                width: "min(420px, calc(100vw - 32px))",
                maxHeight: "min(160px, 50vh)",
                overflowY: "auto",
                padding: 10,
              }}
            >
              <span className="card-label" style={{ margin: "0 0 6px", display: "block" }}>Pro tips</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {tips.map((tip) => (
                  <span
                    key={tip}
                    className="card-text"
                    style={{
                      fontSize: 11.5,
                      lineHeight: 1.35,
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      padding: "4px 8px",
                      flex: "1 1 auto",
                    }}
                  >
                    {tip}
                  </span>
                ))}
              </div>
            </div>,
            anchor
          )
        : null}
    </span>
  );
}
