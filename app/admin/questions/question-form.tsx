"use client";

import { useRef, useState, useTransition } from "react";
import { createQuestion, updateQuestion, type QuestionTable } from "./actions";

const TIERS = ["easy", "medium", "hard"] as const;

type InitialValues = {
  difficulty: string;
  question_text: string;
  options: string[];
  answer: string;
  explanation: string;
};

export function QuestionForm({
  table,
  kind,
  editId,
  initial,
  onDone,
}: {
  table: QuestionTable;
  kind: "general" | "scenario";
  /** When set, the form edits this row via `updateQuestion` instead of creating a new one. */
  editId?: string;
  initial?: InitialValues;
  /** Called after a successful edit save, so the parent can close the inline editor. */
  onDone?: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const answerFieldName = kind === "general" ? "correct_answer" : "answer";

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        if (editId) {
          await updateQuestion(table, editId, formData);
          onDone?.();
        } else {
          await createQuestion(table, formData);
          formRef.current?.reset();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save the question.");
      }
    });
  }

  return (
    <form ref={formRef} action={submit} className="card stack">
      <label className="field">
        <span>Difficulty</span>
        <select className="input" name="difficulty" defaultValue={initial?.difficulty ?? "easy"} style={{ width: "auto" }}>
          {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Question</span>
        <textarea className="input" name="question_text" required rows={2} defaultValue={initial?.question_text} />
      </label>
      <div className="stack">
        {[0, 1, 2, 3].map((i) => (
          <label className="field" key={i}>
            <span>Option {i + 1}</span>
            <input className="input" name={`option_${i}`} required defaultValue={initial?.options?.[i]} />
          </label>
        ))}
      </div>
      <label className="field">
        <span>{kind === "general" ? "Correct answer (must match one option exactly)" : "Answer (must match one option exactly)"}</span>
        <input className="input" name={answerFieldName} required defaultValue={initial?.answer} />
      </label>
      <label className="field">
        <span>Explanation</span>
        <textarea className="input" name="explanation" rows={2} defaultValue={initial?.explanation} />
      </label>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div className="actions">
        <button type="submit" className="btn btn-primary" disabled={isPending}>
          {isPending ? "Saving…" : editId ? "Save changes" : "Add question"}
        </button>
        {editId && onDone ? (
          <button type="button" className="btn btn-secondary" onClick={onDone} disabled={isPending}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
