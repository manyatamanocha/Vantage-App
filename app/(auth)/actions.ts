"use server";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type AuthResult = {
  error?: string;
  /**
   * True when the account was created but no session was issued, because the
   * Supabase project requires email confirmation. There is nothing to redirect
   * to in that case — the user has to click a link in their inbox first.
   */
  needsConfirmation?: boolean;
};

export async function signUpWithEmail(formData: FormData): Promise<AuthResult> {
  const email = formData.get("email")?.toString() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  if (!email) return { error: "Email is required" };
  if (!password || password.length < 8) return { error: "Password must be at least 8 characters" };

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };
  // Supabase returns a user but no session when email confirmation is on.
  if (!data.session) return { needsConfirmation: true };
  return {};
}

export async function signInWithEmail(formData: FormData): Promise<AuthResult> {
  const email = formData.get("email")?.toString() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  if (!email || !password) return { error: "Email and password are required" };

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  return {};
}

/**
 * `next` arrives from the middleware's redirect (`/login?next=/progress`) and is
 * therefore attacker-controllable via a crafted link. Only same-origin,
 * single-slash paths are honoured, so it can never be turned into an open
 * redirect to another host.
 */
function safeNext(value: FormDataEntryValue | null): string {
  const raw = typeof value === "string" ? value : "";
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/";
}

/**
 * `useActionState`-shaped wrappers. Redirect lives here rather than in the
 * client component because `redirect()` must run on the server — the browser
 * then follows the response, which also guarantees the freshly-set session
 * cookie is in place before the destination renders.
 */
export async function loginAction(
  _prevState: AuthResult | null,
  formData: FormData
): Promise<AuthResult> {
  const result = await signInWithEmail(formData);
  if (result.error) return result;
  redirect(safeNext(formData.get("next")));
}

export async function signupAction(
  _prevState: AuthResult | null,
  formData: FormData
): Promise<AuthResult> {
  const result = await signUpWithEmail(formData);
  if (result.error || result.needsConfirmation) return result;
  redirect(safeNext(formData.get("next")));
}

export async function signOutAction(): Promise<void> {
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
