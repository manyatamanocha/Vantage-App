import type { ReactNode } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Sky Blue Glass auth shell (/login, /signup) — a centered frosted-glass
 * card floating on a soft blue gradient-mesh background, per the redesign
 * approved 2026-08-26. Replaces the earlier dark split-screen "Judgment
 * Console" pitch panel — DESIGN.md is due for an app-wide update to match.
 */
export function AuthShell({
  mode,
  children,
}: {
  mode: "login" | "signup";
  children: ReactNode;
}) {
  return (
    <main className="auth-shell">
      <div className="auth-theme-toggle">
        <ThemeToggle />
      </div>
      <div className="auth-shine" aria-hidden="true" />
      <div className="auth-shine2" aria-hidden="true" />
      <div className="auth-seam" aria-hidden="true" />
      <svg className="auth-gem auth-gem-float" viewBox="0 0 60 60" aria-hidden="true">
        <circle cx="30" cy="30" r="26" fill="var(--primary)" opacity="0.4" />
      </svg>
      <svg className="auth-gem auth-gem-sparkle" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z" fill="var(--primary)" opacity="0.5" />
      </svg>

      <div className="auth-chip auth-chip-0" aria-hidden="true">
        Smarter
        <br />
        Everyday
      </div>
      <div className="auth-chip auth-chip-1" aria-hidden="true">
        Daily
        <br />
        Quizzes
      </div>
      <div className="auth-chip auth-chip-2" aria-hidden="true">
        Learn from
        <br />
        Scenarios
      </div>
      <div className="auth-chip auth-chip-4" aria-hidden="true">
        Real Client
        <br />
        Cases
      </div>
      <div className="auth-chip auth-chip-5" aria-hidden="true">
        Judgment
      </div>
      <div className="auth-chip auth-chip-6" aria-hidden="true">
        Gut
        <br />
        Check
      </div>
      <div className="auth-chip auth-chip-7" aria-hidden="true">
        Fast
        <br />
        Feedback
      </div>
      <div className="auth-chip auth-chip-8" aria-hidden="true">
        Client
        <br />
        Ready
      </div>

      <div className="auth-content">
        <span className="auth-eyebrow">
          <Sparkles size={13} aria-hidden="true" /> Build AI judgment, one guess at a time
        </span>
        <div className="auth-wordmark">
          Vantage AI
          <span className="auth-wordmark-sub">Understand Tech on the Go</span>
        </div>
        <h1 className="auth-title">
          Turn the ask into the <span className="auth-title-hl">right move.</span>
        </h1>
        <p className="auth-tagline">
          Messy client problem in.
          <br />
          Sharp AI approach out — guess first, then see if your understanding was right.
        </p>

        <div className="auth-card">
          <div className="auth-seg-wrap">
            <nav className="auth-seg" aria-label="Auth mode">
              <Link href="/signup" aria-current={mode === "signup" ? "page" : undefined}>
                Sign up
              </Link>
              <Link href="/login" aria-current={mode === "login" ? "page" : undefined}>
                Log in
              </Link>
            </nav>
          </div>

          {children}
        </div>
      </div>
    </main>
  );
}
