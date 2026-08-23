import { createDraftSolve } from "./actions";
import { redirect } from "next/navigation";

export default function NewSolvePage() {
  async function handleSubmit(formData: FormData) {
    "use server";
    const { solveId } = await createDraftSolve({
      rawInput: formData.get("rawInput")!.toString(),
      industry: formData.get("industry")?.toString() || undefined,
      source: "live",
    });
    redirect(`/solve/${solveId}/structure`);
  }

  return (
    <form action={handleSubmit}>
      <textarea name="rawInput" placeholder="What's the client asking for?" required />
      <input name="industry" placeholder="Industry (optional)" />
      <button type="submit">Continue</button>
    </form>
  );
}
