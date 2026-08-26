"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

// Count-up stopwatch, purely visual — no submit pressure. Re-mount (via a
// `key` on the parent) or pass a new `startedAt` to reset it per question.
export function ElapsedTimer({ startedAt, running }: { startedAt: number | null; running: boolean }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running || startedAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running, startedAt]);

  if (startedAt === null) return null;
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <span className="badge progress" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <Clock size={14} aria-hidden="true" />
      {mm}:{ss}
    </span>
  );
}
