# General & Scenario Quiz Pipelines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `general_quiz_questions` and `scenario_quiz_questions` daily Groq-generated content (20/tier/day each), close the review-gate hole both tables currently have, and restore the per-wrong-answer feedback the original Excel import flattened away.

**Architecture:** Two new self-contained pipeline directories (`lib/general-quiz-pipeline/`, `lib/scenario-quiz-pipeline/`) mirroring the existing `lib/jargon-pipeline/` shape exactly (generate → dedupe → validate → insert-as-pending), each driven by its own cron route. A schema migration adds `review_status` to both tables (mirroring migration `0009`) and a second migration adds a `why_wrong` field to `general_quiz_questions` only, backfilled from the original Excel via a one-off script.

**Tech Stack:** Next.js server actions, Supabase (Postgres + PostgREST), Groq SDK (`openai/gpt-oss-120b`), Vitest.

**Spec:** `docs/superpowers/specs/2026-08-26-general-scenario-quiz-pipelines-design.md`

## Global Constraints

- Volume: 20 questions per difficulty tier per table per day (60/day per table, 120/day combined) — not per-category; neither table has a category column.
- Every pipeline-inserted row starts `review_status: 'pending'`. Nothing reaches a real user until a human approves it at `/admin/quiz-review`.
- Dedup is keyed on `question_text` alone (no `term` field on these tables) using the existing word-overlap `similarity()` approach from `lib/jargon-pipeline/dedupe.ts`.
- General-quiz candidates must include exactly 3 `whyWrong` entries, one per incorrect option, never keyed to the correct answer.
- No named commercial products/vendors/models in generated content (`assertNoNamedProducts`, same as jargon pipeline).
- This machine has no `psql`, no authenticated `supabase` CLI, and no `pg`/`postgres` npm dependency — migrations in this plan are applied by pasting SQL into the Supabase Dashboard SQL Editor, exactly as prior sessions did (see `HANDOFF.md`), then verified with a REST `curl` using `SUPABASE_SERVICE_ROLE_KEY`.

---

## Task 1: Migration — `why_wrong` column on `general_quiz_questions`

**Files:**
- Create: `supabase/migrations/0012_general_quiz_why_wrong.sql`

**Interfaces:**
- Produces: a nullable `why_wrong jsonb` column on `general_quiz_questions`, shape `{"<wrong option text>": "why it's wrong", ...}` with exactly 3 keys once populated.

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/0012_general_quiz_why_wrong.sql
-- The source Excel (Tech_AI_MCQ_Quiz_120Q.xlsx) had a separate "why is this
-- wrong" explanation for each of the three incorrect options; migration 0011
-- flattened that away because the table only had one `explanation` column.
-- This restores it so future generated questions aren't thinner than the
-- hand-written ones already in the table.
alter table general_quiz_questions add column why_wrong jsonb;
-- Nullable: scenario_quiz_questions has no options to explain, so this column
-- only ever applies here. Not applied there.
```

- [ ] **Step 2: Apply it**

Open the Supabase Dashboard → SQL Editor for this project, paste the file's contents, run it.

- [ ] **Step 3: Verify the column exists**

```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/general_quiz_questions?select=id,why_wrong&limit=1" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Expected: a JSON array with one row containing a `why_wrong` key (value `null` — not yet backfilled).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0012_general_quiz_why_wrong.sql
git commit -m "Add why_wrong column to general_quiz_questions"
```

---

## Task 2: Backfill `why_wrong` for the 120 existing rows

**Files:**
- Create: `scripts/backfill-why-wrong.py`

**Interfaces:**
- Consumes: `C:\Users\Manyata Manocha\Downloads\Tech_AI_MCQ_Quiz_120Q.xlsx` (sheet "All 120 Questions", columns: No., Difficulty, Question, Option A–D, Correct Answer, Why This Is Correct, Why A/B/C/D Is Wrong), `general_quiz_questions.why_wrong` (from Task 1).
- Produces: every one of the 120 existing rows gets its `why_wrong` populated, matched by exact `question_text`.

This is a one-off local script, not part of the app — run once, not scheduled, not imported by anything else. It uses `openpyxl` (already installed on this machine this session) and stdlib `urllib` (no new pip dependency) to `PATCH` via PostgREST directly, the same way prior sessions verified DB state with raw `curl`.

- [ ] **Step 1: Write the script**

```python
# scripts/backfill-why-wrong.py
# One-off: restores per-wrong-answer feedback from the original Excel onto
# the 120 general_quiz_questions rows seeded by migration 0011, using the
# why_wrong column added in migration 0012. Matches rows by exact
# question_text since there's no shared id between the Excel and the table.
import json
import os
import urllib.request
import openpyxl

EXCEL_PATH = r"C:\Users\Manyata Manocha\Downloads\Tech_AI_MCQ_Quiz_120Q.xlsx"

def load_env(path=".env.local"):
    env = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            env[key.strip()] = value.strip()
    return env

def main():
    env = load_env()
    supabase_url = env["NEXT_PUBLIC_SUPABASE_URL"]
    service_key = env["SUPABASE_SERVICE_ROLE_KEY"]

    wb = openpyxl.load_workbook(EXCEL_PATH, read_only=True)
    ws = wb["All 120 Questions"]
    rows = list(ws.iter_rows(min_row=3, values_only=True))  # skip 2 title rows
    header = rows[0]
    assert header[2] == "Question" and header[7] == "Correct Answer", "unexpected header layout"

    matched, unmatched = 0, []
    for row in rows[1:]:
        if row[2] is None:
            continue
        question_text = row[2]
        option_a, option_b, option_c, option_d = row[3], row[4], row[5], row[6]
        correct_letter = row[7]
        why_a, why_b, why_c, why_d = row[9], row[10], row[11], row[12]

        options = {"A": option_a, "B": option_b, "C": option_c, "D": option_d}
        whys = {"A": why_a, "B": why_b, "C": why_c, "D": why_d}
        why_wrong = {
            options[letter]: whys[letter]
            for letter in ("A", "B", "C", "D")
            if letter != correct_letter and whys[letter]
        }
        if len(why_wrong) != 3:
            unmatched.append((question_text, "incomplete why_wrong in source row"))
            continue

        url = (
            f"{supabase_url}/rest/v1/general_quiz_questions"
            f"?question_text=eq.{urllib.parse.quote(question_text)}"
        )
        body = json.dumps({"why_wrong": why_wrong}).encode("utf-8")
        req = urllib.request.Request(url, data=body, method="PATCH", headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        })
        try:
            with urllib.request.urlopen(req) as resp:
                result = json.loads(resp.read())
                if result:
                    matched += 1
                else:
                    unmatched.append((question_text, "no matching row in DB"))
        except urllib.error.HTTPError as e:
            unmatched.append((question_text, f"HTTP {e.code}: {e.read().decode()}"))

    print(f"Matched and updated: {matched}")
    if unmatched:
        print(f"Unmatched ({len(unmatched)}) — left untouched, not silently skipped:")
        for text, reason in unmatched:
            print(f"  - {reason}: {text[:80]}")

