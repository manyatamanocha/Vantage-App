import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { runStructureStep, editStructure } from "./actions";

export default async function StructurePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await getSupabaseServerClient();
  const { data: existing } = await supabase
    .from("solves")
    .select("goal, problem_type")
    .eq("id", id)
    .single();

  // The model runs only on the first visit. Once the user has seen the output and
  // saved (confirmed or corrected) it, a reload must not overwrite their edit with
  // a fresh generation.
  const structure =
    existing?.goal && existing?.problem_type
      ? { goal: existing.goal as string, problemType: existing.problem_type as string }
      : await runStructureStep(id);

  async function saveEdits(formData: FormData) {
    "use server";
    await editStructure(
      id,
      String(formData.get("goal") ?? "").trim(),
      String(formData.get("problemType") ?? "").trim()
    );
    revalidatePath(`/solve/${id}/structure`);
  }

  async function confirmAndContinue(formData: FormData) {
    "use server";
    await editStructure(
      id,
      String(formData.get("goal") ?? "").trim(),
      String(formData.get("problemType") ?? "").trim()
    );
    redirect(`/solve/${id}/guess`);
  }

  return (
    <main>
      <h1>Here&apos;s how I read the problem</h1>
      <p>Edit anything that&apos;s not right before you continue.</p>

      <form action={confirmAndContinue}>
        <label htmlFor="goal">Goal</label>
        <textarea
          id="goal"
          name="goal"
          defaultValue={structure.goal}
          rows={2}
          required
        />

        <label htmlFor="problemType">Problem type</label>
        <textarea
          id="problemType"
          name="problemType"
          defaultValue={structure.problemType}
          rows={2}
          required
        />

        <button type="submit" formAction={saveEdits}>
          Save edits
        </button>
        <button type="submit">Continue</button>
      </form>
    </main>
  );
}
