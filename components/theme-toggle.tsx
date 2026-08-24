"use client";

import { useEffect, useState } from "react";

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

/**
 * Mirrors the mockup's Home screen Theme card — a real Light/Dark toggle,
 * not a design-review affordance. The `dark` class it sets is what
 * app/globals.css's `.dark` block already targets.
 */
export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  return (
    <div className="card mt-[18px]">
      <span className="card-label">Theme</span>
      <div className="segmented w-full">
        <button
          type="button"
          aria-pressed={!isDark}
          className="flex-1"
          onClick={() => {
            setIsDark(false);
            applyTheme(false);
          }}
        >
          Light
        </button>
        <button
          type="button"
          aria-pressed={isDark}
          className="flex-1"
          onClick={() => {
            setIsDark(true);
            applyTheme(true);
          }}
        >
          Dark
        </button>
      </div>
    </div>
  );
}
