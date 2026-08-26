import Link from "next/link";
import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/supabase/server";
import { signupAction } from "../actions";
import { AuthForm } from "../auth-form";
import { AuthShell } from "../auth-shell";

export default async function SignUpPage({ searchParams }: PageProps<"/signup">) {
  const { next } = await searchParams;
  const target = typeof next === "string" ? next : "/";

  // Same reasoning as login/page.tsx: an already-signed-in visitor lands
  // here too easily (back button, bookmark), and the app shell would render
  // in full above the signup form otherwise.
  const { user } = await getVerifiedUser();
  if (user) redirect(target);

  return (
    <AuthShell mode="signup">
      <AuthForm
        action={signupAction}
        submitLabel="Create account"
        next={target}
        passwordAutoComplete="new-password"
        passwordPlaceholder="At least 8 characters"
      />
      <p className="auth-switch">
        Already have an account? <Link href="/login" className="link-quiet">Log in</Link>
      </p>
    </AuthShell>
  );
}
