# General & scenario quiz content pipelines — design

**Date:** 2026-08-26
**Status:** design approved in conversation; not implemented

## Problem

`general_quiz_questions` (120 rows) and `scenario_quiz_questions` (90 rows) were
seeded once, by hand, from two Excel files the user supplied
(`Tech_AI_MCQ_Quiz_120Q.xlsx`, `Vantage_90_Scenario_Questions.xlsx` — migration
`0011`). Nothing generates more. Combined with the no-repeat rule in
[2026-08-26-adaptive-difficulty-design.md](2026-08-26-adaptive-difficulty-design.md),
a person practising daily exhausts both banks in a few weeks.

Separately, both tables bypass the review gate `0009_review_status.sql` built for
`daily_quiz_questions` / `practice_cases`: they only have `flagged`, and their
serving queries only check `flagged = false`. Any row inserted — by a pipeline or
otherwise — would go live to real users with no human check, the exact bug `0009`
was written to close, reopened in two new tables that came after it.

## What this builds

Two new Groq pipelines, one per table, generating fresh questions daily — plus the
review gate both tables are missing, so the new pipelines don't ship content
unchecked.

## Scope

In scope: `general_quiz_questions`, `scenario_quiz_questions`.

Out of scope: `daily_quiz_questions` (jargon) — already has a working pipeline
(`lib/jargon-pipeline`), untouched here. `practice_cases` — already has its own
pipeline (`lib/content-pipeline`, referenced in prior handoffs), untouched here.

## Volume

**20 questions per difficulty tier per table per day** — 60/day for
`general_quiz_questions`, 60/day for `scenario_quiz_questions`, 120/day combined.

Not "per category": neither table has a category column, and adding one was
explicitly declined for this work (mirrors the same decision in the adaptive
difficulty spec). Difficulty tier is the only dimension these pipelines generate
against.

## Pipeline shape

Each pipeline mirrors `lib/jargon-pipeline`'s existing four-file structure:

```
lib/general-quiz-pipeline/
  generate-questions.ts
  dedupe.ts
  validate-question.ts
  run-pipeline.ts
lib/scenario-quiz-pipeline/
  generate-questions.ts
  dedupe.ts
  validate-question.ts
  run-pipeline.ts
```

### generate-questions.ts

One Groq call per tier (three calls per pipeline run, 20 questions each) rather than
one call for all 60 — keeps each response small enough to stay reliable, matching why
`lib/jargon-pipeline` already splits by tier internally.

The prompt for each call:
- States the persona constraint already established in PRODUCT.md and the jargon
  pipeline's own prompt: a non-technical, client-facing consultant, not an ML
  engineer — same forbidden-terms framing (no backpropagation, gradient descent,
  regularization, etc.) applies to the general-knowledge quiz for the same reason it
  applies to jargon.
- Embeds 5 of that table's own existing `approved` questions at the requested tier as
  style examples, so new questions match established voice and format rather than
  drifting into generic AI-quiz phrasing. Pulled fresh each call, not hardcoded.
- For `general_quiz_questions`: requests MCQ shape — `difficulty`, `questionText`,
  exactly four distinct `options` (`optionA`–`optionD`), `correctAnswer` copied
  exactly from `options`, plain-language `explanation` for the correct answer, plus
  one plain-language `whyWrong` explanation per incorrect option (see schema change
  below — restores the original Excel's per-option feedback rather than flattening
  it).
- For `scenario_quiz_questions`: requests `difficulty`, `questionText` (a workplace
  scenario), `answer` (the AI action that addresses it), `explanation` (plain-language
  why). Matches that table's columns exactly.

### dedupe.ts

Same word-overlap similarity check as `lib/jargon-pipeline/dedupe.ts`, keyed on
`questionText` alone — neither table has a `term` field to also key on.

### validate-question.ts

- General: difficulty is a valid enum value; exactly four options; all four distinct;
  `correctAnswer` is exactly one of `options`; `questionText` and `explanation`
  non-empty; exactly three `whyWrong` entries (one per incorrect option), each
  non-empty and keyed to a specific wrong option (not the correct one).
- Scenario: difficulty is a valid enum value; `questionText`, `answer`, `explanation`
  all non-empty.

### run-pipeline.ts

Per tier: generate → fetch that table's existing `approved` `questionText`s → dedupe
→ validate → insert surviving candidates with `review_status: 'pending'`. Returns
`{ generated, rejectedDuplicate, rejectedValidation, inserted }` per tier, matching
`runJargonPipeline`'s existing return shape.

## Schema change: restore per-wrong-answer feedback

`general_quiz_questions` currently has one `explanation` column, covering only the
correct answer. The source Excel (`Tech_AI_MCQ_Quiz_120Q.xlsx`) carried a separate
"why is this wrong" explanation for each of the three incorrect options — that
richness was flattened away when migration `0011` created the table with a single
column. Rather than continue that loss into every future generated question, this
adds it back.

