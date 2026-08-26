# Adaptive quiz difficulty — design

**Date:** 2026-08-26
**Status:** design approved in conversation; not implemented

## Problem

Difficulty is a single value the user picks once in Settings and never revisits. It
does not respond to how the person is actually performing, so a consultant who has
outgrown Easy keeps getting Easy questions until they think to change a setting they
have probably forgotten exists.

## What this builds

Difficulty that starts where the user puts it and then moves on its own, per quiz
type, based on measured accuracy — plus a guarantee that no person is ever shown the
same question twice.

## Scope

Three quiz types exist, each with its own questions table and its own attempts table:

| Quiz type | Questions table | Attempts table |
|---|---|---|
| Jargon (term-matching) | `daily_quiz_questions` | `jargon_attempts` |
| General MCQ | `general_quiz_questions` | `general_quiz_attempts` |
| Scenario (fixed-answer) | `scenario_quiz_questions` | `scenario_quiz_attempts` |

**Each type tracks its own level independently.** They measure different skills —
knowing what "API" means is not the same as judging whether AI fits a client problem
— so a person may sit at Hard on vocabulary and Medium on judgment. That divergence
is the feature, not a defect.

Out of scope: the solve flow (`solves`), practice cases (`practice_cases`), and
practice frequency.

## Decisions and their reasons

### Not per category

An earlier version of this design adapted difficulty per taxonomy category
(Classification, RAG, Prediction, …). It cannot be built: **no quiz table has a
category column.** The eight categories in `lib/engine/taxonomy.ts` belong to the
solve flow (`solves.guessed_category` / `revealed_category`) and were never attached
to quiz content. Neither user-supplied Excel bank carries a category either.

Content volume rules it out independently: 120 general MCQs split across 8 categories
and 3 tiers leaves ~5 questions per category per tier, far below any usable
evaluation block.

Per-category difficulty becomes possible only if quiz content gains a category
dimension. That is separate future work, not a gap in this design.

### Three tiers, not a continuous score

`easy` / `medium` / `hard`, unchanged. All content is authored and tagged against
these three, and `app/settings/actions.ts` enforces exactly this enum with zod
(added in commit 97e34ca). A finer-grained score would have nothing to route to.

### Accuracy only, not response time

Response time was considered and dropped. The threshold bands below already give
clean, explainable behaviour, and mixing time in makes "why did my level change?"
hard to answer honestly. Time can be revisited later without disturbing this
mechanic; `jargon_attempts.seconds` already records it.

## The mechanic

### Starting level

The user picks Easy/Medium/Hard in Settings. That pick seeds all three quiz levels.
This continues to write `user_settings.practice_difficulty` through the existing
zod-validated `updateSettings` action — no schema or validation change.

### Manual changes always win

Changing the Settings picker **overwrites all three quiz levels** to the new pick and
resets each block counter to zero. Adaptation then resumes from there.

The alternative — leaving already-adapted levels untouched — was considered and
rejected: a user who deliberately selects Hard and still receives Easy questions
reads that as broken.

### Adaptation

After every **10 questions answered** within a quiz type:

| Correct in the last 10 | Result |
|---|---|
| 8 or more (≥80%) | Move up one level |
| 5–7 (50–79%) | Stay |
| 4 or fewer (<50%) | Move down one level |

The counter then resets and the next block begins. Already at Hard scoring ≥80%:
stays at Hard. Already at Easy scoring <50%: stays at Easy.

### No question ever repeats

**A question a user has answered is never shown to that user again.** This is
absolute — it applies within a session, across sessions, and across level changes.

The rule is per user, not global: other users still see the question.

Serving queries exclude any question whose id already appears in that user's rows in
the matching attempts table, in addition to the existing `review_status = 'approved'`
filter.

### Running out of questions

Exhausting a level is itself evidence the person is ready to move on:

- All Easy questions answered → move up to Medium
- All Medium answered → move up to Hard
- All Hard answered → nothing above exists. Show an honest empty state naming what
  happened and pointing to the other two quiz types.

This bump is independent of the 10-question check and can fire mid-block.

## Data model

One new table:

```sql
create table user_quiz_levels (
  user_id uuid not null references auth.users(id) on delete cascade,
  quiz_type text not null check (quiz_type in ('jargon', 'general', 'scenario')),
  level text not null check (level in ('easy', 'medium', 'hard')),
  questions_in_block integer not null default 0,
  correct_in_block integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, quiz_type)
);
```

Rows are created lazily on a user's first attempt in a quiz type, seeded from
`practice_difficulty`, and rewritten whenever the Settings picker changes.

Current level is stored rather than derived. Deriving it from attempt history would
require replaying every past adjustment on each read — expensive and fragile once
thresholds or block size ever change.

## Flow

Recording an attempt, inside the existing per-type `record*Attempt` action:

1. Insert the attempt row (unchanged).
2. Load or create the user's `user_quiz_levels` row for this type.
3. Increment `questions_in_block`; add 1 to `correct_in_block` if correct.
4. If `questions_in_block` has reached 10: apply the threshold table, clamp at the
   ceiling and floor, reset both counters to 0.
5. Persist.

Serving a question:

1. Read the user's current level for this type (falling back to
   `practice_difficulty` when no row exists yet).
2. Query approved questions at that level, excluding ids already in this user's
   attempts.
3. If that returns nothing, bump the level up one step and retry.
4. If already at Hard and nothing remains, return the exhausted empty state.

## Error handling

- A missing `user_quiz_levels` row is normal, not an error: treat as
  `practice_difficulty` with an empty block.
- Level adjustment must never block recording an attempt. If step 2–5 fails, the
  attempt insert still stands and the level simply does not move this time.
- An out-of-range stored level (possible only through direct DB edits) falls back to
  `medium` rather than throwing.

## Testing

- Threshold boundaries: 7 correct stays, 8 moves up, 5 stays, 4 moves down.
- Ceiling and floor: 10/10 at Hard stays Hard; 0/10 at Easy stays Easy.
- Counter resets to 0 after exactly 10, and a partial block carries over between
  sessions.
- An answered question never reappears, including immediately after a level change.
- Exhausting a level bumps up; exhausting Hard returns the empty state.
- Changing the Settings picker rewrites all three levels and zeroes all counters.
- Each quiz type's level moves independently of the other two.

## Known dependency, not solved here

Static banks plus an absolute no-repeat rule means the pool is finite: roughly 250
questions across all three quizzes. A person practising daily exhausts everything in
a few weeks, after which the empty state is all that remains.

`lib/jargon-pipeline` and `lib/content-pipeline` were built to generate new questions
daily (~120/day target) and would keep the pool ahead of consumption — but the app is
not deployed, so the `vercel.json` cron jobs have never run. Deploying is what makes
this design sustainable. It is separate work and does not block implementation.
