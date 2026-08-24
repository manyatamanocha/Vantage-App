"use client";

import { useEffect, useState } from "react";

function formatNow() {
  const d = new Date();
  const datePart = d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timePart = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${datePart} · ${timePart}`;
}

/** Mirrors the mockup's Home screen live clock — real date/time, ticks every second. */
export function LiveClock() {
  const [now, setNow] = useState<string | null>(null);

  useEffect(() => {
    setNow(formatNow());
    const id = setInterval(() => setNow(formatNow()), 1000);
    return () => clearInterval(id);
  }, []);

  return <span className="datechip" style={{ fontSize: 14, padding: "8px 14px" }}>{now ?? " "}</span>;
}
