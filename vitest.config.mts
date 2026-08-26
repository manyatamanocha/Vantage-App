import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";

// Vitest (unlike `next dev`/`next build`) does not auto-load `.env.local`. The
// integration suite needs real Supabase/Groq credentials from it, so pull them
// into process.env here — without overwriting anything already set by the shell
// or CI — rather than requiring every invocation to remember `--env-file`.
const fileEnv = loadEnv("", process.cwd(), "");
for (const [key, value] of Object.entries(fileEnv)) {
  if (process.env[key] === undefined) process.env[key] = value;
}

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
  test: {
    testTimeout: 60000,
    // Vitest's default excludes don't cover .claude/worktrees/ — each entry
    // there is a full nested checkout (its own node_modules, its own copy of
    // every test file), so without this the main checkout's test run picks
    // up a worktree's tests too, against whatever stale state that worktree
    // happens to be in relative to the current branch.
    exclude: ["**/node_modules/**", "**/.claude/worktrees/**"],
  },
});