`supabase/migrations/0012_general_quiz_why_wrong.sql`:

```sql
alter table general_quiz_questions add column why_wrong jsonb;
-- shape: {"<wrong option text>": "why it's wrong", ...} — one entry per incorrect option.
```

Nullable, not `not null`: the 90 `scenario_quiz_questions` rows have no options to
explain, so this column only applies to `general_quiz_questions`.

**Backfill:** the original Excel file already has this data (`Why A Is Wrong` /
`Why B Is Wrong` / `Why C Is Wrong` / `Why D Is Wrong` columns). A one-off backfill
script reads `Tech_AI_MCQ_Quiz_120Q.xlsx` again, matches each of the 120 existing
rows by `question_text`, and populates `why_wrong` for them — so the original,
richer content is restored rather than left permanently thinner than its source.

**UI change:** `app/practice/general/general-quiz-session.tsx` currently shows only
`question.explanation` after answering (line 199). This adds: when the user picked a
wrong option, also show that option's own `why_wrong` entry alongside the existing
correct-answer explanation — matching what the original Excel actually offered.
`app/practice/general/actions.ts` adds `why_wrong` to its `select(...)` and response
shape.

## Review gate (new migration)

`supabase/migrations/0013_general_scenario_review_status.sql`, mirroring `0009`:

```sql
alter table general_quiz_questions add column review_status text not null default 'pending'
  check (review_status in ('pending', 'approved', 'rejected'));
alter table scenario_quiz_questions add column review_status text not null default 'pending'
  check (review_status in ('pending', 'approved', 'rejected'));

update general_quiz_questions set review_status = case when flagged then 'rejected' else 'approved' end;
update scenario_quiz_questions set review_status = case when flagged then 'rejected' else 'approved' end;
```

The existing 210 hand-written rows are backfilled to `approved` — they're already
live and already reviewed by the user directly (they supplied the source Excel).

**Serving queries updated:**
- `app/practice/general/actions.ts` — add `.eq("review_status", "approved")` alongside
  the existing `.eq("flagged", false)`.
- `app/practice/scenario-quiz/actions.ts` — same.

**`/admin/quiz-review` updated** to add two more pending queues (Tech & AI MCQ,
Scenario) using the same `ReviewButtons` component and `setStatus` action already
built for jargon/practice-cases, extended to accept the two new table names. Already
protected by `requireAdmin()` (added earlier this session) — no separate auth work
needed here.

## Scheduling

Two new cron routes, matching the existing jargon one exactly:

```
app/api/cron/generate-general-quiz-questions/route.ts
app/api/cron/generate-scenario-quiz-questions/route.ts
```

Added to `vercel.json`:

```json
{ "path": "/api/cron/generate-general-quiz-questions", "schedule": "0 3 * * *" },
{ "path": "/api/cron/generate-scenario-quiz-questions", "schedule": "30 3 * * *" }
```

Both are inert until the app is actually deployed to Vercel — same standing gap as
the existing jargon/practice-case cron jobs (see the adaptive-difficulty spec's
"Known dependency" section). Locally, each route can be hit by hand to test.

## Error handling

- A Groq call failing for one tier must not block the other two tiers in the same
  run — each tier's generate/dedupe/validate/insert is independent; `run-pipeline.ts`
  catches per-tier and continues, reporting the failure in that tier's result rather
  than throwing for the whole run.
- Zero valid candidates after validation is not an error — return `inserted: 0` for
  that tier and move on; the cron route's response reflects it, nothing throws.

## Testing

- `validate-question.ts` for both types: rejects mismatched `correctAnswer`,
  duplicate/fewer-than-four options, empty required fields, invalid difficulty,
  and (general only) a `whyWrong` set that's missing an entry, has more than three
  entries, or keys an entry to the correct option instead of a wrong one.
- Backfill script: matches all 120 existing rows by `question_text` and populates
  `why_wrong` for each; a row with no match in the Excel is left untouched and
  logged, not silently skipped.
- General quiz UI: picking a wrong option shows that option's own `why_wrong` text
  alongside the existing correct-answer explanation; picking the correct option
  shows only the correct-answer explanation, unchanged from today.
- `dedupe.ts`: exact `questionText` match rejected; near-duplicate (high
  word-overlap) rejected; genuinely different question kept.
- `run-pipeline.ts`: inserted rows carry `review_status: 'pending'`; a failing tier
  doesn't prevent the other two tiers' rows from being inserted.
- Serving queries: a `pending` row is never returned to `/practice/general` or
  `/practice/scenario-quiz`; an `approved` row is.
- `/admin/quiz-review`: new pending rows from both tables appear in their own
  queues; Approve/Reject updates `review_status` and the row leaves the pending list.

## Known dependency, shared with the adaptive-difficulty spec

Cron schedules only fire once the app is deployed. Until then, these pipelines exist
and work when triggered manually, but the daily 120-question target is not actually
being met in production. Deployment is separate work and does not block building
this.
