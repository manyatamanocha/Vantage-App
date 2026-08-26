"use client";

import { useSyncExternalStore } from "react";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

// No external system ever changes the time-of-day greeting mid-session, so
// subscribe is a no-op — useSyncExternalStore is used purely for its
// server/client snapshot split: getServerSnapshot's "Welcome" matches what
// the server rendered (it can't know the visitor's local hour), then React
// re-renders with the real getGreeting() value right after hydration.
function subscribe() {
  return () => {};
}

function getServerSnapshot(): string {
  return "Welcome";
}

/**
 * Time-of-day greeting for Home, replacing the old "Welcome, {name}" heading.
 * Starts as "Welcome" (server-safe, no Date access) and swaps to the real
 * greeting right after hydration, since the visitor's local hour can't be
 * known on the server.
 */
export function Greeting() {
  const greeting = useSyncExternalStore(subscribe, getGreeting, getServerSnapshot);
  return <>{greeting}</>;
}
