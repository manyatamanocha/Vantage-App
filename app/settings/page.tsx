import { redirect } from "next/navigation";
import { getSupabaseServerClient, getVerifiedUser } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
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
    <main className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Practice Preferences</h2>
        <SettingsForm
          userId={userId}
          initialDifficulty={settings.practiceDifficulty}
          initialFrequency={settings.practiceFrequency}
        />
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Your Strength by Category</h2>
        {Object.keys(stats.byCategory).length === 0 ? (
          <p className="text-muted-foreground">
            No data yet. Start practicing to see your strength by category.
          </p>
        ) : (
          <div className="grid gap-2">
            {Object.entries(stats.byCategory)
              .sort(([catA], [catB]) => catA.localeCompare(catB))
              .map(([category, accuracy]) => (
                <div
                  key={category}
                  className="flex items-center justify-between p-3 border border-border rounded-lg"
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

      <section>
        <h2 className="text-2xl font-semibold mb-4">Account</h2>
        <form action={handleSignOut}>
          <Button type="submit" variant="destructive">
            Sign Out
          </Button>
        </form>
      </section>
    </main>
  );
}
