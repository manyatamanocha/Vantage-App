import Link from "next/link";
import { loginAction } from "../actions";
import { AuthForm } from "../auth-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  // The middleware appends `?next=…` when it turns an unauthenticated visitor
  // away from a protected route, so logging in returns them where they meant
  // to go instead of dumping everyone on the dashboard.
  const { next } = await searchParams;
  const target = typeof next === "string" ? next : "/";

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Log in to Vantage</h1>
        <p className="text-sm opacity-70">
          Work through a client problem, or take today&apos;s practice case.
        </p>
      </div>

      <AuthForm action={loginAction} submitLabel="Log in" next={target} />

      <p className="text-sm">
        No account yet?{" "}
        <Link href="/signup" className="underline">
          Sign up
        </Link>
      </p>
    </main>
  );
}
