"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "vantage-theme";

// Tiny external store over `document.documentElement`'s dark class: no
// external system ever changes it except this module's own applyTheme(), so
// subscribe() just tracks listeners and applyTheme() notifies them — that's
// what lets useSyncExternalStore re-render after a click without the
// mount-only useEffect+setState this replaced (which is server/client-safe
// the same way: getServerSnapshot's `false` matches the server-rendered
// HTML, then React re-renders with the real getSnapshot() value right after
// hydration, avoiding a mismatch without an explicit effect).
const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot() {
  return document.documentElement.classList.contains("dark");
}

function getServerSnapshot() {
  return false;
}

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  try {
    localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
  } catch {
    // Storage can be unavailable (private browsing); the toggle still works
    // for the current page load, it just won't persist.
  }
  listeners.forEach((listener) => listener());
}

// Two small circle buttons (light / dark) — a compact swap for the old
// full-width "Theme" card, which took up a whole row on Home for something
// this small. `size` defaults to the login page's toggle (40px); the
// post-login nav passes a smaller one so it doesn't compete with the rest
// of the header for attention the way it does as the single control on the
// login page.
export function ThemeToggle({ size = 40 }: { size?: number }) {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const iconSize = Math.round(size * 0.45);

  const circle = (dark: boolean) => {
    const active = dark ? isDark : !isDark;
    return {
      width: size,
      height: size,
      borderRadius: 999,
      border: active ? "2.5px solid var(--primary)" : "2.5px solid var(--border)",
      boxShadow: active ? "0 0 0 3px color-mix(in oklch, var(--primary) 18%, transparent)" : "none",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      background: "var(--card)",
      color: active ? "var(--primary)" : "var(--muted-foreground)",
    } as const;
  };

  return (
    <div style={{ display: "flex", gap: 6 }}>
      <button
        type="button"
        aria-label="Light theme"
        aria-pressed={!isDark}
        style={circle(false)}
        onClick={() => applyTheme(false)}
      >
        <Sun size={iconSize} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Dark theme"
        aria-pressed={isDark}
        style={circle(true)}
        onClick={() => applyTheme(true)}
      >
        <Moon size={iconSize} aria-hidden="true" />
      </button>
    </div>
  );
}
