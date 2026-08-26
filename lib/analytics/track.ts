import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Fire-and-forget usage-event logging (signup, solve started, guess locked,
 * quiz attempted, etc.) for the /admin/analytics dashboard. Never throws —
 * an analytics failure must not break the real feature it's attached to.
 *
 * Admin accounts poke around the product while testing/reviewing content;
 * that activity isn't real usage and must never inflate the numbers, so it's
 * dropped before the insert rather than filtered at read time.
 */
export function track(eventName: string, userId: string | null, metadata: Record<string, unknown> = {}): void {
  const admin = getSupabaseAdminClient();

  (userId ? admin.auth.admin.getUserById(userId) : Promise.resolve({ data: { user: null } }))
    .then(({ data }) => {
      if (data.user?.app_metadata?.role === "admin") return;
      return admin
        .from("analytics_events")
        .insert({ event_name: eventName, user_id: userId, metadata })
        .then(({ error }) => {
          if (error) console.error(`[analytics] failed to record "${eventName}":`, error.message);
        });
    })
    .catch((error) => console.error(`[analytics] failed to record "${eventName}":`, error));
}
