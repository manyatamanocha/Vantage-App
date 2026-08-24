import { redirect } from "next/navigation";
import { getSupabaseServerClient, getVerifiedUser } from "@/lib/supabase/server";
import { getSettings } from "./actions";
import { getProgressStats } from "@/app/progress/actions";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const { user } = await getVerifiedUser();
  if (!user?.id) redirect("/login");

  const userId = user.id;
  const settings = await getSettings(userId);
  const stats = await getProgressStats(userId);

  const handleSignOut = async () => {
    "use server";
    const supabase = await getSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
      <div className="topline"><span className="datechip">Account</span></div>
      <header><h1 className="display">Settings</h1><p className="lede">Set the practice rhythm that works for you.</p></header>

      <section className="card stack">
        <h2 className="text-lg font-semibold">Practice preferences</h2>
        <SettingsForm
          userId={userId}
          initialDifficulty={settings.practiceDifficulty}
          initialFrequency={settings.practiceFrequency}
        />
      </section>

      <section className="stack">
        <h2 className="text-lg font-semibold">Your strength by category</h2>
        {Object.keys(stats.byCategory).length === 0 ? (
          <p className="text-muted-foreground">
            No data yet. Start practicing to see your strength by category.
          </p>
        ) : (
          <div className="card">
            {Object.entries(stats.byCategory)
              .sort(([catA], [catB]) => catA.localeCompare(catB))
              .map(([category, accuracy]) => (
                <div
                  key={category}
                  className="bar-row"
                >
                  <span className="font-medium">{category}</span>
                  <span className="text-sm">
                    {Math.round(accuracy * 100)}%
                  </span>
                </div>
              ))}
          </div>
        )}
      </section>

      <section className="stack">
        <h2 className="text-lg font-semibold">Account</h2>
        <form action={handleSignOut}>
          <button className="btn btn-secondary" type="submit">
            Sign Out
          </button>
        </form>
      </section>
    </main>
  );
}
