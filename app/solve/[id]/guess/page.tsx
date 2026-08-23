"use client";

import { use, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_TAXONOMY, type Category } from "@/lib/engine/taxonomy";
import { saveGuess } from "./actions";

// This screen is deliberately client-only. Picking a category is the active-recall
// beat of the product, so selection must be instant and must not depend on the
// network. The only request made here is the final "lock in" write.
export default function GuessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [selected, setSelected] = useState<Category | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  function lockIn() {
    if (!selected || isSaving) return;
    setError(null);
    startSaving(async () => {
      try {
        await saveGuess(id, selected);
        router.push(`/solve/${id}/reveal`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save your guess.");
      }
    });
  }

  return (
    <main>
      <h1>What kind of AI problem is this?</h1>
      <p>Commit to an answer before you see the recommendation.</p>

      <ul>
        {CATEGORY_TAXONOMY.map((category) => (
          <li key={category}>
            <button
              type="button"
              aria-pressed={selected === category}
              onClick={() => setSelected(category)}
            >
              {category}
            </button>
          </li>
        ))}
      </ul>

      {error ? <p role="alert">{error}</p> : null}

      <button type="button" onClick={lockIn} disabled={!selected || isSaving}>
        {isSaving ? "Locking in…" : "Lock in guess"}
      </button>
    </main>
  );
}
