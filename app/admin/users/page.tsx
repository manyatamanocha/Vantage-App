import { requireAdmin } from "@/lib/auth/admin";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const ACTIVE_WINDOW_DAYS = 7;
const SIGNUP_WINDOW_DAYS = 14;

function activeCutoffMs(): number {
  return Date.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

const DIFFICULTY_META: Record<string, { label: string; color: string }> = {
  easy: { label: "Easy", color: "var(--success)" },
  medium: { label: "Medium", color: "var(--primary)" },
  hard: { label: "Hard", color: "#F59E0B" },
};

export default async function AdminUsersPage() {
  await requireAdmin();
  const admin = getSupabaseAdminClient();

  const { data: userPage, error: usersError } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (usersError) throw new Error(usersError.message);
  const users = userPage.users;

  const { data: settingsRows } = await admin.from("user_settings").select("user_id, practice_difficulty");
  const difficultyByUser = new Map((settingsRows ?? []).map((r) => [r.user_id as string, r.practice_difficulty as string]));

  const activeCutoff = activeCutoffMs();
  const activeCount = users.filter((u) => u.last_sign_in_at && new Date(u.last_sign_in_at).getTime() >= activeCutoff).length;
  const inactiveCount = users.length - activeCount;

  const difficultyCounts = { easy: 0, medium: 0, hard: 0 } as Record<string, number>;
  for (const u of users) {
    const level = difficultyByUser.get(u.id) ?? "medium";
    difficultyCounts[level] = (difficultyCounts[level] ?? 0) + 1;
  }

  const signupDays = Array.from({ length: SIGNUP_WINDOW_DAYS }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - (SIGNUP_WINDOW_DAYS - 1 - i));
    return d.toISOString().slice(0, 10);
  });
  const signupsByDay = signupDays.map((day) => ({
    day,
    count: users.filter((u) => u.created_at.slice(0, 10) === day).length,
  }));
  const maxSignups = Math.max(1, ...signupsByDay.map((d) => d.count));

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
      <header>
        <div className="topline"><span className="datechip">Admin</span></div>
        <h1 className="display">Users</h1>
        <p className="lede">Signups, activity, and practice progress. No passwords or auth secrets shown.</p>
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
        <span className="card-label">Signups — last {SIGNUP_WINDOW_DAYS} days</span>
        <div className="card">
          {users.length === 0 ? (
            <p className="card-text">No signups yet.</p>
          ) : (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 100 }}>
              {signupsByDay.map(({ day, count }) => (
                <div key={day} style={{ flex: 1, textAlign: "center" }}>
                  <div
                    style={{
                      height: `${Math.max(4, (count / maxSignups) * 80)}px`,
                      background: "var(--primary)",
                      borderRadius: 4,
                      marginBottom: 6,
                    }}
                    title={`${day}: ${count} signup${count === 1 ? "" : "s"}`}
                  />
                  <span className="text-sm text-muted-foreground">{day.slice(8)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="stack">
        <span className="card-label">Active vs. inactive (last {ACTIVE_WINDOW_DAYS} days)</span>
        <div className="card">
          {[
            { label: "Active", count: activeCount, color: "var(--success)" },
            { label: "Inactive", count: inactiveCount, color: "var(--muted-foreground)" },
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
        </div>
      </section>

      <section className="stack">
        <span className="card-label">Practice difficulty</span>
        <div className="card">
          {Object.entries(DIFFICULTY_META).map(([key, meta]) => {
            const count = difficultyCounts[key] ?? 0;
            return (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <span className="text-sm" style={{ width: 64, flexShrink: 0, color: "var(--foreground)", fontWeight: 600 }}>
                  {meta.label}
                </span>
                <div className="bar-track" style={{ flex: 1 }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${users.length > 0 ? (count / users.length) * 100 : 0}%`,
                      background: meta.color,
                      borderRadius: 99,
                    }}
                  />
                </div>
                <span className="badge" style={{ flexShrink: 0 }}>{count}</span>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
