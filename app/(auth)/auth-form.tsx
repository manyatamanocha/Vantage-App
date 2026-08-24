"use client";

import { useActionState } from "react";
import type { AuthResult } from "./actions";

/**
 * One form for both login and signup — they differ only in which server action
 * they post to and what the button says. The action's `{ error }` return value
 * is rendered here; before this existed both pages threw the result away, so a
 * wrong password looked exactly like a successful submit.
 */
export function AuthForm({
  action,
  submitLabel,
  next,
}: {
  action: (
    prevState: AuthResult | null,
    formData: FormData
  ) => Promise<AuthResult>;
  submitLabel: string;
  next: string;
}) {
  const [state, formAction, isPending] = useActionState<AuthResult | null, FormData>(
    action,
    null
  );

  return (
    <form action={formAction} className="stack">
      <input type="hidden" name="next" value={next} />

      <div className="field">
        <label htmlFor="email">Work email</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@firm.com"
          className="input"
        />
      </div>

      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="current-password"
          placeholder="At least 8 characters"
          className="input"
        />
      </div>

      {state?.error ? (
        <p role="alert" className="rounded-lg bg-destructive-soft px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      {state?.needsConfirmation ? (
        <p role="status" className="rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
          Account created. Check your email for a confirmation link, then log in.
        </p>
      ) : null}

      <button type="submit" disabled={isPending} className="btn btn-primary" style={{ width: "100%" }}>
        {isPending ? "Working…" : submitLabel}
      </button>
    </form>
  );
}
