import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/supabase/server";
import { loginAction } from "../actions";
import { AuthForm } from "../auth-form";
import { AuthShell } from "../auth-shell";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  // The middleware appends `?next=…` when it turns an unauthenticated visitor
  // away from a protected route, so signing in returns them where they meant
  // to go instead of dumping everyone on the dashboard.
  const { next } = await searchParams;
  const target = typeof next === "string" ? next : "/";

  // Someone already signed in can still land here (back button, a bookmark,
  // a stale tab) — the app shell then renders in full on top of the login
  // form, since SiteNav only hides for a genuinely signed-out visitor. Send
  // them straight into the app instead of showing the form at all.
  const { user } = await getVerifiedUser();
  if (user) redirect(target);

  return (
    <AuthShell mode="login">
      <AuthForm
        action={loginAction}
        submitLabel="Log in"
        next={target}
        passwordAutoComplete="current-password"
      />
    </AuthShell>
  );
}
