import Link from "next/link";
import { signupAction } from "../actions";
import { AuthForm } from "../auth-form";

export default async function SignUpPage({ searchParams }: PageProps<"/signup">) {
  const { next } = await searchParams;
  const target = typeof next === "string" ? next : "/";

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Create your Vantage account</h1>
        <p className="text-sm opacity-70">
          Use your work email. Passwords need at least 8 characters.
        </p>
      </div>

      <AuthForm action={signupAction} submitLabel="Sign up" next={target} />

      <p className="text-sm">
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
