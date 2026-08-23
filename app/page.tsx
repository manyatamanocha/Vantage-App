import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getProgressStats } from "@/app/progress/actions";

/**
 * The dashboard (screen 2b): the entry point to both loops. `/` is deliberately
 * NOT in the middleware's protected-prefix list — it is the app's root, and a
 * signed-out visitor landing here should be sent to log in by this page rather
 * than bounced through a `?next=/` round trip.
 */
export default async function Home() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const stats = await getProgressStats(user.id);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-6">
      <section>
        <h1 className="text-2xl font-semibold">Vantage</h1>
        <p className="text-sm opacity-70">
          Commit to a guess before the recommendation — that&apos;s the part that
          makes it stick.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/solve/new"
          className="rounded-lg border border-black/15 p-4 hover:bg-black/[.03] dark:border-white/20 dark:hover:bg-white/[.06]"
        >
          <h2 className="font-medium">Solve a problem</h2>
          <p className="text-sm opacity-70">
            Paste a real client ask and work it through end to end.
          </p>
        </Link>

        <Link
          href="/practice/today"
          className="rounded-lg border border-black/15 p-4 hover:bg-black/[.03] dark:border-white/20 dark:hover:bg-white/[.06]"
        >
          <h2 className="font-medium">Today&apos;s practice</h2>
          <p className="text-sm opacity-70">
            One curated case, matched to your difficulty setting.
          </p>
        </Link>
      </section>

      <section>
        <h2 className="font-medium">Where you&apos;re at</h2>
        <p className="text-sm opacity-70">
          {stats.completedCount === 0
            ? "No completed solves yet — your first one starts the record."
            : `${Math.round(stats.firstGuessAccuracy * 100)}% correct on first guess across ${stats.completedCount} completed solve${stats.completedCount === 1 ? "" : "s"}.`}
        </p>
      </section>

      <nav aria-label="Elsewhere" className="flex flex-wrap gap-4 text-sm">
        <Link href="/progress" className="underline">
          Progress
        </Link>
        <Link href="/practice/history" className="underline">
          History
        </Link>
        <Link href="/settings" className="underline">
          Settings
        </Link>
      </nav>
    </main>
  );
}