if __name__ == "__main__":
    import urllib.parse
    main()
```

- [ ] **Step 2: Run it**

```bash
cd "/c/Users/Manyata Manocha/Downloads/Obsidian sync projects/vantage-app"
python3 scripts/backfill-why-wrong.py
```

Expected: `Matched and updated: 120` with no unmatched lines. If any rows are unmatched, read the printed reason before re-running — do not re-run blindly, since a partial prior run has already patched some rows successfully.

- [ ] **Step 3: Verify a sample row**

```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/general_quiz_questions?select=question_text,why_wrong&limit=1" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Expected: `why_wrong` is a JSON object with 3 keys, each an option string mapped to its explanation.

- [ ] **Step 4: Commit**

```bash
git add scripts/backfill-why-wrong.py
git commit -m "Backfill why_wrong for the 120 existing general quiz questions"
```

---

## Task 3: Migration — review gate for both new tables

**Files:**
- Create: `supabase/migrations/0013_general_scenario_review_status.sql`

**Interfaces:**
- Produces: `review_status text` (`'pending' | 'approved' | 'rejected'`, default `'pending'`) on both `general_quiz_questions` and `scenario_quiz_questions`, existing 210 rows backfilled to `'approved'`.

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/0013_general_scenario_review_status.sql
-- Mirrors 0009_review_status.sql: general_quiz_questions and
-- scenario_quiz_questions (added in 0011, after 0009) only had `flagged`,
-- reopening the exact "unreviewed == approved" gap 0009 was written to
-- close. Existing rows are backfilled to 'approved' — they're already live
-- and were reviewed by the user directly (they supplied the source Excel).
alter table general_quiz_questions add column review_status text not null default 'pending'
  check (review_status in ('pending', 'approved', 'rejected'));
alter table scenario_quiz_questions add column review_status text not null default 'pending'
  check (review_status in ('pending', 'approved', 'rejected'));

update general_quiz_questions set review_status = case when flagged then 'rejected' else 'approved' end;
update scenario_quiz_questions set review_status = case when flagged then 'rejected' else 'approved' end;
```

- [ ] **Step 2: Apply it**

Paste into the Supabase Dashboard SQL Editor, run it.

- [ ] **Step 3: Verify**

```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/general_quiz_questions?select=review_status&limit=1" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Expected: `[{"review_status":"approved"}]`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0013_general_scenario_review_status.sql
git commit -m "Add review_status to general_quiz_questions and scenario_quiz_questions"
```

---

## Task 4: Wire `review_status` and `why_wrong` into the general quiz serving action

**Files:**
- Modify: `app/practice/general/actions.ts`
- Test: `app/practice/general/__tests__/actions.test.ts`

**Interfaces:**
- Produces: `GeneralQuizQuestion` now includes `whyWrong: Record<string, string>`; `getGeneralQuizQuestions` filters on `review_status = 'approved'` in addition to `flagged = false`.
- Consumes: nothing new — same `getVerifiedUser()` pattern already in the file.

- [ ] **Step 1: Write the failing test**

```typescript
// app/practice/general/__tests__/actions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = Record<string, unknown>;

const state = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  questions: [] as Row[],
  attempts: [] as Row[],
}));

function makeBuilder(table: string) {
  const rows = table === "general_quiz_questions" ? state.questions : state.attempts;
  let current = [...rows];
  const filters: { column: string; value: unknown }[] = [];
  const builder = {
    select: () => builder,
    eq: (column: string, value: unknown) => {
      filters.push({ column, value });
      current = current.filter((row) => row[column] === value);
      return builder;
    },
    not: () => builder,
    order: () => builder,
    then: (resolve: (value: { data: Row[]; error: null }) => unknown) =>
      resolve({ data: current, error: null }),
  };
  return builder;
}

vi.mock("@/lib/supabase/server", () => ({
  getVerifiedUser: async () => ({
    user: state.user,
    supabase: { from: (table: string) => makeBuilder(table) },
  }),
}));

import { getGeneralQuizQuestions } from "../actions";

