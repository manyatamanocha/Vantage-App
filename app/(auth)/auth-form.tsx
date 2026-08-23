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
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />

      <label className="flex flex-col gap-1 text-sm" htmlFor="email">
        Work email
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded border border-black/20 px-3 py-2 dark:border-white/20"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm" htmlFor="password">
        Password
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="current-password"
          className="rounded border border-black/20 px-3 py-2 dark:border-white/20"
        />
      </label>

      {state?.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      {state?.needsConfirmation ? (
        <p role="status" className="text-sm">
          Account created. Check your email for a confirmation link, then log in.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-foreground px-4 py-2 text-background disabled:opacity-50"
      >
        {isPending ? "Working…" : submitLabel}
      </button>
    </form>
  );
}
