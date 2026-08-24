# Daily Jargon Quiz Pipeline — Design

Date: 2026-08-24
Status: Approved (via superpowers:brainstorming)
Source: session discussion continuing from the Vantage screen-deck quiz mechanic (see `Downloads\Obsidian sync projects\Scribble World\My Scribbles - Vantage\Wireframes\UI Design Log.md`)
Sibling spec: `2026-08-24-practice-content-pipeline-design.md` (the "scenario" half of the same daily-content decision; shares the trigger pattern and the review/flag page with this spec)

## Problem

The Vantage screen-deck artifact has a jargon-matching quiz mode (term → pick the correct plain-language definition from 4 options), but it's a hand-written static bank of 6 questions and has never existed in the real `vantage-app` codebase — no table, no generation, no UI route. This design brings that quiz mode into the real app, backed by daily Groq-generated content instead of a static bank.

## Non-goal, stated explicitly

This is not the scenario/category-guess quiz — that's `practice_cases`, covered by the sibling spec. This pipeline only ever produces jargon-definition multiple-choice questions (term, question text, 4 options, one correct answer, a plain-language explanation). It does not call `recommendCategory()` and has no taxonomy-category concept.

## Architecture

New module `lib/jargon-pipeline/`, following the same shape as `lib/content-pipeline/` (one focused Groq call per file, own validation, independently testable):

- **`generate-questions.ts`** — one Groq call (JSON mode, same pattern as `structure.ts`) requesting a batch of jargon questions spread across difficulty tiers. Each question: `term`, `question_text`, 4 `options`, `correct_answer` (must be one of the 4 options), `explanation`.
- **`dedupe.ts`** — pure function; token-overlap similarity check against existing `daily_quiz_questions` rows (recent days) and against the rest of the current batch, reusing the same lightweight approach as `lib/content-pipeline/dedupe.ts` rather than inventing a second technique.
- **`validate-question.ts`** — for each candidate: runs `assertNoNamedProducts` (existing guardrail, `lib/engine/guardrails.ts`) against `question_text`, each option, and `explanation`; plus a shape check — exactly 4 distinct options, `correct_answer` present verbatim among them, `explanation` non-empty.
- **`run-pipeline.ts`** — orchestrates generate → dedupe → validate → insert, returns `{ generated, rejectedDuplicate, rejectedValidation, inserted }` (same summary shape as the sibling pipeline for consistency).
- Reuses `lib/supabase/admin.ts` (service-role client) from the sibling spec rather than creating a second one — `daily_quiz_questions` gets the same `select`-only RLS policy as `practice_cases`, so writes need the service-role key here too.

## Data model

New table `daily_quiz_questions`:

| column | type | notes |
|---|---|---|
| `id` | uuid, pk | |
| `pool_date` | date | the day this question was generated for |
| `difficulty` | text | `easy` \| `medium` \| `hard` |
| `term` | text | the jargon term being tested |
| `question_text` | text | |
| `options` | jsonb | array of 4 strings |
| `correct_answer` | text | must match one of `options` |
| `explanation` | text | plain-language, 5th-grade-level (matches existing reveal-screen tone) |
| `flagged` | boolean | default `false` |
| `created_at` | timestamptz | default `now()` |

## Trigger — revised 2026-08-24

Vercel Cron, daily, calling `app/api/cron/generate-quiz-questions/route.ts` → `run-pipeline.ts`. Target: ~120 questions/day, ~40/40/40 split across Easy/Medium/Hard. Revised up from the original 100/day figure as part of a combined ~240/day target split evenly with the sibling scenario pipeline (see that spec's own Trigger section).

**Fallback on a bad day:** the quiz-serving query (see below) always selects from the most recent `pool_date` that has at least one unflagged row per requested difficulty, not strictly "today." A failed or thin cron run means the app quietly keeps serving the last good day's pool instead of showing a broken or empty quiz.

## Serving the quiz (new UI)

- Practice launcher (screen 9 equivalent, `app/practice/today/`) gains a mode choice: Jargon quiz vs. Scenario quiz (scenario = existing `practice_cases` flow, unchanged). Difficulty picker (Easy/Medium/Hard) applies to both modes.
- New route/action for the jargon mode queries `daily_quiz_questions` filtered by `difficulty`, `flagged = false`, and the latest available `pool_date`, mirroring `submitPracticeGuess`'s existing pattern for reading `practice_cases`.
- Quiz screen keeps the existing "Try another question" (cycles within the filtered pool) and "Lock it" (records the attempt) behavior.
- **Timer:** the plain "Xs" text timer is replaced with the circular-ring timer design from the reference mockup (`Downloads\time.png`, option 1 of 5 explored) — a progress ring showing "X.Xs THINKING TIME" plus a short encouragement line (e.g. "Nice and quick!"), captured on lock, same underlying `quizStartMs`/`answerSeconds` mechanism as the current artifact.

## Human review layer (shared with the sibling pipeline)

- New page `app/admin/quiz-review/page.tsx` (or equivalent route), gated behind the existing login — single-user app, no separate auth needed.
- Lists today's `daily_quiz_questions` (grouped by difficulty) and today's new `practice_cases` rows (from the sibling pipeline) on one page, each with a **Flag** button.
- Flagging sets `flagged = true` via a server action; flagged rows stay visible, greyed out, tagged "Flagged — excluded," and are immediately excluded from being served (query filter) and from future dedupe comparison (a flagged item shouldn't seed near-duplicates either).
- No blocking review step — guardrail-passed questions go live the moment the cron job inserts them; review is a manual, asynchronous cleanup pass, not a gate.

## Error handling

Mirrors the sibling spec: a failed generation call fails the whole run, nothing partial inserted (reuse `withRetry`); a single candidate failing dedupe/validation is routine and filtered out, not an error; a single insert failure is logged and skipped without rolling back the rest.

## Testing

Mirrors `lib/content-pipeline/__tests__/*`:

- `generate-questions.test.ts` — mocked Groq responses; shape validation, difficulty-tier spread in the prompt.
- `dedupe.test.ts` — near-duplicate phrasing vs. genuinely different questions, intra-batch duplicates.
- `validate-question.test.ts` — guardrail-violation rejection, malformed-options rejection (wrong count, `correct_answer` not among options).
- `run-pipeline.test.ts` — mocks the three stages plus the admin client; orchestration order, insert payload shape, summary counts.
- One `INTEGRATION=1`-gated test (same pattern as `guess-then-reveal.test.ts`): a real `run-pipeline()` call against real Groq + real Supabase, cleaning up inserted rows in `afterAll`.
- New test for the serving query: latest-available-`pool_date`-with-unflagged-rows fallback logic, including the "today's pool is thin/empty, fall back to yesterday" case.

## Open items carried forward

- Migration file for `daily_quiz_questions` (schema above) and the `flagged` column added to `practice_cases` (per the sibling spec's amendment) — needed before implementation, not written as part of this design doc.
- Exact wording/visual polish of the circular timer's encouragement copy (only "Nice and quick!" seen in the reference mockup) — can vary by response time bucket, left to implementation/impeccable-skill polish rather than fixed here.
- No retention/cleanup policy yet for old `daily_quiz_questions` rows (the table grows by ~120/day indefinitely) — not blocking for v1, worth revisiting once real usage data exists.
