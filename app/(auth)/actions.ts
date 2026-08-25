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

export type OtpRequestResult = { error?: string; sent?: boolean; email?: string };

// The WHATWG HTML spec's own email-format regex (same one browsers use for
// <input type="email"> validation) — catches genuinely malformed input
// (missing @, no TLD, spaces, consecutive dots). It cannot and does not try
// to catch a valid-shaped typo (e.g. "gmail.co" instead of "gmail.com");
// only real delivery — the code actually landing in that inbox — catches
// that class of mistake, which is exactly why this flow sends one.
const EMAIL_PATTERN =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Step 1 of email login: send a one-time OTP code (real Supabase Auth email,
 * `shouldCreateUser` covers first-time signup too). Replaces both the earlier
 * magic-link flow (broken: emailed links to localhost can't be reached from
 * wherever the email client actually opens them) and the instant
 * no-verification login that followed it (a well-formed typo like
 * "gmail.co" logged in as the wrong account with zero way to catch it). A
 * code the user reads from their own inbox and retypes here is what actually
 * proves they own that address.
 *
 * NOTE: whether the email actually *shows* a one-time code depends on the
 * Supabase project's "Magic Link" email template including `{{ .Token }}` —
 * check Authentication → Email Templates in the dashboard if a code never
 * arrives even though sending succeeds.
 */
export async function requestOtp(
  _prevState: OtpRequestResult | null,
  formData: FormData
): Promise<OtpRequestResult> {
  const email = formData.get("email")?.toString().trim() ?? "";
  if (!email) return { error: "Enter your email to continue." };
  if (!EMAIL_PATTERN.test(email)) return { error: "That doesn't look like a valid email address." };

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) return { error: error.message };
  return { sent: true, email };
}

/** Step 2: redeem the code the user read from their inbox for a real session. */
export async function verifyOtpCode(
  _prevState: AuthResult | null,
  formData: FormData
): Promise<AuthResult> {
  const email = formData.get("email")?.toString().trim() ?? "";
  const token = formData.get("code")?.toString().trim() ?? "";
  if (!token) return { error: "Enter the code from your email." };

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { error: error.message };

  redirect(safeNext(formData.get("next")));
}

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
