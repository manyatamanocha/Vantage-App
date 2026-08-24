"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "vantage-theme";

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  try {
    localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
  } catch {
    // Storage can be unavailable (private browsing); the toggle still works
    // for the current page load, it just won't persist.
  }
}

// Two small circle buttons (light / dark) in the nav, below Sign out — a
// compact swap for the old full-width "Theme" card, which took up a whole
// row on Home for something this small.
export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const circle = (dark: boolean) => ({
    width: 24,
    height: 24,
    borderRadius: 999,
    border: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    background: (dark ? isDark : !isDark) ? "var(--accent2)" : "var(--card)",
    color: (dark ? isDark : !isDark) ? "var(--accent2-foreground)" : "var(--muted-foreground)",
  } as const);

  return (
    <div style={{ display: "flex", gap: 6 }}>
      <button
        type="button"
        aria-label="Light theme"
        aria-pressed={!isDark}
        style={circle(false)}
        onClick={() => {
          setIsDark(false);
          applyTheme(false);
        }}
      >
        <Sun size={13} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Dark theme"
        aria-pressed={isDark}
        style={circle(true)}
        onClick={() => {
          setIsDark(true);
          applyTheme(true);
        }}
      >
        <Moon size={13} aria-hidden="true" />
      </button>
    </div>
  );
}
