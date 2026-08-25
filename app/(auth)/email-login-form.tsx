"use client";

import { useActionState } from "react";
import { Mail } from "lucide-react";
import { emailLogin, type MagicLinkResult } from "./actions";

export function EmailLoginForm({ next }: { next: string }) {
  const [state, formAction, isPending] = useActionState<MagicLinkResult | null, FormData>(
    emailLogin,
    null
  );

  return (
    <form action={formAction} className="stack" style={{ textAlign: "center" }}>
      <input type="hidden" name="next" value={next} />
      <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--foreground)" }}>
        Your email is all we need
      </p>
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
          style={{ paddingLeft: 40, textAlign: "center" }}
        />
      </div>

      {state?.error ? (
        <p role="alert" className="rounded-lg bg-destructive-soft px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={isPending} className="btn btn-primary" style={{ width: "100%" }}>
        {isPending ? "Signing in…" : "Continue"}
      </button>
    </form>
  );
}
