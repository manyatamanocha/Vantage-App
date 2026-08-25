import Link from "next/link";
import { Flame } from "lucide-react";
import { loginAction } from "../actions";
import { AuthForm } from "../auth-form";
import { WhatsInside } from "../whats-inside";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  // The middleware appends `?next=…` when it turns an unauthenticated visitor
  // away from a protected route, so signing in returns them where they meant
  // to go instead of dumping everyone on the dashboard.
  const { next } = await searchParams;
  const target = typeof next === "string" ? next : "/";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-10 sm:px-8 sm:py-14">
      <div style={{ textAlign: "center" }}>
        <span
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 12.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
            padding: "6px 14px", borderRadius: 999, marginBottom: 16,
            background: "color-mix(in oklch, var(--primary) 14%, transparent)", color: "var(--primary)",
          }}
        >
          <Flame size={13} aria-hidden="true" /> Build AI judgment, one problem at a time
        </span>

        <div className="font-heading text-[32px] font-bold tracking-tight sm:text-[38px]">Vantage AI</div>
      </div>

      <div className="mx-auto mt-8 w-full max-w-[380px]">
        <div className="segmented mx-auto mb-6 w-fit" role="tablist" aria-label="Auth mode">
          <Link href="/login" aria-pressed="true">
            Log in
          </Link>
          <Link href="/signup" aria-pressed="false">
            Sign up
          </Link>
        </div>

        <AuthForm action={loginAction} submitLabel="Log in" next={target} />

        <p className="mt-[18px] text-center text-[13.5px] text-muted-foreground">
          New here?{" "}
          <Link href="/signup" className="link-quiet inline-flex">
            Create an account
          </Link>
        </p>
      </div>

      <WhatsInside />
    </main>
  );
}
