"use client";

import { useRef, useState, useTransition } from "react";
import { Brain, Check, Leaf, X, Zap } from "lucide-react";
import { ElapsedTimer } from "@/components/elapsed-timer";
import type { GeneralQuizQuestion } from "./actions";
import { getGeneralQuizQuestions, recordGeneralQuizAttempt } from "./actions";

const TIERS = ["easy", "medium", "hard"] as const;

const TIER_META: Record<(typeof TIERS)[number], { label: string; color: string; icon: typeof Leaf }> = {
  easy: { label: "Easy", color: "var(--success)", icon: Leaf },
  medium: { label: "Medium", color: "var(--primary)", icon: Zap },
  hard: { label: "Hard", color: "#F59E0B", icon: Brain },
};

export function GeneralQuizSession() {
  const [difficulty, setDifficulty] = useState<(typeof TIERS)[number]>("medium");
  const [questions, setQuestions] = useState<GeneralQuizQuestion[] | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // The pool total and how many have been answered, tracked separately from
  // `questions` — that array shrinks every "Try another" (see nextQuestion)
  // to guarantee no repeats, so it can't also drive a "2 / 38" progress
  // count without the denominator shrinking alongside it.
  const [poolTotal, setPoolTotal] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [answerSeconds, setAnswerSeconds] = useState<number | null>(null);
  const elapsedRef = useRef(0);
  const question = questions?.[index] ?? null;

  function startQuiz() {
    setError(null);
    startTransition(async () => {
      try {
        const loaded = await getGeneralQuizQuestions(difficulty);
        setQuestions(loaded);
        setIndex(0);
        setPoolTotal(loaded.length);
        setAnsweredCount(0);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load today's quiz.");
      }
    });
  }

  function lockAnswer() {
    if (!selected || isPending || result !== null || !question) return;
    const seconds = elapsedRef.current;
    startTransition(async () => {
      try {
        const response = await recordGeneralQuizAttempt({ questionId: question.id, selectedAnswer: selected, seconds });
        setResult(response.correct);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save your answer.");
      }
    });
  }

  function nextQuestion() {
    // Drop the question just shown instead of wrapping the index around it —
    // a question must never repeat within a sitting either, only once per pool.
    if (questions) {
      const remaining = questions.filter((_, i) => i !== index);
      setQuestions(remaining);
      setIndex(index >= remaining.length ? 0 : index);
      setAnsweredCount((count) => count + 1);
    }
    setSelected(null);
    setResult(null);
    setAnswerSeconds(null);
  }

  if (!questions) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
        <div className="topline">
          <span className="datechip">Tech & AI Quiz</span>
        </div>
        <header>
          <h1 className="display">Tech &amp; AI knowledge quiz</h1>
          <p className="lede">120 general questions on everyday tech and AI concepts.</p>
        </header>

        <section className="stack">
          <span className="card-label">Choose your difficulty</span>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {TIERS.map((tier) => {
              const meta = TIER_META[tier];
              const Icon = meta.icon;
              const active = difficulty === tier;
              return (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setDifficulty(tier)}
                  aria-pressed={active}
                  className="card"
                  style={{
                    textAlign: "left",
                    cursor: "pointer",
                    borderColor: active ? meta.color : undefined,
                    boxShadow: active ? `0 0 0 1px ${meta.color}` : undefined,
                  }}
                >
                  <div
                    style={{
                      width: 40, height: 40, borderRadius: 999, display: "flex",
                      alignItems: "center", justifyContent: "center",
                      background: `color-mix(in oklch, ${meta.color} 18%, transparent)`,
                      color: meta.color, marginBottom: 14,
                    }}
                  >
                    <Icon size={19} aria-hidden="true" />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 17, color: meta.color }}>{meta.label}</div>
                </button>
              );
            })}
          </div>
        </section>

        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

        <div className="actions" style={{ justifyContent: "center" }}>
          <button type="button" className="btn btn-primary" onClick={startQuiz} disabled={isPending}>
            {isPending ? "Loading…" : "Start quiz →"}
          </button>
        </div>
      </main>
    );
  }

  if (!question) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-12">
        <section className="card">
          <h1 className="display">No new questions left</h1>
          <p className="lede">You&apos;ve answered every {difficulty} question in this pool — check back once more are added, or try another difficulty.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
      <div className="topline">
        <span className="datechip">Level: {question.difficulty[0].toUpperCase() + question.difficulty.slice(1)}</span>
        <span className="badge progress">{answeredCount + 1} / {poolTotal}</span>
        {result === null ? (
          <ElapsedTimer
            key={question.id}
            frozen={selected !== null}
            onElapsedChange={(seconds) => {
              elapsedRef.current = seconds;
            }}
          />
        ) : null}
      </div>

      {result === null ? (
        <>
          <header>
            <h1 className="display">{question.questionText}</h1>
          </header>

          <section className="stack">
            <div className="card">
              <div className="cat-grid">
                {question.options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className="cat-btn"
                    aria-pressed={selected === option}
                    onClick={() => {
                      setSelected(option);
                      setAnswerSeconds(elapsedRef.current);
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}

          <div className="actions" style={{ justifyContent: "center" }}>
            <button type="button" className="btn btn-primary" disabled={!selected || isPending} onClick={lockAnswer}>
              {isPending ? "Checking…" : "Lock it"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={nextQuestion}>
              Try another question
            </button>
          </div>
        </>
      ) : (
        <>
          <header className="row-between">
            <div>
              <h1 className="display">{result ? "Correct" : "Not quite"}</h1>
              {answerSeconds !== null ? (
                <p className="lede" style={{ marginTop: 4 }}>
                  Answered in {answerSeconds}s
                </p>
              ) : null}
            </div>
            <div
              aria-label={result ? "Correct" : "Not quite"}
              style={{
                width: 44, height: 44, borderRadius: 999, display: "flex",
                alignItems: "center", justifyContent: "center", flexShrink: 0,
                background: result ? "var(--success-soft)" : "var(--destructive-soft)",
                color: result ? "var(--success)" : "var(--destructive)",
              }}
            >
              {result ? <Check size={24} aria-hidden="true" /> : <X size={24} aria-hidden="true" />}
            </div>
          </header>

          <section className="quote-card stack">
            <span className="card-label">Correct answer: {question.correctAnswer}</span>
            <p className="card-text">{question.explanation}</p>
          </section>

          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={nextQuestion}>
              Try another question
            </button>
          </div>
        </>
      )}
    </main>
  );
}
