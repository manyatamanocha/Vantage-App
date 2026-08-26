"use client";

import { useEffect, useRef, useState } from "react";

// Terminal-typewriter reveal for the intake screen's starter prompts —
// chosen by the user from 3 live-animated options (Terminal Typewriter /
// Neural Decode / HUD Scan). Light theme uses Signal Blue to keep the app's
// One Accent Rule (DESIGN.md); dark theme brings back the classic
// green-terminal accent per direct user request — see .suggested-prompt-*
// in globals.css for the light/dark split. Types once on mount, not
// looped — this is a real control, not a demo reel.
const TYPE_MS_PER_CHAR = 9;
const GAP_BETWEEN_LINES_MS = 160;

export function SuggestedPromptTerminal({
  prompts,
  onSelect,
}: {
  prompts: string[];
  onSelect: (prompt: string) => void;
}) {
  const [typedCounts, setTypedCounts] = useState<number[]>(() => prompts.map(() => 0));
  const [activeIndex, setActiveIndex] = useState(0);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotionRef.current) {
      setTypedCounts(prompts.map((p) => p.length));
      setActiveIndex(prompts.length);
      return;
    }

    let cancelled = false;
    async function play() {
      for (let line = 0; line < prompts.length; line++) {
        if (cancelled) return;
        setActiveIndex(line);
        const text = prompts[line];
        for (let i = 0; i <= text.length; i++) {
          if (cancelled) return;
          setTypedCounts((counts) => counts.map((c, idx) => (idx === line ? i : c)));
          await new Promise((r) => setTimeout(r, TYPE_MS_PER_CHAR));
        }
        await new Promise((r) => setTimeout(r, GAP_BETWEEN_LINES_MS));
      }
      if (!cancelled) setActiveIndex(prompts.length);
    }
    play();
    return () => {
      cancelled = true;
    };
    // prompts is a static module-level constant at the call site — intentionally not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="suggested-prompt-terminal">
      {prompts.map((prompt, i) => {
        const typed = prompt.slice(0, typedCounts[i]);
        const isTyping = i === activeIndex && typedCounts[i] < prompt.length;
        const isDone = typedCounts[i] === prompt.length;
        return (
          <button
            key={prompt}
            type="button"
            onClick={() => onSelect(prompt)}
            disabled={typedCounts[i] === 0}
            className="suggested-prompt-row"
            style={{
              cursor: typedCounts[i] === 0 ? "default" : "pointer",
              opacity: typedCounts[i] === 0 ? 0 : 1,
            }}
            data-done={isDone || undefined}
          >
            <span className="suggested-prompt-chevron">&gt;</span>
            <span>
              {typed}
              {isTyping ? (
                <span className="suggested-prompt-caret">▌</span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
