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

// Two small circle buttons (light / dark) — a compact swap for the old
// full-width "Theme" card, which took up a whole row on Home for something
// this small. `size` defaults to the login page's toggle (40px); the
// post-login nav passes a smaller one so it doesn't compete with the rest
// of the header for attention the way it does as the single control on the
// login page.
export function ThemeToggle({ size = 40 }: { size?: number }) {
  const [isDark, setIsDark] = useState(false);
  const iconSize = Math.round(size * 0.45);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

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
        onClick={() => {
          setIsDark(false);
          applyTheme(false);
        }}
      >
        <Sun size={iconSize} aria-hidden="true" />
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
        <Moon size={iconSize} aria-hidden="true" />
      </button>
    </div>
  );
}
