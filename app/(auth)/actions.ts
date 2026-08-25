"use server";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type AuthResult = {
  error?: string;
  /**
   * True when the account was created but no session was issued, because the
   * Supabase project requires email confirmation. There is nothing to redirect
   * to in that case — the user has to click a link in their inbox first.
   */
  needsConfirmation?: boolean;
};

export type MagicLinkResult = { error?: string; sent?: boolean };

/**
 * Instant email login — no password, no clicked link. The magic-link email
 * flow was dropped (localhost dev links can't be reached from wherever an
 * email client actually opens them, and Supabase's shared sender is
 * rate-limited to 2/hour with no custom SMTP configured), at the user's
 * explicit call, knowing the tradeoff: typing any email logs in as that
 * email, no proof of inbox ownership. Real risk once real users' data is on
 * the line — revisit before this ships beyond local testing.
 *
 * Mechanism: `admin.generateLink` (service-role only) mints the same
 * hashed_token Supabase would otherwise email, and `verifyOtp` immediately
 * redeems it server-side — a real Supabase session via Supabase's own
 * legitimate primitives, just with the "click the email" step skipped
 * entirely rather than faked. `shouldCreateUser`-equivalent: generateLink
 * creates the account on first use, same as the old signInWithOtp did.
 */
export async function emailLogin(
  _prevState: MagicLinkResult | null,
  formData: FormData
): Promise<MagicLinkResult> {
  const email = formData.get("email")?.toString().trim() ?? "";
  if (!email) return { error: "Enter your email to continue." };

  const admin = getSupabaseAdminClient();
  const { data, error: generateError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (generateError) return { error: generateError.message };

  const hashedToken = data.properties?.hashed_token;
  if (!hashedToken) return { error: "Could not sign you in. Try again." };

  const supabase = await getSupabaseServerClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: hashedToken,
    type: "email",
  });
  if (verifyError) return { error: verifyError.message };

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
