"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Brain, Check, Clock3, FileText, Leaf, Star, X, Zap } from "lucide-react";
import type { JargonQuestion } from "./actions";
import { getJargonQuestions, rateJargonAttempt, recordJargonAttempt } from "./actions";
import { EndingCard } from "@/components/ending-card";

const RING = 2 * Math.PI * 54;
const TIERS = ["easy", "medium", "hard"] as const;

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return hash;
}

const TIER_META: Record<(typeof TIERS)[number], {
  label: string;
  color: string;
  icon: typeof Leaf;
  description: string;
  whatYouGet: string;
  time: string;
}> = {
  easy: {
    label: "Easy",
    color: "var(--success)",
    icon: Leaf,
    description: "Covers basic AI terms and ideas in simple situations.",
    whatYouGet: "Clear explanations of fundamental concepts.",
    time: "~3 min",
  },
  medium: {
    label: "Medium",
    color: "var(--primary)",
    icon: Zap,
    description: "Includes real-world scenarios and practical applications.",
    whatYouGet: "Context-based questions to test your understanding.",
    time: "~5 min",
  },
  hard: {
    label: "Hard",
    color: "#F59E0B",
    icon: Brain,
    description: "Focuses on advanced concepts and tricky real-world problems.",
    whatYouGet: "Complex questions that challenge your AI thinking.",
    time: "~7 min",
  },
};

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

  const progress = useMemo(() => Math.min(seconds / 60, 1), [seconds]);

  // The quiz asks "Which term means: [definition]?" with term names as the
  // answer options — distractor terms are drawn from this session's own
  // loaded pool (same difficulty tier) rather than invented, so they're
  // always real terms a consultant might plausibly confuse this one with.
  //
  // Ordering is a deterministic hash-based shuffle, not Math.random() — a
  // render must stay pure (idempotent for the same inputs), and a random
  // reorder on every re-render would make the options visibly reshuffle
  // whenever unrelated state (e.g. the timer) triggers a render.
  const termOptions = useMemo(() => {
    if (!question || !questions) return [];
    const otherTerms = [...new Set(questions.map((q) => q.term).filter((term) => term !== question.term))];
    const seed = question.id;
    const byHash = (a: string, b: string) => hashString(seed + a) - hashString(seed + b);
    const distractors = [...otherTerms].sort(byHash).slice(0, 3);
    return [question.term, ...distractors].sort(byHash);
  }, [question, questions]);

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
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
        <div className="topline">
          <span className="datechip">Daily quiz</span>
        </div>
        <header>
          <h1 className="display">Quiz of the day</h1>
          <p className="lede">Pick a difficulty level and test your understanding of AI concepts.</p>
        </header>

        <section className="stack">
          <span className="card-label">Choose your difficulty</span>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {TIERS.map((tier) => {
              const meta = TIER_META[tier];
              const Icon = meta.icon;
              const selected = difficulty === tier;
              return (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setDifficulty(tier)}
                  aria-pressed={selected}
                  className="card"
                  style={{
                    textAlign: "left",
                    cursor: "pointer",
                    borderColor: selected ? meta.color : undefined,
                    boxShadow: selected ? `0 0 0 1px ${meta.color}` : undefined,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 999,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: `color-mix(in oklch, ${meta.color} 18%, transparent)`,
                      color: meta.color,
                      marginBottom: 14,
                    }}
                  >
                    <Icon size={19} aria-hidden="true" />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 17, color: meta.color, marginBottom: 6 }}>
                    {meta.label}
                  </div>
                  <p className="card-text" style={{ color: "var(--muted-foreground)" }}>
                    {meta.description}
                  </p>
                  <div style={{ borderTop: "1px solid var(--border)", margin: "14px 0" }} />
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 10 }}>
                    <FileText size={14} style={{ marginTop: 2, flexShrink: 0, color: meta.color }} aria-hidden="true" />
                    <div>
                      <div style={{ fontWeight: 650, fontSize: 13 }}>What you&apos;ll get:</div>
                      <p className="card-text" style={{ color: "var(--muted-foreground)" }}>{meta.whatYouGet}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--muted-foreground)" }}>
                    <Clock3 size={13} aria-hidden="true" /> {meta.time}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

        <div className="actions" style={{ justifyContent: "center", flexDirection: "column", alignItems: "center" }}>
          <button type="button" className="btn btn-primary" onClick={startQuiz} disabled={isPending}>
            {isPending ? "Loading…" : "Start quiz →"}
          </button>
          <p className="card-text" style={{ marginTop: 8, color: "var(--muted-foreground)", fontSize: 13 }}>
            You can change the difficulty anytime.
          </p>
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
        <span className="datechip">Level: {question.difficulty[0].toUpperCase() + question.difficulty.slice(1)}</span>
        <span className="badge progress">{index + 1} / {questions.length}</span>
      </div>

      {result === null ? (
        <>
          <header className="row-between">
            <div>
              <h1 className="display">Which term means: {question.correctAnswer}?</h1>
              <p className="lede">Choose the term that fits.</p>
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
                {termOptions.map((term) => (
                  <button
                    key={term}
                    type="button"
                    className="cat-btn"
                    aria-pressed={selected === term}
                    onClick={() => setSelected(term)}
                  >
                    {term}
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
            <h1 className="display">{question.term}</h1>
            <div
              aria-label={result ? "Correct" : "Not quite"}
              style={{
                width: 44,
                height: 44,
                borderRadius: 999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                background: result ? "var(--success-soft)" : "var(--destructive-soft)",
                color: result ? "var(--success)" : "var(--destructive)",
              }}
            >
              {result ? <Check size={24} aria-hidden="true" /> : <X size={24} aria-hidden="true" />}
            </div>
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
            {questions.map((q, i) => (
              <details
                key={q.id}
                open={openTerm === q.term}
                onToggle={(e) => e.currentTarget.open && setOpenTerm(q.term)}
                style={i > 0 ? { borderTop: "1px solid var(--border)" } : undefined}
              >
                <summary className="toggle-row">
                  <span className="label">{q.term}</span>
                </summary>
                <p className="card-text" style={{ paddingBottom: 16 }}>{q.explanation}</p>
              </details>
            ))}
          </section>

          <EndingCard
            variant="minimal"
            explainMore={question.explanation}
            example={`${question.questionText} → ${question.correctAnswer}`}
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
