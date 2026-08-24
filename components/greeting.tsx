"use client";

import { useEffect, useState } from "react";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * Time-of-day greeting for Home, replacing the old "Welcome, {name}" heading.
 * Starts as "Welcome" (server-safe, no Date access) and swaps to the real
 * greeting on mount — same hydration-safe pattern as components/live-clock.tsx,
 * since the visitor's local hour can't be known on the server.
 */
export function Greeting() {
  const [greeting, setGreeting] = useState("Welcome");

  useEffect(() => {
    setGreeting(getGreeting());
  }, []);

  return <>{greeting}</>;
}
