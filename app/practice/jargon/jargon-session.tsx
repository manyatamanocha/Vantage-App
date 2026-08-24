"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Clock3, Star } from "lucide-react";
import type { JargonQuestion } from "./actions";
import { getJargonQuestions, rateJargonAttempt, recordJargonAttempt } from "./actions";
import { EndingCard } from "@/components/ending-card";

const RING = 2 * Math.PI * 54;
const TIERS = ["easy", "medium", "hard"] as const;

export function JargonSession() {
  const [difficulty, setDifficulty] = useState<(typeof TIERS)[number]>("medium");
  const [questions, setQuestions] = useState<JargonQuestion[] | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<boolean | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [stoppedAt, setStoppedAt] = useState<number | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [openTerm, setOpenTerm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const question = questions?.[index] ?? null;

  useEffect(() => {
    if (startedAt === null || stoppedAt !== null) return;
    const timer = window.setInterval(() => setSeconds((Date.now() - startedAt) / 1000), 100);
    return () => window.clearInterval(timer);
  }, [startedAt, stoppedAt]);

  const progress = useMemo(() => Math.min((seconds % 8) / 8, 1), [seconds]);

  function startQuiz() {
    setError(null);
    startTransition(async () => {
      try {
        const loaded = await getJargonQuestions(difficulty);
        setQuestions(loaded);
        setIndex(0);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load today's quiz.");
      }
    });
  }

  function lockAnswer() {
    if (!selected || isPending || result !== null || !question) return;
    const answerSeconds = startedAt === null ? null : stoppedAt ? (stoppedAt - startedAt) / 1000 : seconds;
    if (startedAt !== null && stoppedAt === null) setStoppedAt(Date.now());
    startTransition(async () => {
      try {
        const response = await recordJargonAttempt({ questionId: question.id, selectedAnswer: selected, seconds: answerSeconds });
        setAttemptId(response.attemptId ?? null);
        setResult(response.correct);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save your answer.");
      }
    });
  }

  function nextQuestion() {
    setIndex((value) => (questions ? (value + 1) % questions.length : 0));
    setSelected(null);
    setResult(null);
    setRating(0);
    setAttemptId(null);
    setStartedAt(null);
    setStoppedAt(null);
    setSeconds(0);
    setOpenTerm(null);
  }

  function setHelpful(value: number) {
    setRating(value);
    if (attemptId) startTransition(() => rateJargonAttempt(attemptId, value).catch(() => undefined));
  }

  // Launcher: pick a difficulty before the pool is fetched, mirroring the
  // mockup's "Quiz of the day" screen (8) — the picker actually drives which
  // pool is served, not cosmetic.
  if (!questions) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
        <div className="topline">
          <span className="datechip">Daily quiz</span>
        </div>
        <header>
          <h1 className="display">Quiz of the day</h1>
          <p className="lede">Pick a difficulty, then match each term to its plain-language meaning.</p>
        </header>
        <section className="stack">
          <div className="field">
            <span>Difficulty</span>
            <div className="segmented" role="group" aria-label="Quiz difficulty">
              {TIERS.map((tier) => (
                <button
                  key={tier}
                  type="button"
                  aria-pressed={difficulty === tier}
                  onClick={() => setDifficulty(tier)}
                >
                  {tier[0].toUpperCase() + tier.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </section>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={startQuiz} disabled={isPending}>
            {isPending ? "Loading…" : "Get started"}
          </button>
        </div>
      </main>
    );
  }

  if (!question) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-12">
        <section className="card">
          <h1 className="display">No quiz questions yet</h1>
          <p className="lede">Nothing seeded at {difficulty} difficulty yet — check back after today&apos;s quiz is generated.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
      <div className="topline">
        <span className="datechip">{question.difficulty} · Daily quiz</span>
        <span className="badge progress">{index + 1} / {questions.length}</span>
      </div>

      {result === null ? (
        <>
          <header className="row-between">
            <div>
              <h1 className="display">What does {question.term} mean?</h1>
              <p className="lede">Choose the clearest definition.</p>
            </div>
            <button
              type="button"
              className="quiz-ring-btn"
              aria-label={startedAt === null ? "Start timer" : stoppedAt === null ? "Stop timer" : "Timer stopped"}
              onClick={() => (startedAt === null ? setStartedAt(Date.now()) : stoppedAt === null ? setStoppedAt(Date.now()) : undefined)}
            >
              <svg className="quiz-ring-svg" viewBox="0 0 120 120" aria-hidden="true">
                <circle className="quiz-ring-track" cx="60" cy="60" r="54" />
                <circle
                  className="quiz-ring-progress"
                  cx="60"
                  cy="60"
                  r="54"
                  style={{ strokeDasharray: RING, strokeDashoffset: RING * (1 - progress) }}
                />
              </svg>
              <span className="quiz-ring-center">
                {startedAt === null ? <Clock3 size={18} /> : <span className="quiz-ring-num">{seconds.toFixed(1)}s</span>}
                <span className="quiz-ring-label">{startedAt === null ? "Start" : "Thinking time"}</span>
              </span>
            </button>
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
                    onClick={() => setSelected(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}

          <div className="actions">
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
          <header>
            <span className={`badge ${result ? "matched" : "missed"}`}>{result ? "Correct" : "Not quite"}</span>
            <h1 className="display">{question.term}</h1>
            <p className="lede">{question.explanation}</p>
          </header>

          <section className="quote-card stack">
            <span className="card-label">What does this mean?</span>
            <p className="card-text">{question.explanation}</p>
          </section>

          <section className="card stack">
            <span className="card-label">Was this helpful?</span>
            <div className="actions">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  className="btn btn-icon"
                  aria-label={`${value} stars`}
                  aria-pressed={rating === value}
                  onClick={() => setHelpful(value)}
                >
                  <Star fill={rating >= value ? "currentColor" : "none"} />
                </button>
              ))}
            </div>
          </section>

          <section aria-label="All terms in this quiz" className="card">
            <span className="card-label">Explore all terms</span>
            {questions.map((q) => (
              <details key={q.id} open={openTerm === q.term} onToggle={(e) => e.currentTarget.open && setOpenTerm(q.term)}>
                <summary className="toggle-row">
                  <span className="label">{q.term}</span>
                </summary>
                <p className="card-text">{q.explanation}</p>
              </details>
            ))}
          </section>

          <EndingCard
            explainMore={question.explanation}
            example={`${question.questionText} → ${question.correctAnswer}`}
            followupPlaceholder="e.g. How is this different from a related term?"
          />

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
