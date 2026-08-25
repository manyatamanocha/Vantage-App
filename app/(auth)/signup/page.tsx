import Link from "next/link";
import { signupAction } from "../actions";
import { AuthForm } from "../auth-form";
import { WhatsInside } from "../whats-inside";

export default async function SignUpPage({ searchParams }: PageProps<"/signup">) {
  const { next } = await searchParams;
  const target = typeof next === "string" ? next : "/";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-10 sm:px-8 sm:py-14">
      <div style={{ textAlign: "center" }}>
        <div className="font-heading text-[27px] font-bold tracking-tight">Vantage AI</div>
        <p className="mx-auto mt-[11px] max-w-[320px] text-[14.5px] leading-[1.55] text-muted-foreground">
          Turn client problems into the right AI approach — and build the judgment to see it
          yourself.
        </p>
        <p className="mt-2 text-[13.5px] font-semibold text-primary">Let&apos;s work, learn together.</p>
      </div>

      <div className="mx-auto mt-8 w-full max-w-[380px]">
        <div className="segmented mx-auto mb-6 w-fit" role="tablist" aria-label="Auth mode">
          <Link href="/login" aria-pressed="false">
            Log in
          </Link>
          <Link href="/signup" aria-pressed="true">
            Sign up
          </Link>
        </div>

        <AuthForm action={signupAction} submitLabel="Create account" next={target} />

        <p className="mt-[18px] text-center text-[13.5px] text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="link-quiet inline-flex">
            Log in
          </Link>
        </p>
      </div>

      <WhatsInside />
    </main>
  );
}
