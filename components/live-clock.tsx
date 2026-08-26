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

/**
 * Real date/time, ticks every second. Lives in SiteNav's header (below the
 * theme toggle) so it shows on every signed-in screen — previously it only
 * appeared on the Home dashboard. `compact` shrinks it to fit that spot.
 */
export function LiveClock({ compact = false }: { compact?: boolean } = {}) {
  const [now, setNow] = useState<string | null>(null);

  useEffect(() => {
    setNow(formatNow());
    const id = setInterval(() => setNow(formatNow()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span
      className="datechip"
      style={compact ? { fontSize: 11, padding: "4px 9px" } : { fontSize: 14, padding: "8px 14px" }}
    >
      {now ?? " "}
    </span>
  );
}
