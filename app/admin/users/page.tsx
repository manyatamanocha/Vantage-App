import { requireAdmin } from "@/lib/auth/admin";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { SignupChart } from "@/components/signup-chart";

// See Solution Overview.md ("Metric definitions — active / inactive user"):
// active = >=1 meaningful_activity_completed event in the last 7 days;
// dormant/churn-risk = none in the last 28 days; everyone else (had
// activity 8-28 days ago) is the plain "inactive" middle bucket.
const ACTIVE_WINDOW_DAYS = 7;
const DORMANT_WINDOW_DAYS = 28;

function cutoffMs(days: number): number {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

export default async function AdminUsersPage() {
  await requireAdmin();
  const admin = getSupabaseAdminClient();

  const { data: userPage, error: usersError } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (usersError) throw new Error(usersError.message);
  const users = userPage.users;

  const dormantCutoff = cutoffMs(DORMANT_WINDOW_DAYS);
  const activeCutoff = cutoffMs(ACTIVE_WINDOW_DAYS);

  const { data: activityRows } = await admin
    .from("analytics_events")
    .select("user_id, created_at")
    .eq("event_name", "meaningful_activity_completed")
    .gte("created_at", new Date(dormantCutoff).toISOString());

  const lastActivityByUser = new Map<string, number>();
  for (const row of activityRows ?? []) {
    const uid = row.user_id as string | null;
    if (!uid) continue;
    const ts = new Date(row.created_at as string).getTime();
    const prev = lastActivityByUser.get(uid);
    if (!prev || ts > prev) lastActivityByUser.set(uid, ts);
  }

  let activeCount = 0;
  let inactiveCount = 0;
  let dormantCount = 0;
  for (const u of users) {
    const last = lastActivityByUser.get(u.id);
    if (last && last >= activeCutoff) activeCount++;
    else if (last && last >= dormantCutoff) inactiveCount++;
    else dormantCount++;
  }

  const signupTimestamps = users.map((u) => new Date(u.created_at).getTime());

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
      <header>
        <h1 className="display">Users</h1>
        <p className="lede">Signups and activity, at a glance. No passwords or auth secrets shown.</p>
      </header>

      <section className="stack">
        <span className="card-label">Totals</span>
        <div className="card">
          <div className="history-row">
            <div className="flex-1"><strong>Total users</strong></div>
            <span className="badge">{users.length}</span>
          </div>
        </div>
      </section>

      <section className="stack">
        <span className="card-label">Signups</span>
        <div className="card">
          {users.length === 0 ? <p className="card-text">No signups yet.</p> : <SignupChart signupTimestamps={signupTimestamps} />}
        </div>
      </section>

      <section className="stack">
        <span className="card-label">
          Active ({ACTIVE_WINDOW_DAYS}d) · Inactive · Dormant / churn-risk ({DORMANT_WINDOW_DAYS}d+)
        </span>
        <div className="card">
          {[
            { label: "Active", count: activeCount, color: "var(--success)" },
            { label: "Inactive", count: inactiveCount, color: "#F59E0B" },
            { label: "Dormant", count: dormantCount, color: "var(--destructive)" },
          ].map(({ label, count, color }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <span className="text-sm" style={{ width: 64, flexShrink: 0, color: "var(--foreground)", fontWeight: 600 }}>
                {label}
              </span>
              <div className="bar-track" style={{ flex: 1 }}>
                <div
                  style={{
                    height: "100%",
                    width: `${users.length > 0 ? (count / users.length) * 100 : 0}%`,
                    background: color,
                    borderRadius: 99,
                  }}
                />
              </div>
              <span className="badge" style={{ flexShrink: 0 }}>{count}</span>
            </div>
          ))}
          <p className="text-sm text-muted-foreground" style={{ marginTop: 4 }}>
            Counts real practice — finishing a Solve, Daily Challenge, or quiz question — not just logging in.
          </p>
        </div>
      </section>
    </main>
  );
}
