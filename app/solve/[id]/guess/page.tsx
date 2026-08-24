"use client";

import { use, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_TAXONOMY, type Category } from "@/lib/engine/taxonomy";
import { CategorySelector } from "@/components/category-selector";
import { saveGuess } from "./actions";

export default function GuessPage({ params }: { params: Promise<{ id: string }> }) {
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
      } catch (error) {
        setError(error instanceof Error ? error.message : "Could not save your guess.");
      }
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
      <div className="topline" aria-label="Solve progress">
        <div className="stepdots" aria-label="Step 3 of 5"><span className="on" /><span className="on" /><span className="on" /><span /><span /></div>
        <span className="datechip">Your turn</span>
      </div>
      <header>
        <h1 className="display">Which term best describes it?</h1>
      </header>

      <section className="stack">
        <CategorySelector taxonomy={CATEGORY_TAXONOMY} selected={selected} onSelect={setSelected} />
      </section>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      <button
        type="button"
        onClick={lockIn}
        disabled={!selected || isSaving}
        className="btn btn-primary w-full sm:w-auto"
      >
        {isSaving ? "Locking in…" : "Lock in my guess →"}
      </button>
    </main>
  );
}