describe("getGeneralQuizQuestions", () => {
  beforeEach(() => {
    state.attempts = [];
    state.questions = [
      {
        id: "q-approved",
        difficulty: "easy",
        question_text: "Approved question",
        options: ["A", "B", "C", "D"],
        correct_answer: "A",
        explanation: "because",
        why_wrong: { B: "wrong b", C: "wrong c", D: "wrong d" },
        flagged: false,
        review_status: "approved",
      },
      {
        id: "q-pending",
        difficulty: "easy",
        question_text: "Pending question",
        options: ["A", "B", "C", "D"],
        correct_answer: "A",
        explanation: "because",
        why_wrong: null,
        flagged: false,
        review_status: "pending",
      },
    ];
  });

  it("only returns approved questions and includes whyWrong", async () => {
    const result = await getGeneralQuizQuestions("easy");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("q-approved");
    expect(result[0].whyWrong).toEqual({ B: "wrong b", C: "wrong c", D: "wrong d" });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx.cmd vitest run app/practice/general/__tests__/actions.test.ts
```

Expected: FAIL — `review_status` filter doesn't exist yet, so both rows come back, or `whyWrong` is `undefined`.

- [ ] **Step 3: Update the implementation**

```typescript
// app/practice/general/actions.ts
"use server";

import { getVerifiedUser } from "@/lib/supabase/server";

export type GeneralQuizQuestion = {
  id: string;
  difficulty: "easy" | "medium" | "hard";
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  whyWrong: Record<string, string>;
};

export async function getGeneralQuizQuestions(difficulty: GeneralQuizQuestion["difficulty"]): Promise<GeneralQuizQuestion[]> {
  const { supabase, user } = await getVerifiedUser();
  if (!user?.id) throw new Error("Not authenticated");
  const { data: attempted, error: attemptedError } = await supabase
    .from("general_quiz_attempts")
    .select("question_id")
    .eq("user_id", user.id);
  if (attemptedError) throw new Error(attemptedError.message);
  const seenIds = [...new Set((attempted ?? []).map((row) => row.question_id as string))];
  let query = supabase
    .from("general_quiz_questions")
    .select("id, difficulty, question_text, options, correct_answer, explanation, why_wrong")
    .eq("difficulty", difficulty)
    .eq("flagged", false)
    .eq("review_status", "approved")
    .order("created_at", { ascending: true });
  if (seenIds.length > 0) query = query.not("id", "in", `(${seenIds.join(",")})`);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: String(row.id),
    difficulty: row.difficulty as GeneralQuizQuestion["difficulty"],
    questionText: String(row.question_text),
    options: Array.isArray(row.options) ? row.options.map(String) : [],
    correctAnswer: String(row.correct_answer),
    explanation: String(row.explanation),
    whyWrong: (row.why_wrong ?? {}) as Record<string, string>,
  }));
}

export async function recordGeneralQuizAttempt(input: { questionId: string; selectedAnswer: string; seconds: number | null }) {
  const { supabase, user } = await getVerifiedUser();
  if (!user?.id) throw new Error("Not authenticated");
  const { data: question, error: questionError } = await supabase
    .from("general_quiz_questions")
    .select("correct_answer")
    .eq("id", input.questionId)
    .single();
  if (questionError) throw new Error(questionError.message);
  const correct = question.correct_answer === input.selectedAnswer;
  const { error } = await supabase.from("general_quiz_attempts").insert({
    user_id: user.id,
    question_id: input.questionId,
    selected_answer: input.selectedAnswer,
    correct,
    seconds: input.seconds,
  });
  if (error) throw new Error(error.message);
  return { correct };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx.cmd vitest run app/practice/general/__tests__/actions.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/practice/general/actions.ts app/practice/general/__tests__/actions.test.ts
git commit -m "Filter general quiz questions on review_status, expose whyWrong"
```

---

## Task 5: Show the wrong-answer explanation in the general quiz UI

**Files:**
- Modify: `app/practice/general/general-quiz-session.tsx:196-201`

**Interfaces:**
- Consumes: `GeneralQuizQuestion.whyWrong` (from Task 4), the existing `selected` and `result` state already in this component.

No test file exists for this component in the current codebase (it's a client component driven by local state and two server actions, and no testing setup for that pattern exists here yet) — verified manually per Step 2, matching how prior UI work in this repo was verified (see `HANDOFF.md`'s repeated "verified via a live Playwright-driven browser" pattern).

- [ ] **Step 1: Make the change**

Replace lines 196-201:

```tsx
          <section className="quote-card stack">
            <span className="card-label">Correct answer: {question.correctAnswer}</span>
            <p className="card-text">{question.explanation}</p>
          </section>
```

with:

```tsx
          <section className="quote-card stack">
            <span className="card-label">Correct answer: {question.correctAnswer}</span>
            <p className="card-text">{question.explanation}</p>
            {!result && selected && question.whyWrong[selected] ? (
              <p className="card-text" style={{ marginTop: 6 }}>
                <strong>Why &quot;{selected}&quot; is wrong: </strong>
                {question.whyWrong[selected]}
              </p>
            ) : null}
          </section>
```

- [ ] **Step 2: Verify manually**

```bash
npm.cmd run dev
```

Open `http://localhost:3000/practice/general`, answer a question **incorrectly**, confirm both the correct-answer explanation and the specific "why your pick was wrong" text appear. Answer one **correctly** and confirm only the correct-answer explanation shows (no `whyWrong` line).

- [ ] **Step 3: Commit**

```bash
git add app/practice/general/general-quiz-session.tsx
git commit -m "Show the specific wrong-answer explanation on the general quiz result"
```

---

## Task 6: Wire `review_status` into the scenario quiz serving action

**Files:**
- Modify: `app/practice/scenario-quiz/actions.ts`
- Test: `app/practice/scenario-quiz/__tests__/actions.test.ts`

**Interfaces:**
- Produces: `getScenarioQuizQuestions` filters on `review_status = 'approved'` in addition to `flagged = false`. No shape change to `ScenarioQuizQuestion` (scenario has no `why_wrong` equivalent — see spec).

- [ ] **Step 1: Write the failing test**

```typescript
// app/practice/scenario-quiz/__tests__/actions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = Record<string, unknown>;

const state = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  questions: [] as Row[],
  attempts: [] as Row[],
}));

function makeBuilder(table: string) {
  const rows = table === "scenario_quiz_questions" ? state.questions : state.attempts;
  let current = [...rows];
  const builder = {
    select: () => builder,
    eq: (column: string, value: unknown) => {
      current = current.filter((row) => row[column] === value);
      return builder;
    },
    not: () => builder,
    order: () => builder,
    then: (resolve: (value: { data: Row[]; error: null }) => unknown) =>
      resolve({ data: current, error: null }),
  };
  return builder;
}

vi.mock("@/lib/supabase/server", () => ({
  getVerifiedUser: async () => ({
    user: state.user,
    supabase: { from: (table: string) => makeBuilder(table) },
  }),
}));

import { getScenarioQuizQuestions } from "../actions";

describe("getScenarioQuizQuestions", () => {
  beforeEach(() => {
    state.attempts = [];
    state.questions = [
      { id: "s-approved", difficulty: "easy", question_text: "Approved scenario", answer: "Do X", explanation: "because", flagged: false, review_status: "approved" },
      { id: "s-pending", difficulty: "easy", question_text: "Pending scenario", answer: "Do Y", explanation: "because", flagged: false, review_status: "pending" },
    ];
  });

  it("only returns approved scenarios", async () => {
    const result = await getScenarioQuizQuestions("easy");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("s-approved");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx.cmd vitest run app/practice/scenario-quiz/__tests__/actions.test.ts
```

Expected: FAIL — both rows returned, no `review_status` filter yet.

- [ ] **Step 3: Update the implementation**

In `app/practice/scenario-quiz/actions.ts`, change:

```typescript
  let query = supabase
    .from("scenario_quiz_questions")
    .select("id, difficulty, question_text, answer, explanation")
    .eq("difficulty", difficulty)
    .eq("flagged", false)
    .order("created_at", { ascending: true });
```

to:

```typescript
  let query = supabase
    .from("scenario_quiz_questions")
    .select("id, difficulty, question_text, answer, explanation")
    .eq("difficulty", difficulty)
    .eq("flagged", false)
    .eq("review_status", "approved")
    .order("created_at", { ascending: true });
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx.cmd vitest run app/practice/scenario-quiz/__tests__/actions.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/practice/scenario-quiz/actions.ts app/practice/scenario-quiz/__tests__/actions.test.ts
git commit -m "Filter scenario quiz questions on review_status"
```

---

## Task 7: General quiz pipeline — dedupe and validation

**Files:**
- Create: `lib/general-quiz-pipeline/generate-questions.ts`
- Create: `lib/general-quiz-pipeline/dedupe.ts`
- Create: `lib/general-quiz-pipeline/validate-question.ts`
- Test: `lib/general-quiz-pipeline/__tests__/dedupe.test.ts`
- Test: `lib/general-quiz-pipeline/__tests__/validate-question.test.ts`

**Interfaces:**
- Produces: `GeneralQuestionCandidate` type, `generateGeneralQuizQuestions(tier, examples)`, `dedupeGeneralQuestions(items, existingTexts)`, `validateGeneralQuestion(candidate)` — all consumed by Task 9's `run-pipeline.ts`.

- [ ] **Step 1: Write the failing dedupe test**

```typescript
// lib/general-quiz-pipeline/__tests__/dedupe.test.ts
import { describe, it, expect } from "vitest";
import { dedupeGeneralQuestions } from "../dedupe";
import type { GeneralQuestionCandidate } from "../generate-questions";

function candidate(questionText: string): GeneralQuestionCandidate {
  return {
    difficulty: "easy",
    questionText,
    options: ["A", "B", "C", "D"],
    correctAnswer: "A",
    explanation: "because",
    whyWrong: { B: "b wrong", C: "c wrong", D: "d wrong" },
  };
}

describe("dedupeGeneralQuestions", () => {
  it("rejects an exact match against existing text", () => {
    const result = dedupeGeneralQuestions([candidate("What does AI stand for?")], ["What does AI stand for?"]);
    expect(result).toHaveLength(0);
  });

  it("rejects a near-duplicate by word overlap", () => {
    const result = dedupeGeneralQuestions(
      [candidate("What does the acronym AI stand for?")],
      ["What does AI stand for?"]
    );
    expect(result).toHaveLength(0);
  });

  it("keeps a genuinely different question", () => {
    const result = dedupeGeneralQuestions([candidate("What is a firewall?")], ["What does AI stand for?"]);
    expect(result).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx.cmd vitest run lib/general-quiz-pipeline/__tests__/dedupe.test.ts
```

Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write `generate-questions.ts` and `dedupe.ts`**

```typescript
// lib/general-quiz-pipeline/generate-questions.ts
import { getGroqClient } from "@/lib/groq";
import { checkFinishReason } from "@/lib/engine/check-finish-reason";
import { parseJsonResponse } from "@/lib/engine/parse-json-response";
import { withRetry } from "@/lib/engine/with-retry";

export type QuizDifficulty = "easy" | "medium" | "hard";
export type GeneralQuestionCandidate = {
  difficulty: QuizDifficulty;
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  whyWrong: Record<string, string>;
};
export type GeneralQuestionExample = {
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
};

type Raw = { questions: GeneralQuestionCandidate[] };
function isRaw(value: unknown): value is Raw {
  return typeof value === "object" && value !== null && Array.isArray((value as Raw).questions);
}

function buildPrompt(tier: QuizDifficulty, examples: GeneralQuestionExample[]): string {
  const exampleBlock = examples
    .map((ex, i) => `Example ${i + 1}: "${ex.questionText}" — options ${JSON.stringify(ex.options)}, correct: "${ex.correctAnswer}". ${ex.explanation}`)
    .join("\n");
  return `Return JSON only. Create 20 general tech & AI knowledge multiple-choice questions at "${tier}" difficulty for a non-technical, client-facing consultant (not an ML engineer or data scientist). Cover everyday tech and AI concepts she would realistically encounter at work — not ML-engineering internals (no backpropagation, gradient descent, regularization, cross-validation, embeddings-as-a-training-mechanic, loss function, hyperparameter, or similar).

Match the style and difficulty level of these existing questions:
${exampleBlock || "(no existing examples yet — use plain, everyday tech/AI knowledge questions)"}

Each item must have: difficulty ("${tier}"), questionText, exactly four distinct options, correctAnswer copied exactly from options, a plain-language fifth-grade-level explanation for why the correct answer is right, and whyWrong — an object with exactly three keys, one for each incorrect option (copied exactly from options), each mapped to a plain-language explanation of why that option is wrong. Do not name commercial products, vendors, or models. Do not repeat a question already covered in this batch.

Shape: {"questions":[{"difficulty":"${tier}","questionText":"...","options":["...","...","...","..."],"correctAnswer":"...","explanation":"...","whyWrong":{"wrong option 1":"...","wrong option 2":"...","wrong option 3":"..."}}]}`;
}

export async function generateGeneralQuizQuestions(tier: QuizDifficulty, examples: GeneralQuestionExample[]): Promise<GeneralQuestionCandidate[]> {
  const prompt = buildPrompt(tier, examples);
  const response = await withRetry((signal) => getGroqClient().chat.completions.create({
    model: "openai/gpt-oss-120b",
    reasoning_effort: "low",
    max_tokens: 6000,
    response_format: { type: "json_object" },
    messages: [{ role: "system", content: prompt }],
  }, { maxRetries: 0, signal }));
  checkFinishReason(response.choices[0]?.finish_reason, "generate-general-quiz-questions");
  const parsed = parseJsonResponse(response.choices[0]?.message?.content ?? "", isRaw, "generate-general-quiz-questions");
  return parsed.questions;
}
```

```typescript
// lib/general-quiz-pipeline/dedupe.ts
import type { GeneralQuestionCandidate } from "./generate-questions";

function similarity(a: string, b: string): number {
  const left = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const right = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 1;
}

export function dedupeGeneralQuestions(
  items: GeneralQuestionCandidate[],
  existingTexts: string[]
): GeneralQuestionCandidate[] {
  const seen = [...existingTexts];
  const kept: GeneralQuestionCandidate[] = [];
  for (const item of items) {
    if (seen.every((old) => similarity(item.questionText, old) < 0.5)) {
      kept.push(item);
      seen.push(item.questionText);
    }
  }
  return kept;
}
```

- [ ] **Step 4: Run dedupe test to verify it passes**

```bash
npx.cmd vitest run lib/general-quiz-pipeline/__tests__/dedupe.test.ts
```

Expected: PASS

- [ ] **Step 5: Write the failing validate test**

```typescript
// lib/general-quiz-pipeline/__tests__/validate-question.test.ts
import { describe, it, expect } from "vitest";
import { validateGeneralQuestion } from "../validate-question";
import type { GeneralQuestionCandidate } from "../generate-questions";

function valid(): GeneralQuestionCandidate {
  return {
    difficulty: "easy",
    questionText: "What does AI stand for?",
    options: ["Artificial Intelligence", "Automated Internet", "Advanced Integration", "Application Interface"],
    correctAnswer: "Artificial Intelligence",
    explanation: "It means machines built to act smart.",
    whyWrong: {
      "Automated Internet": "Not a real term.",
      "Advanced Integration": "Sounds techy but isn't what AI stands for.",
      "Application Interface": "That's part of API, a different term.",
    },
  };
}

describe("validateGeneralQuestion", () => {
  it("accepts a well-formed candidate", () => {
    expect(validateGeneralQuestion(valid())).toEqual({ valid: true });
  });

  it("rejects a correctAnswer not present in options", () => {
    const candidate = { ...valid(), correctAnswer: "Something else" };
    expect(validateGeneralQuestion(candidate).valid).toBe(false);
  });

  it("rejects fewer than three whyWrong entries", () => {
    const candidate = valid();
    delete candidate.whyWrong["Advanced Integration"];
    expect(validateGeneralQuestion(candidate).valid).toBe(false);
  });

  it("rejects whyWrong keyed to the correct answer", () => {
    const candidate = valid();
    delete candidate.whyWrong["Automated Internet"];
    candidate.whyWrong["Artificial Intelligence"] = "should not exist";
    expect(validateGeneralQuestion(candidate).valid).toBe(false);
  });

  it("rejects duplicate options", () => {
    const candidate = { ...valid(), options: ["A", "A", "B", "C"] };
    expect(validateGeneralQuestion(candidate).valid).toBe(false);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

```bash
npx.cmd vitest run lib/general-quiz-pipeline/__tests__/validate-question.test.ts
```

Expected: FAIL — module doesn't exist.

- [ ] **Step 7: Write `validate-question.ts`**

```typescript
// lib/general-quiz-pipeline/validate-question.ts
import { assertNoNamedProducts } from "@/lib/engine/guardrails";
import type { GeneralQuestionCandidate } from "./generate-questions";

export function validateGeneralQuestion(candidate: GeneralQuestionCandidate): { valid: true } | { valid: false; reason: string } {
  if (!["easy", "medium", "hard"].includes(candidate.difficulty)) return { valid: false, reason: "invalid difficulty" };
  if (!candidate.questionText.trim() || !candidate.explanation.trim()) return { valid: false, reason: "missing text" };
  if (candidate.options.length !== 4 || new Set(candidate.options.map((o) => o.trim().toLowerCase())).size !== 4) {
    return { valid: false, reason: "options must contain four distinct values" };
  }
  if (!candidate.options.includes(candidate.correctAnswer)) return { valid: false, reason: "correct answer is not an option" };

  const wrongOptions = candidate.options.filter((o) => o !== candidate.correctAnswer);
  const whyWrongKeys = Object.keys(candidate.whyWrong ?? {});
  if (whyWrongKeys.length !== 3) return { valid: false, reason: "whyWrong must have exactly three entries" };
  if (whyWrongKeys.includes(candidate.correctAnswer)) return { valid: false, reason: "whyWrong must not key the correct answer" };
  if (!wrongOptions.every((o) => whyWrongKeys.includes(o))) return { valid: false, reason: "whyWrong must cover every incorrect option" };
  if (!whyWrongKeys.every((key) => candidate.whyWrong[key]?.trim())) return { valid: false, reason: "whyWrong entries must not be empty" };

  try {
    assertNoNamedProducts(
      `${candidate.questionText}\n${candidate.options.join("\n")}\n${candidate.explanation}\n${Object.values(candidate.whyWrong).join("\n")}`,
      "general quiz question"
    );
  } catch (error) {
    return { valid: false, reason: error instanceof Error ? error.message : "named product" };
  }
  return { valid: true };
}
```

- [ ] **Step 8: Run test to verify it passes**

```bash
npx.cmd vitest run lib/general-quiz-pipeline/__tests__/validate-question.test.ts
```

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add lib/general-quiz-pipeline/
git commit -m "Add general quiz generation, dedupe, and validation"
```

---

## Task 8: Scenario quiz pipeline — dedupe and validation

**Files:**
- Create: `lib/scenario-quiz-pipeline/generate-questions.ts`
- Create: `lib/scenario-quiz-pipeline/dedupe.ts`
- Create: `lib/scenario-quiz-pipeline/validate-question.ts`
- Test: `lib/scenario-quiz-pipeline/__tests__/dedupe.test.ts`
- Test: `lib/scenario-quiz-pipeline/__tests__/validate-question.test.ts`

**Interfaces:**
- Produces: `ScenarioQuestionCandidate` type, `generateScenarioQuizQuestions(tier, examples)`, `dedupeScenarioQuestions(items, existingTexts)`, `validateScenarioQuestion(candidate)` — consumed by Task 9's `run-pipeline.ts`.

- [ ] **Step 1: Write the failing dedupe test**

```typescript
// lib/scenario-quiz-pipeline/__tests__/dedupe.test.ts
import { describe, it, expect } from "vitest";
import { dedupeScenarioQuestions } from "../dedupe";
import type { ScenarioQuestionCandidate } from "../generate-questions";

function candidate(questionText: string): ScenarioQuestionCandidate {
  return { difficulty: "easy", questionText, answer: "Do X", explanation: "because" };
}

describe("dedupeScenarioQuestions", () => {
  it("rejects an exact match against existing text", () => {
    const result = dedupeScenarioQuestions([candidate("A client needs a report summarized.")], ["A client needs a report summarized."]);
    expect(result).toHaveLength(0);
  });

  it("keeps a genuinely different scenario", () => {
    const result = dedupeScenarioQuestions([candidate("A client needs fraud detection.")], ["A client needs a report summarized."]);
    expect(result).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx.cmd vitest run lib/scenario-quiz-pipeline/__tests__/dedupe.test.ts
```

Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write `generate-questions.ts` and `dedupe.ts`**

```typescript
// lib/scenario-quiz-pipeline/generate-questions.ts
import { getGroqClient } from "@/lib/groq";
import { checkFinishReason } from "@/lib/engine/check-finish-reason";
import { parseJsonResponse } from "@/lib/engine/parse-json-response";
import { withRetry } from "@/lib/engine/with-retry";

export type QuizDifficulty = "easy" | "medium" | "hard";
export type ScenarioQuestionCandidate = {
  difficulty: QuizDifficulty;
  questionText: string;
  answer: string;
  explanation: string;
};
export type ScenarioQuestionExample = {
  questionText: string;
  answer: string;
  explanation: string;
};

type Raw = { questions: ScenarioQuestionCandidate[] };
function isRaw(value: unknown): value is Raw {
  return typeof value === "object" && value !== null && Array.isArray((value as Raw).questions);
}

function buildPrompt(tier: QuizDifficulty, examples: ScenarioQuestionExample[]): string {
  const exampleBlock = examples
    .map((ex, i) => `Example ${i + 1}: "${ex.questionText}" → "${ex.answer}". ${ex.explanation}`)
    .join("\n");
  return `Return JSON only. Create 20 workplace scenario questions at "${tier}" difficulty for a non-technical, client-facing consultant deciding how AI could help with a specific work situation. Each scenario describes a realistic situation; the answer names the AI-assisted action that addresses it in plain language (not a named product).

Match the style and difficulty level of these existing scenarios:
${exampleBlock || "(no existing examples yet — use realistic everyday workplace scenarios)"}

Difficulty guide: "easy" tests recognizing the right kind of AI help; "medium" tests choosing and explaining an approach; "hard" tests judgment, risk, and trade-offs.

Each item must have: difficulty ("${tier}"), questionText (the scenario), answer (the AI-assisted action, one sentence), explanation (plain-language why, one to two sentences). Do not name commercial products, vendors, or models. Do not repeat a scenario already covered in this batch.

Shape: {"questions":[{"difficulty":"${tier}","questionText":"...","answer":"...","explanation":"..."}]}`;
}

export async function generateScenarioQuizQuestions(tier: QuizDifficulty, examples: ScenarioQuestionExample[]): Promise<ScenarioQuestionCandidate[]> {
  const prompt = buildPrompt(tier, examples);
  const response = await withRetry((signal) => getGroqClient().chat.completions.create({
    model: "openai/gpt-oss-120b",
    reasoning_effort: "low",
    max_tokens: 4500,
    response_format: { type: "json_object" },
    messages: [{ role: "system", content: prompt }],
  }, { maxRetries: 0, signal }));
  checkFinishReason(response.choices[0]?.finish_reason, "generate-scenario-quiz-questions");
  const parsed = parseJsonResponse(response.choices[0]?.message?.content ?? "", isRaw, "generate-scenario-quiz-questions");
  return parsed.questions;
}
```

```typescript
// lib/scenario-quiz-pipeline/dedupe.ts
import type { ScenarioQuestionCandidate } from "./generate-questions";

function similarity(a: string, b: string): number {
  const left = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const right = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 1;
}

export function dedupeScenarioQuestions(
  items: ScenarioQuestionCandidate[],
  existingTexts: string[]
): ScenarioQuestionCandidate[] {
  const seen = [...existingTexts];
  const kept: ScenarioQuestionCandidate[] = [];
  for (const item of items) {
    if (seen.every((old) => similarity(item.questionText, old) < 0.5)) {
      kept.push(item);
      seen.push(item.questionText);
    }
  }
  return kept;
}
```

- [ ] **Step 4: Run dedupe test to verify it passes**

```bash
npx.cmd vitest run lib/scenario-quiz-pipeline/__tests__/dedupe.test.ts
```

Expected: PASS

- [ ] **Step 5: Write the failing validate test**

```typescript
// lib/scenario-quiz-pipeline/__tests__/validate-question.test.ts
import { describe, it, expect } from "vitest";
import { validateScenarioQuestion } from "../validate-question";
import type { ScenarioQuestionCandidate } from "../generate-questions";

function valid(): ScenarioQuestionCandidate {
  return {
    difficulty: "easy",
    questionText: "A client has 500 support tickets and wants the common issues surfaced.",
    answer: "Use AI to group similar tickets by topic.",
    explanation: "AI can cluster similar complaints so the biggest issues are easy to spot.",
  };
}

describe("validateScenarioQuestion", () => {
  it("accepts a well-formed candidate", () => {
    expect(validateScenarioQuestion(valid())).toEqual({ valid: true });
  });

  it("rejects an empty answer", () => {
    expect(validateScenarioQuestion({ ...valid(), answer: "" }).valid).toBe(false);
  });

  it("rejects an invalid difficulty", () => {
    expect(validateScenarioQuestion({ ...valid(), difficulty: "impossible" as never }).valid).toBe(false);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

```bash
npx.cmd vitest run lib/scenario-quiz-pipeline/__tests__/validate-question.test.ts
```

Expected: FAIL — module doesn't exist.

- [ ] **Step 7: Write `validate-question.ts`**

```typescript
// lib/scenario-quiz-pipeline/validate-question.ts
import { assertNoNamedProducts } from "@/lib/engine/guardrails";
import type { ScenarioQuestionCandidate } from "./generate-questions";

export function validateScenarioQuestion(candidate: ScenarioQuestionCandidate): { valid: true } | { valid: false; reason: string } {
  if (!["easy", "medium", "hard"].includes(candidate.difficulty)) return { valid: false, reason: "invalid difficulty" };
  if (!candidate.questionText.trim() || !candidate.answer.trim() || !candidate.explanation.trim()) {
    return { valid: false, reason: "missing text" };
  }
  try {
    assertNoNamedProducts(`${candidate.questionText}\n${candidate.answer}\n${candidate.explanation}`, "scenario quiz question");
  } catch (error) {
    return { valid: false, reason: error instanceof Error ? error.message : "named product" };
  }
  return { valid: true };
}
```

- [ ] **Step 8: Run test to verify it passes**

```bash
npx.cmd vitest run lib/scenario-quiz-pipeline/__tests__/validate-question.test.ts
```

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add lib/scenario-quiz-pipeline/
git commit -m "Add scenario quiz generation, dedupe, and validation"
```

---

## Task 9: Run-pipeline for both quiz types, with per-tier isolation

**Files:**
- Create: `lib/general-quiz-pipeline/run-pipeline.ts`
- Create: `lib/scenario-quiz-pipeline/run-pipeline.ts`
- Test: `lib/general-quiz-pipeline/__tests__/run-pipeline.test.ts`

**Interfaces:**
- Consumes: `generateGeneralQuizQuestions`, `dedupeGeneralQuestions`, `validateGeneralQuestion` (Task 7); `generateScenarioQuizQuestions`, `dedupeScenarioQuestions`, `validateScenarioQuestion` (Task 8); `getSupabaseAdminClient()`.
- Produces: `runGeneralQuizPipeline()` and `runScenarioQuizPipeline()`, each returning `{ tier: string; generated: number; rejectedDuplicate: number; rejectedValidation: number; inserted: number; error?: string }[]` — one entry per tier, consumed by Task 10's cron routes.

Only `general-quiz-pipeline`'s run-pipeline gets a dedicated test here — `scenario-quiz-pipeline`'s follows the identical shape and is verified via manual cron-route invocation in Task 10, consistent with `lib/jargon-pipeline/run-pipeline.ts` having no test of its own in this codebase today.

- [ ] **Step 1: Write the failing test — a failing tier doesn't block the others**

```typescript
// lib/general-quiz-pipeline/__tests__/run-pipeline.test.ts
import { describe, it, expect, vi } from "vitest";

const state = vi.hoisted(() => ({
  existingByDifficulty: { easy: [], medium: [], hard: [] } as Record<string, { question_text: string }[]>,
  inserted: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: (_col: string, difficulty: string) => ({
          eq: () => ({
            limit: async () => ({ data: state.existingByDifficulty[difficulty] ?? [], error: null }),
          }),
        }),
      }),
      insert: async (rows: Record<string, unknown>[]) => {
        state.inserted.push(...rows);
        return { error: null };
      },
    }),
  }),
}));

vi.mock("../generate-questions", () => ({
  generateGeneralQuizQuestions: async (tier: string) => {
    if (tier === "medium") throw new Error("groq exploded");
    return [
      {
        difficulty: tier,
        questionText: `Question for ${tier}`,
        options: ["A", "B", "C", "D"],
        correctAnswer: "A",
        explanation: "because",
        whyWrong: { B: "b", C: "c", D: "d" },
      },
    ];
  },
}));

import { runGeneralQuizPipeline } from "../run-pipeline";

describe("runGeneralQuizPipeline", () => {
  it("still generates for easy and hard when medium fails", async () => {
    const results = await runGeneralQuizPipeline();
    const byTier = Object.fromEntries(results.map((r) => [r.tier, r]));
    expect(byTier.easy.inserted).toBe(1);
    expect(byTier.hard.inserted).toBe(1);
    expect(byTier.medium.error).toBe("groq exploded");
    expect(byTier.medium.inserted).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx.cmd vitest run lib/general-quiz-pipeline/__tests__/run-pipeline.test.ts
```

Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write `lib/general-quiz-pipeline/run-pipeline.ts`**

```typescript
// lib/general-quiz-pipeline/run-pipeline.ts
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { dedupeGeneralQuestions } from "./dedupe";
import { generateGeneralQuizQuestions, type QuizDifficulty } from "./generate-questions";
import { validateGeneralQuestion } from "./validate-question";

const TIERS: QuizDifficulty[] = ["easy", "medium", "hard"];

type TierResult = {
  tier: QuizDifficulty;
  generated: number;
  rejectedDuplicate: number;
  rejectedValidation: number;
  inserted: number;
  error?: string;
};

export async function runGeneralQuizPipeline(): Promise<TierResult[]> {
  const supabase = getSupabaseAdminClient();
  const results: TierResult[] = [];

  for (const tier of TIERS) {
    try {
      const { data: existing, error: fetchError } = await supabase
        .from("general_quiz_questions")
        .select("question_text, options, correct_answer, explanation")
        .eq("difficulty", tier)
        .eq("review_status", "approved")
        .limit(5);
      if (fetchError) throw new Error(fetchError.message);

      const examples = (existing ?? []).map((row) => ({
        questionText: row.question_text as string,
        options: row.options as string[],
        correctAnswer: row.correct_answer as string,
        explanation: row.explanation as string,
      }));

      const generated = await generateGeneralQuizQuestions(tier, examples);
      const existingTexts = examples.map((e) => e.questionText);
      const deduped = dedupeGeneralQuestions(generated, existingTexts);
      const rejectedDuplicate = generated.length - deduped.length;
      const valid = deduped.filter((candidate) => {
        const result = validateGeneralQuestion(candidate);
        if (!result.valid) console.warn(`[general-quiz-pipeline] rejected: ${result.reason}`);
        return result.valid;
      });
      const rejectedValidation = deduped.length - valid.length;

      if (valid.length) {
        const { error } = await supabase.from("general_quiz_questions").insert(valid.map((q) => ({
          difficulty: q.difficulty,
          question_text: q.questionText,
          options: q.options,
          correct_answer: q.correctAnswer,
          explanation: q.explanation,
          why_wrong: q.whyWrong,
          review_status: "pending",
        })));
        if (error) throw new Error(error.message);
      }

      results.push({ tier, generated: generated.length, rejectedDuplicate, rejectedValidation, inserted: valid.length });
    } catch (error) {
      // One tier's failure must not block the other two — each tier is independent.
      results.push({
        tier,
        generated: 0,
        rejectedDuplicate: 0,
        rejectedValidation: 0,
        inserted: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx.cmd vitest run lib/general-quiz-pipeline/__tests__/run-pipeline.test.ts
```

Expected: PASS

- [ ] **Step 5: Write `lib/scenario-quiz-pipeline/run-pipeline.ts`** (identical shape, no test — see task rationale above)

```typescript
// lib/scenario-quiz-pipeline/run-pipeline.ts
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { dedupeScenarioQuestions } from "./dedupe";
import { generateScenarioQuizQuestions, type QuizDifficulty } from "./generate-questions";
import { validateScenarioQuestion } from "./validate-question";

const TIERS: QuizDifficulty[] = ["easy", "medium", "hard"];

type TierResult = {
  tier: QuizDifficulty;
  generated: number;
  rejectedDuplicate: number;
  rejectedValidation: number;
  inserted: number;
  error?: string;
};

export async function runScenarioQuizPipeline(): Promise<TierResult[]> {
  const supabase = getSupabaseAdminClient();
  const results: TierResult[] = [];

  for (const tier of TIERS) {
    try {
      const { data: existing, error: fetchError } = await supabase
        .from("scenario_quiz_questions")
        .select("question_text, answer, explanation")
        .eq("difficulty", tier)
        .eq("review_status", "approved")
        .limit(5);
      if (fetchError) throw new Error(fetchError.message);

      const examples = (existing ?? []).map((row) => ({
        questionText: row.question_text as string,
        answer: row.answer as string,
        explanation: row.explanation as string,
      }));

      const generated = await generateScenarioQuizQuestions(tier, examples);
      const existingTexts = examples.map((e) => e.questionText);
      const deduped = dedupeScenarioQuestions(generated, existingTexts);
      const rejectedDuplicate = generated.length - deduped.length;
      const valid = deduped.filter((candidate) => {
        const result = validateScenarioQuestion(candidate);
        if (!result.valid) console.warn(`[scenario-quiz-pipeline] rejected: ${result.reason}`);
        return result.valid;
      });
      const rejectedValidation = deduped.length - valid.length;

      if (valid.length) {
        const { error } = await supabase.from("scenario_quiz_questions").insert(valid.map((q) => ({
          difficulty: q.difficulty,
          question_text: q.questionText,
          answer: q.answer,
          explanation: q.explanation,
          review_status: "pending",
        })));
        if (error) throw new Error(error.message);
      }

      results.push({ tier, generated: generated.length, rejectedDuplicate, rejectedValidation, inserted: valid.length });
    } catch (error) {
      results.push({
        tier,
        generated: 0,
        rejectedDuplicate: 0,
        rejectedValidation: 0,
        inserted: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/general-quiz-pipeline/run-pipeline.ts lib/scenario-quiz-pipeline/run-pipeline.ts lib/general-quiz-pipeline/__tests__/run-pipeline.test.ts
git commit -m "Add run-pipeline for general and scenario quiz generation"
```

---

## Task 10: Cron routes and scheduling

**Files:**
- Create: `app/api/cron/generate-general-quiz-questions/route.ts`
- Create: `app/api/cron/generate-scenario-quiz-questions/route.ts`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: `runGeneralQuizPipeline()`, `runScenarioQuizPipeline()` (Task 9).

- [ ] **Step 1: Write the general quiz cron route**

```typescript
// app/api/cron/generate-general-quiz-questions/route.ts
import { NextResponse } from "next/server";
import { runGeneralQuizPipeline } from "@/lib/general-quiz-pipeline/run-pipeline";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ results: await runGeneralQuizPipeline() });
  } catch (error) {
    console.error("[cron/generate-general-quiz-questions]", error);
    return NextResponse.json({ error: "General quiz generation failed" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Write the scenario quiz cron route**

```typescript
// app/api/cron/generate-scenario-quiz-questions/route.ts
import { NextResponse } from "next/server";
import { runScenarioQuizPipeline } from "@/lib/scenario-quiz-pipeline/run-pipeline";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ results: await runScenarioQuizPipeline() });
  } catch (error) {
    console.error("[cron/generate-scenario-quiz-questions]", error);
    return NextResponse.json({ error: "Scenario quiz generation failed" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Update `vercel.json`**

```json
{
  "crons": [
    { "path": "/api/cron/generate-practice-cases", "schedule": "0 2 * * *" },
    { "path": "/api/cron/generate-quiz-questions", "schedule": "30 2 * * *" },
    { "path": "/api/cron/generate-general-quiz-questions", "schedule": "0 3 * * *" },
    { "path": "/api/cron/generate-scenario-quiz-questions", "schedule": "30 3 * * *" }
  ]
}
```

- [ ] **Step 4: Verify manually**

```bash
npm.cmd run dev
```

In another terminal:

```bash
curl -s http://localhost:3000/api/cron/generate-general-quiz-questions
curl -s http://localhost:3000/api/cron/generate-scenario-quiz-questions
```

Expected: each returns `{"results":[{"tier":"easy",...},{"tier":"medium",...},{"tier":"hard",...}]}` with `inserted` counts >0 (assuming `GROQ_API_KEY` is valid and Groq is reachable). Then confirm the new rows are `pending`:

```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/general_quiz_questions?review_status=eq.pending&select=id&limit=5" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

- [ ] **Step 5: Commit**

```bash
git add app/api/cron/generate-general-quiz-questions/ app/api/cron/generate-scenario-quiz-questions/ vercel.json
git commit -m "Add cron routes for general and scenario quiz generation"
```

---

## Task 11: Admin review queues for both new tables

**Files:**
- Modify: `app/admin/quiz-review/page.tsx`

**Interfaces:**
- Consumes: `requireAdmin()` (already wired to this page), the `review_status`/`flagged` columns from Tasks 1 and 3.

No existing test file covers this page (it's a Server Component reading directly from the admin Supabase client) — verified manually per Step 2, same as the rest of this admin surface today.

- [ ] **Step 1: Extend the table union type and the two generic actions**

In `app/admin/quiz-review/page.tsx`, change:

```typescript
  if (table !== "daily_quiz_questions" && table !== "practice_cases") return;
```

to:

```typescript
  const validTables = ["daily_quiz_questions", "practice_cases", "general_quiz_questions", "scenario_quiz_questions"];
  if (!validTables.includes(table)) return;
```

and change the `ReviewButtons` component's prop type:

```typescript
function ReviewButtons({ table, id }: { table: "daily_quiz_questions" | "practice_cases"; id: string }) {
```

to:

```typescript
function ReviewButtons({ table, id }: { table: "daily_quiz_questions" | "practice_cases" | "general_quiz_questions" | "scenario_quiz_questions"; id: string }) {
```

Add two more flag actions, mirroring `flagQuestion`/`flagCase`:

```typescript
async function flagGeneral(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  await getSupabaseAdminClient().from("general_quiz_questions").update({ flagged: true }).eq("id", id);
  revalidatePath("/admin/quiz-review");
}

async function flagScenario(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  await getSupabaseAdminClient().from("scenario_quiz_questions").update({ flagged: true }).eq("id", id);
  revalidatePath("/admin/quiz-review");
}
```

- [ ] **Step 2: Fetch and split the two new tables in `QuizReviewPage`**

Change the `Promise.all` to include both new tables:

```typescript
  const [{ data: questions }, { data: cases }, { data: generalQuestions }, { data: scenarioQuestions }] = await Promise.all([
    admin
      .from("daily_quiz_questions")
      .select("id, pool_date, difficulty, term, question_text, flagged, review_status")
      .order("review_status")
      .order("pool_date", { ascending: false })
      .order("difficulty"),
    admin
      .from("practice_cases")
      .select("id, raw_input, industry, difficulty, flagged, review_status")
      .order("review_status")
      .order("difficulty"),
    admin
      .from("general_quiz_questions")
      .select("id, difficulty, question_text, flagged, review_status")
      .order("review_status")
      .order("difficulty"),
    admin
      .from("scenario_quiz_questions")
      .select("id, difficulty, question_text, flagged, review_status")
      .order("review_status")
      .order("difficulty"),
  ]);
```

Add below the existing `pendingCases`/`decidedCases` lines:

```typescript
  const pendingGeneral = (generalQuestions ?? []).filter((q) => q.review_status === "pending");
  const decidedGeneral = (generalQuestions ?? []).filter((q) => q.review_status !== "pending");
  const pendingScenario = (scenarioQuestions ?? []).filter((q) => q.review_status === "pending");
  const decidedScenario = (scenarioQuestions ?? []).filter((q) => q.review_status !== "pending");
```

- [ ] **Step 3: Add the two new sections to the JSX**

Insert after the existing "Scenario cases — pending review" `<section>` and before "Jargon questions — decided":

```tsx
      <section className="stack">
        <span className="card-label">Tech &amp; AI quiz — pending review ({pendingGeneral.length})</span>
        <div className="card">
          {pendingGeneral.length === 0 ? <p className="card-text">Nothing waiting on review.</p> : null}
          {pendingGeneral.map((question) => (
            <div className="history-row" key={question.id}>
              <div className="flex-1">
                <p className="mt-1 text-sm text-muted-foreground">{question.difficulty} · {question.question_text}</p>
              </div>
              <ReviewButtons table="general_quiz_questions" id={question.id} />
            </div>
          ))}
        </div>
      </section>

      <section className="stack">
        <span className="card-label">Scenario quiz — pending review ({pendingScenario.length})</span>
        <div className="card">
          {pendingScenario.length === 0 ? <p className="card-text">Nothing waiting on review.</p> : null}
          {pendingScenario.map((question) => (
            <div className="history-row" key={question.id}>
              <div className="flex-1">
                <p className="mt-1 text-sm text-muted-foreground">{question.difficulty} · {question.question_text}</p>
              </div>
              <ReviewButtons table="scenario_quiz_questions" id={question.id} />
            </div>
          ))}
        </div>
      </section>
```

And after the existing "Scenario cases — decided" section, at the end of the page (before the closing `</main>`):

```tsx
      <section className="stack">
        <span className="card-label">Tech &amp; AI quiz — decided</span>
        <div className="card">
          {decidedGeneral.map((question) => (
            <div className="history-row" key={question.id}>
              <div className="flex-1">
                <p className="mt-1 text-sm text-muted-foreground">{question.difficulty} · {question.question_text}</p>
              </div>
              {question.flagged ? (
                <span className="badge missed">Flagged — excluded</span>
              ) : question.review_status === "rejected" ? (
                <span className="badge missed">Rejected</span>
              ) : (
                <form action={flagGeneral}>
                  <input type="hidden" name="id" value={question.id} />
                  <button className="btn btn-secondary" type="submit">Flag</button>
                </form>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="stack">
        <span className="card-label">Scenario quiz — decided</span>
        <div className="card">
          {decidedScenario.map((question) => (
            <div className="history-row" key={question.id}>
              <div className="flex-1">
                <p className="mt-1 text-sm text-muted-foreground">{question.difficulty} · {question.question_text}</p>
              </div>
              {question.flagged ? (
                <span className="badge missed">Flagged — excluded</span>
              ) : question.review_status === "rejected" ? (
                <span className="badge missed">Rejected</span>
              ) : (
                <form action={flagScenario}>
                  <input type="hidden" name="id" value={question.id} />
                  <button className="btn btn-secondary" type="submit">Flag</button>
                </form>
              )}
            </div>
          ))}
        </div>
      </section>
```

- [ ] **Step 4: Verify manually**

```bash
npm.cmd run dev
```

Log in as `manyata126@gmail.com`, visit `http://localhost:3000/admin/quiz-review`. Confirm four pending queues and four decided sections render, and that Approve/Reject/Flag work on a row from each new table (run Task 10's cron routes first if the pending queues are empty).

- [ ] **Step 5: Run the full test suite and typecheck**

```bash
npm.cmd run lint
npx.cmd tsc --noEmit
npx.cmd vitest run
```

Expected: all clean, all passing.

- [ ] **Step 6: Commit**

```bash
git add app/admin/quiz-review/page.tsx
git commit -m "Add Tech & AI quiz and scenario quiz review queues to admin"
```
