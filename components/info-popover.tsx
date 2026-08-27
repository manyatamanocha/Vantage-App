"use client";

import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";

/**
 * "Why is it measured this way" — the reasoning behind a number, one click
 * away instead of always on screen.
 *
 * Same interaction as ProTipBadge (app/solve/[id]/solution/pro-tip-badge.tsx):
 * click toggles, click outside closes. Simpler in two ways — no createPortal,
 * because a metric tile is a fixed-width box the panel can position against
 * directly, and hover opens it too, since these sit in a dense grid where
 * click-per-tile would be tedious.
 *
 * Click, not hover alone: hover-only would strand touch and keyboard users on
 * content that explains what the dashboard means.
 */
export function InfoPopover({ label, children }: { label: string; children: string }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <span
      ref={containerRef}
      style={{ position: "relative", display: "inline-flex", verticalAlign: "middle" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={`Why ${label} is measured this way`}
        aria-expanded={open}
        onClick={(event) => {
          // This button now lives inside a <summary> on the metric tiles, and
          // a click anywhere in a summary toggles its <details>. Reading why a
          // number is defined that way must not also expand the drill-down.
          event.preventDefault();
          event.stopPropagation();
          setOpen((v) => !v);
        }}
        style={{
          display: "inline-flex",
          border: 0,
          background: "transparent",
          padding: 0,
          cursor: "pointer",
          color: "var(--muted-foreground)",
          opacity: open ? 1 : 0.7,
        }}
      >
        <Info size={14} aria-hidden="true" />
      </button>

      {open ? (
        <span
          role="dialog"
          aria-label={`Why ${label} is measured this way`}
          className="card"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 10,
            width: "min(300px, calc(100vw - 48px))",
            padding: 10,
            fontSize: 12,
            lineHeight: 1.5,
            fontWeight: 400,
            letterSpacing: "normal",
            textTransform: "none",
            color: "var(--muted-foreground)",
            boxShadow: "0 8px 24px rgb(0 0 0 / 0.18)",
          }}
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}
