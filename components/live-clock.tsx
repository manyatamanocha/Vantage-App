"use client";

import { useSyncExternalStore } from "react";

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

// The ticking interval doubles as the store's subscription: it calls back
// once a second so useSyncExternalStore re-checks getSnapshot() and
// re-renders when the formatted string changes — same effective behavior as
// the setInterval+setState this replaced, without setState firing directly
// inside an effect body.
function subscribe(callback: () => void) {
  const id = setInterval(callback, 1000);
  return () => clearInterval(id);
}

function getServerSnapshot(): string | null {
  return null;
}

/**
 * Real date/time, ticks every second. Lives in SiteNav's header (below the
 * theme toggle) so it shows on every signed-in screen — previously it only
 * appeared on the Home dashboard. `compact` shrinks it to fit that spot.
 */
export function LiveClock({ compact = false }: { compact?: boolean } = {}) {
  const now = useSyncExternalStore(subscribe, formatNow, getServerSnapshot);

  return (
    <span
      className="datechip"
      style={compact ? { fontSize: 11, padding: "4px 9px" } : { fontSize: 14, padding: "8px 14px" }}
    >
      {now ?? " "}
    </span>
  );
}
