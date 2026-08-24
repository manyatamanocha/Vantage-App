# Practice Content Pipeline — Design

Date: 2026-08-24
Status: Approved (via superpowers:brainstorming)
Source: session discussion following a review of how `practice_cases` is currently sourced (see `Downloads\Obsidian sync projects\Scribble World\My Scribbles - Vantage\session log 2026-08-24 - eval, guardrails, perf fix.md`)

## Problem

`practice_cases` — the pool the daily-practice loop draws from — contains exactly 11 rows, all hand-written once in `supabase/migrations/0004_seed_practice_cases.sql`. There is no ongoing way for new practice content to arrive short of writing another SQL migration by hand. This design adds a real, ongoing content pipeline.

## Non-goal, stated explicitly

This is **not** about pre-computing or storing "the correct answer" for a practice case. `submitPracticeGuess` (`app/practice/today/actions.ts`) already calls `recommendCategory()` live, every time a user plays a case — nothing about that changes. The pipeline only ever writes `raw_input` / `industry` / `difficulty`, the same three columns the seed migration wrote. The category a candidate was generated *for* is a generation-time label used to steer diversity and to sanity-check the candidate — it is never persisted.

## Architecture

New module `lib/content-pipeline/`, extending the existing `lib/engine/` pattern (one focused Groq call per file, own validation, independently testable) rather than inventing a different shape:

- **`generate-cases.ts`** — one Groq call (JSON mode, same pattern as `structure.ts`) requesting a batch of candidates spread across the taxonomy and difficulty levels. Each candidate carries the category/difficulty it was generated for.
- **`dedupe.ts`** — pure function; a lightweight token-overlap similarity check against existing `practice_cases.raw_input` rows and against the rest of the current batch. No embeddings, no new external API — consistent with the "no paid services" constraint already stated in `PRODUCT.md`.
- **`validate-candidate.ts`** — for each surviving candidate: runs `assertNoNamedProducts` (existing guardrail, `lib/engine/guardrails.ts`), then calls the real `recommendCategory()` with the candidate's text as both `goal` and `problemType` (the same substitution `submitPracticeGuess` already makes). Rejects the candidate if `recommendCategory` throws, or if its `revealedCategory` doesn't match the label the candidate was generated for (signal: the scenario is ambiguous, not that the label was "wrong").
- **`run-pipeline.ts`** — orchestrates generate → dedupe → validate → insert, and returns a summary of counts.
- **`lib/supabase/admin.ts`** (new) — a service-role Supabase client. Required because `practice_cases` has only a `select` RLS policy (verified against all four migrations) — writing to it needs the service-role key, the same way the existing integration tests and the original seed migration do. This pipeline runs outside any user's request/session, so it cannot use the existing cookie-scoped `getSupabaseServerClient()`.

## Data flow

1. `generate-cases.ts` requests a batch (default: one candidate per taxonomy category, 8 total).
2. `dedupe.ts` drops near-duplicates (against existing rows and within the batch).
3. `validate-candidate.ts` drops candidates that trip the guardrail or whose live-recomputed category disagrees with their generation-time label.
4. Survivors are inserted into `practice_cases` (`raw_input`, `industry`, `difficulty` only) via the admin client.
5. `run-pipeline.ts` returns `{ generated, rejectedDuplicate, rejectedValidation, inserted }`.

## Trigger — decided 2026-08-24 (amendment)

Vercel Cron, running daily, calling a new route `app/api/cron/generate-practice-cases/route.ts` that invokes `run-pipeline.ts`. Target batch size: ~100 candidates/day, spread ~33/33/34 across Easy/Medium/Hard (in addition to the existing spread across taxonomy category). If a day's run produces fewer usable candidates than expected (heavy dedupe/validation rejection), the daily-practice loop simply has a smaller-than-usual pool to draw from that day — no special handling needed, since `practice_cases` accumulates across days rather than being replaced daily.

## Human review layer (amendment)

Reuses the shared `/admin/quiz-review` page (see the sibling jargon-pipeline spec) to list each day's newly inserted `practice_cases` rows alongside the jargon pool. A `flagged` boolean column is added to `practice_cases`; flagging a row excludes it from being served by the daily-practice loop (`app/practice/today/actions.ts` query adds `.eq('flagged', false)`) without deleting it, and excludes its `raw_input` from `dedupe.ts`'s "existing rows" comparison going forward (a flagged case shouldn't seed close paraphrases either). No pipeline change needed beyond the new column and the query filter — flagging is a manual, asynchronous action, never blocking on it before serving.

## Error handling

- A failed generation call fails the whole run — nothing partial is inserted. Reuses the existing `withRetry` (`lib/engine/with-retry.ts`).
- A single candidate failing dedupe or validation is routine, not an error — filtered out the same way `reveal.ts` already drops off-taxonomy alternatives without failing the call. The batch continues.
- A single candidate's insert failing is logged and skipped; it does not roll back the others — each candidate is independent content.
- No "only if the table is empty" guard (unlike the seed migration) — this pipeline is meant to run repeatedly over time; the dedupe step is what prevents repeats, not an empty-table check.

## Testing

Mirrors the existing `lib/engine/__tests__/*` convention (mocked Groq client, shape validators):

- `generate-cases.test.ts` — mocked Groq responses; shape, truncation handling, prompt requests taxonomy-spanning variety.
- `dedupe.test.ts` — pure function; near-duplicate phrasing vs. genuinely different scenarios, plus intra-batch duplicates.
- `validate-candidate.test.ts` — mocks `recommendCategory` (same pattern as `app/practice/today/__tests__/actions.test.ts`); category-mismatch rejection and guardrail-violation rejection.
- `run-pipeline.test.ts` — mocks the three stages above plus the admin client (hand-rolled mock, same style as the other actions tests); orchestration order, insert payload shape, summary counts, and that a rejected candidate never reaches insert.
- `lib/supabase/admin.ts` — no dedicated unit test, same as `lib/supabase/server.ts` today.
- One `INTEGRATION=1`-gated test (mirroring `guess-then-reveal.test.ts`): a real `run-pipeline()` call against real Groq + real Supabase, cleaning up its inserted row(s) in `afterAll`. Called out specifically because this pipeline writes shared content everyone sees, not user-scoped data — a higher blast radius than the rest of the app justifies one real end-to-end check before it's ever run on a schedule.

## Open items carried forward (not resolved by this spec)

- Which scheduling mechanism (Vercel Cron / Supabase `pg_cron` / other) — deferred until the app is actually deployed.
- Batch size and generation cadence (how many candidates per run, how often) — not fixed here; can start conservative and adjust once real acceptance/rejection rates from `validate-candidate.ts` are observed.
- No target-count-per-category/difficulty logic in v1 — each run generates a flat spread across the taxonomy rather than filling observed gaps. Worth revisiting once the pool is larger.
