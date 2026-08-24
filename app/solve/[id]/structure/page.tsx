import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { runStructureStep, editStructure } from "./actions";

export default async function StructurePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: existing } = await supabase
    .from("solves")
    .select("goal, problem_type")
    .eq("id", id)
    .single();

  const structure =
    existing?.goal && existing?.problem_type
      ? { goal: existing.goal as string, problemType: existing.problem_type as string }
      : await runStructureStep(id);

  async function saveEdits(formData: FormData) {
    "use server";
    await editStructure(id, String(formData.get("goal") ?? "").trim(), String(formData.get("problemType") ?? "").trim());
    revalidatePath(`/solve/${id}/structure`);
  }

  async function confirmAndContinue(formData: FormData) {
    "use server";
    await editStructure(id, String(formData.get("goal") ?? "").trim(), String(formData.get("problemType") ?? "").trim());
    redirect(`/solve/${id}/guess`);
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
      <div className="topline" aria-label="Solve progress">
        <div className="stepdots" aria-label="Step 2 of 5"><span className="on" /><span className="on" /><span /><span /><span /></div>
        <span className="datechip">Understand</span>
      </div>
      <header>
        <h1 className="display">Here&apos;s what I understand</h1>
        <p className="lede">Edit anything that&apos;s not right before you continue.</p>
      </header>

      <form action={confirmAndContinue} className="stack">
        <label className="card" htmlFor="goal">
          <textarea id="goal" name="goal" defaultValue={structure.goal} rows={3} required className="input border-0 bg-transparent p-0 text-base leading-6 shadow-none outline-none" />
        </label>

        <label className="card" htmlFor="problemType">
          <span className="card-label">Tools that could help</span>
          <textarea id="problemType" name="problemType" defaultValue={structure.problemType} rows={2} required className="input border-0 bg-transparent p-0 text-sm leading-6 shadow-none outline-none" />
        </label>

        <div className="actions between">
          <button type="submit" formAction={saveEdits} className="btn btn-secondary">
            Save edits
          </button>
          <button type="submit" className="btn btn-primary">
            That looks right →
          </button>
        </div>
      </form>
    </main>
  );
}
