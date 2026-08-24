import Link from "next/link";
import { signupAction } from "../actions";
import { AuthForm } from "../auth-form";

export default async function SignUpPage({ searchParams }: PageProps<"/signup">) {
  const { next } = await searchParams;
  const target = typeof next === "string" ? next : "/";

  return (
    <main className="w-sm mx-auto flex w-full flex-1 flex-col justify-center px-5 py-10 sm:px-8">
      <div style={{ textAlign: "center" }}>
        <div className="font-heading text-[27px] font-bold tracking-tight">Vantage AI</div>
        <p className="mx-auto mt-[11px] max-w-[320px] text-[14.5px] leading-[1.55] text-muted-foreground">
          Turn client problems into the right AI approach — and build the judgment to see it
          yourself.
        </p>
        <p className="mt-2 text-[13.5px] font-semibold text-primary">Let&apos;s work, learn together.</p>
      </div>

      <div className="segmented mx-auto mt-6 w-fit" role="tablist" aria-label="Auth mode">
        <Link href="/login" aria-pressed="false">
          Log in
        </Link>
        <Link href="/signup" aria-pressed="true">
          Sign up
        </Link>
      </div>

      <div className="mt-[22px]">
        <AuthForm action={signupAction} submitLabel="Create account" next={target} />
      </div>

      <p className="mt-[18px] text-center text-[13.5px] text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="link-quiet inline-flex">
          Log in
        </Link>
      </p>
    </main>
  );
}
