import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for code that runs outside any user's request
 * or session — the content pipeline's generation/insert job. `practice_cases`
 * has no `insert` RLS policy for any other role (see
 * supabase/migrations/0001_init.sql), so writing to it requires this client,
 * the same way the seed migration and the integration test suite already do
 * (see tests/integration/guess-then-reveal.test.ts's `admin` client).
 *
 * Never import this from a Server Component, a page, or anything that runs
 * on behalf of a signed-in user — it bypasses Row Level Security entirely.
 */
export function getSupabaseAdminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
