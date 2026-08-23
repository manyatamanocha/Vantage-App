import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { createHandback } from "./actions";
import { HandbackViewer } from "./handback-viewer";

/**
 * Screens 2g/2h: the on-demand Handback artifact, generated only when the
 * consultant asks for it from the summary screen. The model runs once — a
 * reload must not spend a second Groq call or overwrite what was already
 * handed to the client, so a persisted `takeaways` row is what re-renders.
 */
export default async function HandbackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();

  const { data: solve } = await supabase
    .from("solves")
    .select("revealed_category")
    .eq("id", id)
    .single();

  // The Handback artifact only means anything once the recommendation has
  // been revealed — enforced here too, not only by the server action.
  if (!solve?.revealed_category) redirect(`/solve/${id}/reveal`);

  // `solve_id` is unique on `takeaways` (supabase/migrations/0003_takeaways_unique_solve.sql),
  // so `maybeSingle` can only ever return zero or one row now — a real error
  // (network failure, RLS denial, etc.) must still be surfaced rather than
  // silently treated as "no takeaway yet."
  const { data: takeaway, error: takeawayErr } = await supabase
    .from("takeaways")
    .select("draft_text")
    .eq("solve_id", id)
    .maybeSingle();
  if (takeawayErr) throw new Error(takeawayErr.message);

  const draftText = takeaway?.draft_text ?? (await createHandback(id));

  return (
    <main>
      <h1>Takeaway for your client</h1>
      <p>Preview, copy, or download the draft below.</p>

      <HandbackViewer draftText={draftText} />

      <Link href={`/solve/${id}/summary`}>Back to summary</Link>
    </main>
  );
}
