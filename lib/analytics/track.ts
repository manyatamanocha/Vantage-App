import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Fire-and-forget usage-event logging (signup, solve started, guess locked,
 * quiz attempted, etc.) for the /admin/analytics dashboard. Never throws —
 * an analytics failure must not break the real feature it's attached to.
 */
export function track(eventName: string, userId: string | null, metadata: Record<string, unknown> = {}): void {
  getSupabaseAdminClient()
    .from("analytics_events")
    .insert({ event_name: eventName, user_id: userId, metadata })
    .then(({ error }) => {
      if (error) console.error(`[analytics] failed to record "${eventName}":`, error.message);
    });
}
