"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { track } from "@/lib/analytics/track";

export type AuthResult = {
  error?: string;
  /**
   * True when the account was created but no session was issued, because the
   * Supabase project requires email confirmation. There is nothing to redirect
   * to in that case — the user has to click a link in their inbox first.
   */
  needsConfirmation?: boolean;
};

// zod's email check is the same WHATWG HTML-spec pattern browsers use for
// <input type="email">, so it catches genuinely malformed input (missing @,
// no TLD, spaces, consecutive dots) without pretending to catch a
// valid-shaped typo like "gmail.co" — only real delivery (e.g. a
// confirmation email actually landing in that inbox) catches that class of
// mistake, which password login can't do by itself.
const emailSchema = z.email("That doesn't look like a valid email address.");
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters");

export async function signUpWithEmail(formData: FormData): Promise<AuthResult> {
  const rawEmail = formData.get("email")?.toString() ?? "";
  if (!rawEmail) return { error: "Email is required" };
  const parsedEmail = emailSchema.safeParse(rawEmail);
  if (!parsedEmail.success) return { error: parsedEmail.error.issues[0].message };

  const parsedPassword = passwordSchema.safeParse(formData.get("password")?.toString() ?? "");
  if (!parsedPassword.success) return { error: parsedPassword.error.issues[0].message };

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsedEmail.data,
    password: parsedPassword.data,
  });
  if (error) return { error: error.message };
  track("signup", data.user?.id ?? null);
  // Supabase returns a user but no session when email confirmation is on.
  if (!data.session) return { needsConfirmation: true };
  return {};
}

const signInSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

export async function signInWithEmail(formData: FormData): Promise<AuthResult> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email")?.toString() ?? "",
    password: formData.get("password")?.toString() ?? "",
  });
  if (!parsed.success) return { error: "Email and password are required" };
  const { email, password } = parsed.data;

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  track("login", data.user?.id ?? null);
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
  const fallback = "/";
  if (!raw) return fallback;
  // Resolve against a fixed dummy origin rather than pattern-matching the raw
  // string: browsers strip leading tabs/CR/LF and treat a leading backslash
  // as a slash before resolving a URL, so naive prefix checks (`//`, etc.)
  // miss bypasses like `/\evil.example` or `/\tevil.example`. Only accept the
  // value if it resolves same-origin *and* reconstructs to a single-slash
  // relative path.
  const base = "http://localhost";
  try {
    const resolved = new URL(raw, base);
    if (resolved.origin !== base) return fallback;
    const rebuilt = resolved.pathname + resolved.search + resolved.hash;
    if (!rebuilt.startsWith("/") || rebuilt.startsWith("//")) return fallback;
    return rebuilt;
  } catch {
    return fallback;
  }
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
