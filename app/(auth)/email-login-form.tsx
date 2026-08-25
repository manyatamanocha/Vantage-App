"use client";

import { useActionState, useEffect, useState } from "react";
import { Mail, ShieldCheck } from "lucide-react";
import { requestOtp, verifyOtpCode, type AuthResult, type OtpRequestResult } from "./actions";

export function EmailLoginForm({ next }: { next: string }) {
  const [requestState, requestAction, isRequesting] = useActionState<OtpRequestResult | null, FormData>(
    requestOtp,
    null
  );
  const [verifyState, verifyAction, isVerifying] = useActionState<AuthResult | null, FormData>(
    verifyOtpCode,
    null
  );
  const [step, setStep] = useState<"email" | "code">("email");
  const [sentEmail, setSentEmail] = useState<string | null>(null);

  useEffect(() => {
    if (requestState?.sent && requestState.email) {
      setSentEmail(requestState.email);
      setStep("code");
    }
  }, [requestState]);

  if (step === "code" && sentEmail) {
    return (
      <form action={verifyAction} className="stack" style={{ textAlign: "center" }}>
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="email" value={sentEmail} />
        <span
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 44, height: 44, borderRadius: 999, margin: "0 auto 4px",
            background: "color-mix(in oklch, var(--success) 18%, transparent)", color: "var(--success)",
          }}
        >
          <ShieldCheck size={21} aria-hidden="true" />
        </span>
        <p style={{ fontWeight: 700, fontSize: 15.5 }}>Enter the code we sent</p>
        <p className="card-text" style={{ color: "var(--muted-foreground)" }}>
          Sent to <strong>{sentEmail}</strong> — check your inbox for a one-time code.
        </p>

        <input
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={10}
          placeholder="Enter your code"
          required
          className="input"
          style={{ textAlign: "center", fontSize: 22, letterSpacing: "0.3em", fontWeight: 700 }}
        />

        {verifyState?.error ? (
          <p role="alert" className="rounded-lg bg-destructive-soft px-3 py-2 text-sm text-destructive">
            {verifyState.error}
          </p>
        ) : null}

        <button type="submit" disabled={isVerifying} className="btn btn-primary" style={{ width: "100%" }}>
          {isVerifying ? "Verifying…" : "Verify & continue"}
        </button>
        <button
          type="button"
          className="hint"
          style={{ background: "none", border: 0, cursor: "pointer" }}
          onClick={() => setStep("email")}
        >
          Use a different email
        </button>
      </form>
    );
  }

  return (
    <form action={requestAction} className="stack" style={{ textAlign: "center" }}>
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

      {requestState?.error ? (
        <p role="alert" className="rounded-lg bg-destructive-soft px-3 py-2 text-sm text-destructive">
          {requestState.error}
        </p>
      ) : null}

      <button type="submit" disabled={isRequesting} className="btn btn-primary" style={{ width: "100%" }}>
        {isRequesting ? "Sending code…" : "Continue"}
      </button>
      <p className="hint">We&apos;ll email you a one-time code — no password to remember.</p>
    </form>
  );
}
