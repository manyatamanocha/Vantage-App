"use client";

import { useState, useTransition } from "react";
import { deleteQuestion, type QuestionTable } from "./actions";
import { QuestionForm } from "./question-form";

type Row = {
  id: string;
  difficulty: string;
  question_text: string;
  options?: string[] | null;
  correct_answer?: string | null;
  answer?: string | null;
  explanation?: string | null;
};

export function QuestionList({ table, questions, kind }: { table: QuestionTable; questions: Row[]; kind: "general" | "scenario" }) {
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);

  function remove(id: string) {
    startTransition(async () => {
      await deleteQuestion(table, id);
    });
  }

  return (
    <div className="card">
      {questions.length === 0 ? (
        <p className="card-text">No {kind === "general" ? "Tech & AI quiz" : "scenario quiz"} questions yet.</p>
      ) : null}
      {questions.map((q) =>
        editingId === q.id ? (
          <div key={q.id} style={{ marginBottom: 14 }}>
            <QuestionForm
              table={table}
              kind={kind}
              editId={q.id}
              initial={{
                difficulty: q.difficulty,
                question_text: q.question_text,
                options: q.options ?? [],
                answer: (kind === "general" ? q.correct_answer : q.answer) ?? "",
                explanation: q.explanation ?? "",
              }}
              onDone={() => setEditingId(null)}
            />
          </div>
        ) : (
          <div className="history-row" key={q.id}>
            <div className="flex-1">
              <p className="mt-1 text-sm text-muted-foreground">{q.difficulty} · {q.question_text}</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setEditingId(q.id)}>
                Edit
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={isPending}
                onClick={() => {
                  if (confirm("Delete this question permanently?")) remove(q.id);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
}
