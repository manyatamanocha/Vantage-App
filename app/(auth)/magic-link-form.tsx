"use client";

import { useActionState } from "react";
import { Mail, Sparkles } from "lucide-react";
import { sendMagicLink, type MagicLinkResult } from "./actions";

export function MagicLinkForm({ next }: { next: string }) {
  const [state, formAction, isPending] = useActionState<MagicLinkResult | null, FormData>(
    sendMagicLink,
    null
  );

  if (state?.sent) {
    return (
      <div
        className="card"
        style={{ textAlign: "center", borderColor: "var(--success)", boxShadow: "0 0 0 1px var(--success)" }}
      >
        <span
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 44, height: 44, borderRadius: 999, marginBottom: 12,
            background: "color-mix(in oklch, var(--success) 18%, transparent)", color: "var(--success)",
          }}
        >
          <Sparkles size={21} aria-hidden="true" />
        </span>
        <p style={{ fontWeight: 700, fontSize: 16 }}>Check your inbox</p>
        <p className="card-text" style={{ color: "var(--muted-foreground)", marginTop: 4 }}>
          We sent a sign-in link to your email. Click it to continue — no password needed.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="stack">
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="email">Work email</label>
        <div style={{ position: "relative" }}>
          <Mail size={17} style={{ position: "absolute", top: "50%", left: 15, transform: "translateY(-50%)", color: "var(--muted-foreground)", pointerEvents: "none" }} aria-hidden="true" />
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@firm.com"
            className="input"
            style={{ paddingLeft: 40 }}
          />
        </div>
      </div>

      {state?.error ? (
        <p role="alert" className="rounded-lg bg-destructive-soft px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={isPending} className="btn btn-primary" style={{ width: "100%" }}>
        {isPending ? "Sending…" : "Continue with email"}
      </button>
      <p className="hint" style={{ textAlign: "center" }}>
        No password to remember — we&apos;ll email you a one-click sign-in link.
      </p>
    </form>
  );
}
