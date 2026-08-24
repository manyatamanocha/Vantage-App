# Practice Content Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the one-time, hand-written `practice_cases` seed with a real pipeline that generates new practice scenarios on demand, filters out duplicates and low-quality/ambiguous candidates, and writes survivors into the database.

**Architecture:** Five new modules under `lib/content-pipeline/` (generate → dedupe → validate → orchestrate) plus one new `lib/supabase/admin.ts` service-role client, following the existing `lib/engine/` pattern of one focused Groq call per file with its own validation. No correct answer is ever stored — `recommendCategory()` still decides categories live, at play time, exactly as it does today.

**Tech Stack:** TypeScript, Next.js, Groq SDK (`openai/gpt-oss-120b`), Supabase (`@supabase/supabase-js`), Vitest.

**Spec:** `docs/superpowers/specs/2026-08-24-practice-content-pipeline-design.md`

## Global Constraints

- Never store a category/answer alongside a generated practice case — only `raw_input`, `industry`, `difficulty` are written to `practice_cases` (per spec's "Non-goal" section).
- No new paid services or external APIs — dedupe uses a plain in-process similarity check, not embeddings (per spec's Architecture section and `PRODUCT.md`'s "avoid paid services" constraint).
- Sequential Groq calls only, never `Promise.all` — this repo has already hit Groq's free-tier rate limit (8000 tokens/minute) doing this once (see `tests/eval/category-accuracy.test.ts`'s history). Every multi-call step in this plan must await each call before starting the next.
- All new engine-style modules follow the existing `lib/engine/` conventions: `withRetry` for the Groq call, `checkFinishReason` before parsing, `parseJsonResponse` with a type-guard validator.
- Insert into `practice_cases` only through the new service-role admin client — the table has no `insert` RLS policy for any other role (verified against all four existing migrations).

---

## Task 1: Admin Supabase client

**Files:**
- Create: `lib/supabase/admin.ts`

**Interfaces:**
- Produces: `getSupabaseAdminClient(): SupabaseClient` — a service-role client, no user session, no cookies. Later tasks use this to read/write `practice_cases` outside any request context.

- [ ] **Step 1: Write the file**

```typescript
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for code that runs outside any user's request
 * or session — the content pipeline's generation/insert job. `practice_cases`
 * has no `insert` RLS policy for any other role (see
 * supabase/migrations/0001_init.sql), so writing to it requires this client,
 * the same way the seed migration and the integration test suite already do
 * (see tests/integration/guess-then-reveal.test.ts's `admin` client).
 *
 * Never import this from a Server Component, a page, or anything that runs
 * on behalf of a signed-in user — it bypasses Row Level Security entirely.
 */
export function getSupabaseAdminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx.cmd tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/admin.ts
git commit -m "feat: add service-role Supabase client for the content pipeline"
```

---

## Task 2: Dedupe — similarity check

**Files:**
- Create: `lib/content-pipeline/dedupe.ts`
- Test: `lib/content-pipeline/__tests__/dedupe.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks — pure functions, no I/O.
- Produces:
  - `jaccardSimilarity(a: string, b: string): number` — 0 (no overlap) to 1 (identical token sets).
  - `DUPLICATE_THRESHOLD = 0.5` — exported constant, candidates scoring at or above this against any existing or earlier-kept text are dropped.
  - `dedupeCandidates<T extends { rawInput: string }>(candidates: T[], existingRawInputs: string[]): T[]` — returns the surviving candidates, in original order, checked against both `existingRawInputs` and against each other within the batch (an earlier-kept candidate counts as "existing" for a later one).

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/content-pipeline/__tests__/dedupe.test.ts
import { describe, it, expect } from "vitest";
import { jaccardSimilarity, dedupeCandidates, DUPLICATE_THRESHOLD } from "../dedupe";

describe("jaccardSimilarity", () => {
  it("returns 1 for identical text", () => {
    expect(jaccardSimilarity("flag fake reviews", "flag fake reviews")).toBe(1);
  });

  it("returns 0 for completely different text", () => {
    expect(jaccardSimilarity("flag fake reviews", "forecast quarterly demand")).toBe(0);
  });

  it("is case-insensitive and ignores punctuation", () => {
    expect(jaccardSimilarity("Flag Fake Reviews!", "flag fake reviews")).toBe(1);
  });

  it("scores high for near-duplicate phrasing", () => {
    const a = "An online marketplace wants every incoming product review sorted into genuine or fake before it goes live.";
    const b = "An online marketplace wants incoming product reviews sorted into genuine or fake before they go live.";
    expect(jaccardSimilarity(a, b)).toBeGreaterThanOrEqual(DUPLICATE_THRESHOLD);
  });

  it("scores low for genuinely different scenarios in the same domain", () => {
    const a = "An online marketplace wants every incoming product review sorted into genuine or fake before it goes live.";
    const b = "A logistics firm receives supplier invoices as scanned PDFs and wants the line items pulled out.";
    expect(jaccardSimilarity(a, b)).toBeLessThan(DUPLICATE_THRESHOLD);
  });
});

describe("dedupeCandidates", () => {
  it("keeps a candidate that doesn't resemble anything existing", () => {
    const candidates = [{ rawInput: "Forecast which customers will cancel next month." }];
    const result = dedupeCandidates(candidates, ["Flag fake product reviews before they go live."]);
    expect(result).toEqual(candidates);
  });

  it("drops a candidate that duplicates an existing row", () => {
    const candidates = [{ rawInput: "Flag fake product reviews before they go live." }];
    const result = dedupeCandidates(candidates, ["Flag fake product reviews before they go live on the site."]);
    expect(result).toEqual([]);
  });

  it("drops the second of two near-duplicate candidates within the same batch", () => {
    const candidates = [
      { rawInput: "Forecast which customers will cancel their subscription next month." },
      { rawInput: "Forecast which customers will cancel their subscription in the next month." },
    ];
    const result = dedupeCandidates(candidates, []);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(candidates[0]);
  });

  it("keeps candidates and existing rows unmodified — no mutation", () => {
    const candidates = [{ rawInput: "Forecast which customers will cancel next month.", extra: "kept" }];
    const existing = ["Flag fake product reviews before they go live."];
    dedupeCandidates(candidates, existing);
    expect(candidates[0]).toEqual({ rawInput: "Forecast which customers will cancel next month.", extra: "kept" });
    expect(existing).toEqual(["Flag fake product reviews before they go live."]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx.cmd vitest run lib/content-pipeline/__tests__/dedupe.test.ts`
Expected: FAIL — `Cannot find module '../dedupe'`.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/content-pipeline/dedupe.ts
/**
 * A plain in-process token-overlap similarity check, not an embeddings call —
 * deliberate, per the design spec's "no new paid services" constraint. At the
 * scale this pipeline operates on (tens to low hundreds of practice cases),
 * this is precise enough to catch near-duplicate phrasing without adding a
 * new external dependency.
 */
export const DUPLICATE_THRESHOLD = 0.5;

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
  );
}

export function jaccardSimilarity(a: string, b: string): number {
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

/**
 * Drops any candidate that's too similar to an existing row or to a
 * previously-kept candidate earlier in the same batch. Kept candidates are
 * checked against subsequent ones, so a run-on batch never inserts two
 * near-duplicates of each other even if neither matches anything in the DB.
 */
export function dedupeCandidates<T extends { rawInput: string }>(
  candidates: T[],
  existingRawInputs: string[]
): T[] {
  const kept: T[] = [];
  const comparisonPool = [...existingRawInputs];

  for (const candidate of candidates) {
    const isDuplicate = comparisonPool.some(
      (text) => jaccardSimilarity(candidate.rawInput, text) >= DUPLICATE_THRESHOLD
    );
    if (!isDuplicate) {
      kept.push(candidate);
      comparisonPool.push(candidate.rawInput);
    }
  }

  return kept;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx.cmd vitest run lib/content-pipeline/__tests__/dedupe.test.ts`
Expected: PASS, all 9 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/content-pipeline/dedupe.ts lib/content-pipeline/__tests__/dedupe.test.ts
git commit -m "feat: add token-overlap dedupe check for the content pipeline"
```

---

## Task 3: Candidate generation

**Files:**
- Create: `lib/content-pipeline/generate-cases.ts`
- Test: `lib/content-pipeline/__tests__/generate-cases.test.ts`

**Interfaces:**
- Consumes: `CATEGORY_TAXONOMY`, `isCategory`, `type Category` from `lib/engine/taxonomy.ts`; `getGroqClient` from `lib/groq.ts`; `withRetry` from `lib/engine/with-retry.ts`; `parseJsonResponse` from `lib/engine/parse-json-response.ts`; `checkFinishReason` from `lib/engine/check-finish-reason.ts`.
- Produces:
  - `type Difficulty = "easy" | "medium" | "hard"`
  - `type PracticeCaseCandidate = { rawInput: string; industry: string; intendedCategory: Category; difficulty: Difficulty }`
  - `generatePracticeCaseCandidates(): Promise<PracticeCaseCandidate[]>` — one Groq call, returns one candidate per taxonomy category (up to 8), each carrying the category/difficulty it was generated for. Candidates with an invalid category or difficulty are dropped, not thrown on (mirrors `reveal.ts`'s handling of off-taxonomy alternatives) — but an empty result after filtering throws.

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/content-pipeline/__tests__/generate-cases.test.ts
import { describe, it, expect, vi } from "vitest";

const mockCandidates = [
  { rawInput: "A retailer wants fake reviews flagged before they go live.", industry: "Retail", intendedCategory: "Classification", difficulty: "easy" },
  { rawInput: "A law firm wants a one-page brief of each long deposition.", industry: "Legal", intendedCategory: "Summarization", difficulty: "easy" },
  { rawInput: "A hospital wants nurse questions answered from its handbook.", industry: "Healthcare", intendedCategory: "RAG", difficulty: "medium" },
  { rawInput: "A fitness app wants to know which members will cancel soon.", industry: "Fitness", intendedCategory: "Prediction", difficulty: "medium" },
  { rawInput: "A marketing agency wants first-draft captions for new photos.", industry: "Marketing", intendedCategory: "Generation", difficulty: "easy" },
  { rawInput: "A logistics firm wants invoice line items pulled into its system.", industry: "Logistics", intendedCategory: "Extraction", difficulty: "medium" },
  { rawInput: "A grocery chain wants to suggest what shoppers add next.", industry: "Grocery", intendedCategory: "Recommendation", difficulty: "medium" },
  { rawInput: "A payments processor wants unusual transactions surfaced for review.", industry: "Financial services", intendedCategory: "Anomaly Detection", difficulty: "hard" },
];

const VALID_RESPONSE = {
  choices: [{ message: { content: JSON.stringify({ candidates: mockCandidates }) } }],
};

vi.mock("@/lib/groq", () => ({
  getGroqClient: vi.fn(() => ({
    chat: { completions: { create: async () => VALID_RESPONSE } },
  })),
}));

import { generatePracticeCaseCandidates } from "../generate-cases";
import { CATEGORY_TAXONOMY } from "@/lib/engine/taxonomy";

async function mockCompletionOnce(content: string) {
  const { getGroqClient } = await import("@/lib/groq");
  const create = vi.fn().mockResolvedValue({ choices: [{ message: { content } }] });
  vi.mocked(getGroqClient).mockReturnValueOnce({
    chat: { completions: { create } },
  } as never);
  return create;
}

describe("generatePracticeCaseCandidates", () => {
  it("returns one candidate per taxonomy category", async () => {
    const result = await generatePracticeCaseCandidates();
    expect(result).toHaveLength(8);
    expect(result.map((c) => c.intendedCategory).sort()).toEqual([...CATEGORY_TAXONOMY].sort());
  });

  it("asks for JSON mode and disables the SDK's own retries", async () => {
    const create = await mockCompletionOnce(JSON.stringify({ candidates: mockCandidates }));
    await generatePracticeCaseCandidates();
    const [body, options] = create.mock.calls[0];
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(options.maxRetries).toBe(0);
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it("drops a candidate with a category outside the taxonomy rather than throwing", async () => {
    const withBadCategory = [
      ...mockCandidates.slice(0, 7),
      { rawInput: "Something vague.", industry: "Generic", intendedCategory: "Vector Search", difficulty: "medium" },
    ];
    await mockCompletionOnce(JSON.stringify({ candidates: withBadCategory }));
    const result = await generatePracticeCaseCandidates();
    expect(result).toHaveLength(7);
    expect(result.every((c) => c.intendedCategory !== "Vector Search")).toBe(true);
  });

  it("drops a candidate with an invalid difficulty rather than throwing", async () => {
    const withBadDifficulty = [
      ...mockCandidates.slice(0, 7),
      { rawInput: "Something vague.", industry: "Generic", intendedCategory: "Generation", difficulty: "extreme" },
    ];
    await mockCompletionOnce(JSON.stringify({ candidates: withBadDifficulty }));
    const result = await generatePracticeCaseCandidates();
    expect(result).toHaveLength(7);
  });

  it("throws when every candidate is invalid", async () => {
    await mockCompletionOnce(JSON.stringify({ candidates: [] }));
    await expect(generatePracticeCaseCandidates()).rejects.toThrow(/no usable/i);
  });

  it("throws a clear truncation error when finish_reason is 'length'", async () => {
    const { getGroqClient } = await import("@/lib/groq");
    vi.mocked(getGroqClient).mockReturnValueOnce({
      chat: {
        completions: {
          create: async () => ({
            choices: [{ finish_reason: "length", message: { content: '{"candidates": [' } }],
          }),
        },
      },
    } as never);
    await expect(generatePracticeCaseCandidates()).rejects.toThrow(/truncated/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx.cmd vitest run lib/content-pipeline/__tests__/generate-cases.test.ts`
Expected: FAIL — `Cannot find module '../generate-cases'`.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/content-pipeline/generate-cases.ts
import { getGroqClient } from "@/lib/groq";
import { withRetry } from "@/lib/engine/with-retry";
import { parseJsonResponse } from "@/lib/engine/parse-json-response";
import { checkFinishReason } from "@/lib/engine/check-finish-reason";
import { CATEGORY_TAXONOMY, isCategory, type Category } from "@/lib/engine/taxonomy";

export type Difficulty = "easy" | "medium" | "hard";

export type PracticeCaseCandidate = {
  rawInput: string;
  industry: string;
  intendedCategory: Category;
  difficulty: Difficulty;
};

const DIFFICULTIES: readonly Difficulty[] = ["easy", "medium", "hard"];

function isDifficulty(value: string): value is Difficulty {
  return (DIFFICULTIES as readonly string[]).includes(value);
}

// Groq's JSON mode requires the word "JSON" to appear in the messages — it is
// in this system prompt, which is sent on every call.
const SYSTEM_PROMPT = `You write short, realistic client-problem scenarios for a daily practice quiz, one for each AI-approach category in this fixed list: ${CATEGORY_TAXONOMY.join(", ")}.

Write exactly one scenario per category, in the order given above.

Rules:
1. Each scenario is one or two sentences, phrased the way a real client would describe their problem — never as a definition of the category, and never naming a specific commercial product, vendor, or model.
2. Vary the industry across scenarios (e.g. retail, legal, healthcare, logistics, marketing, financial services, manufacturing, energy) — do not repeat an industry.
3. Assign a "difficulty": "easy" when there's one dominant reading and little to argue with, "medium" when a plausible wrong answer sits next to the right one, "hard" when the obvious first instinct is usually the wrong one.
4. "intendedCategory" must be copied verbatim from the fixed list above — the exact category this scenario was written for.

Respond with ONLY a JSON object in this shape — no prose, no markdown fences:
{"candidates": [{"rawInput": string, "industry": string, "intendedCategory": string, "difficulty": "easy" | "medium" | "hard"}]}`;

type RawCandidate = {
  rawInput: string;
  industry: string;
  intendedCategory: string;
  difficulty: string;
};

type RawResponse = { candidates: RawCandidate[] };

function isRawResponse(parsed: unknown): parsed is RawResponse {
  if (typeof parsed !== "object" || parsed === null) return false;
  const candidate = parsed as Partial<RawResponse>;
  return (
    Array.isArray(candidate.candidates) &&
    candidate.candidates.every(
      (c) =>
        typeof c === "object" &&
        c !== null &&
        typeof (c as RawCandidate).rawInput === "string" &&
        typeof (c as RawCandidate).industry === "string" &&
        typeof (c as RawCandidate).intendedCategory === "string" &&
        typeof (c as RawCandidate).difficulty === "string"
    )
  );
}

export async function generatePracticeCaseCandidates(): Promise<PracticeCaseCandidate[]> {
  const client = getGroqClient();

  const response = await withRetry((signal) =>
    client.chat.completions.create(
      {
        model: "openai/gpt-oss-120b",
        reasoning_effort: "low",
        max_tokens: 2000,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: SYSTEM_PROMPT }],
      },
      { maxRetries: 0, signal }
    )
  );

  checkFinishReason(response.choices[0]?.finish_reason, "generate-cases");

  const text = response.choices[0]?.message?.content ?? "";
  const parsed = parseJsonResponse(text, isRawResponse, "generate-cases");

  // Off-taxonomy category or bad difficulty is dropped, not fatal — mirrors
  // reveal.ts's handling of off-taxonomy alternatives: one bad item in a
  // batch shouldn't discard the rest.
  const candidates: PracticeCaseCandidate[] = parsed.candidates
    .filter((c) => isCategory(c.intendedCategory) && isDifficulty(c.difficulty))
    .map((c) => ({
      rawInput: c.rawInput,
      industry: c.industry,
      intendedCategory: c.intendedCategory as Category,
      difficulty: c.difficulty as Difficulty,
    }));

  if (candidates.length === 0) {
    throw new Error("Model returned no usable practice-case candidates");
  }

  return candidates;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx.cmd vitest run lib/content-pipeline/__tests__/generate-cases.test.ts`
Expected: PASS, all 6 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/content-pipeline/generate-cases.ts lib/content-pipeline/__tests__/generate-cases.test.ts
git commit -m "feat: generate candidate practice cases via Groq"
```

---

## Task 4: Candidate validation

**Files:**
- Create: `lib/content-pipeline/validate-candidate.ts`
- Test: `lib/content-pipeline/__tests__/validate-candidate.test.ts`

**Interfaces:**
- Consumes: `PracticeCaseCandidate` from `./generate-cases`; `recommendCategory` from `@/lib/engine/reveal`; `assertNoNamedProducts` from `@/lib/engine/guardrails`.
- Produces:
  - `type ValidationResult = { valid: true } | { valid: false; reason: string }`
  - `validateCandidate(candidate: PracticeCaseCandidate): Promise<ValidationResult>` — never throws; every failure mode (guardrail trip, category mismatch, or any error from `recommendCategory`) is captured and returned as `{ valid: false, reason }`.

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/content-pipeline/__tests__/validate-candidate.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/engine/reveal", () => ({
  recommendCategory: vi.fn(),
}));

import { validateCandidate } from "../validate-candidate";
import { recommendCategory } from "@/lib/engine/reveal";
import type { PracticeCaseCandidate } from "../generate-cases";

const CANDIDATE: PracticeCaseCandidate = {
  rawInput: "A retailer wants fake reviews flagged before they go live.",
  industry: "Retail",
  intendedCategory: "Classification",
  difficulty: "easy",
};

const REVEAL_MATCH = {
  match: true,
  revealedCategory: "Classification",
  whyItFits: "Each review is sorted into genuine or fake.",
  whyNotAlternatives: [{ category: "RAG", reason: "There's nothing to retrieve here." }],
  toolClass: "specialized" as const,
};

describe("validateCandidate", () => {
  it("accepts a candidate whose live-recomputed category matches its intended one", async () => {
    vi.mocked(recommendCategory).mockResolvedValueOnce(REVEAL_MATCH);
    const result = await validateCandidate(CANDIDATE);
    expect(result).toEqual({ valid: true });
  });

  it("calls recommendCategory with the candidate text as both goal and problemType", async () => {
    vi.mocked(recommendCategory).mockResolvedValueOnce(REVEAL_MATCH);
    await validateCandidate(CANDIDATE);
    expect(recommendCategory).toHaveBeenCalledWith({
      goal: CANDIDATE.rawInput,
      problemType: CANDIDATE.rawInput,
      guessedCategory: CANDIDATE.intendedCategory,
    });
  });

  it("rejects a candidate whose live-recomputed category disagrees with its intended one", async () => {
    vi.mocked(recommendCategory).mockResolvedValueOnce({ ...REVEAL_MATCH, revealedCategory: "RAG", match: false });
    const result = await validateCandidate(CANDIDATE);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/disagrees|mismatch/i);
  });

  it("rejects a candidate whose raw_input names a specific product", async () => {
    const withProduct: PracticeCaseCandidate = {
      ...CANDIDATE,
      rawInput: "A retailer wants ChatGPT to flag fake reviews.",
    };
    const result = await validateCandidate(withProduct);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/named a specific product/i);
    expect(recommendCategory).not.toHaveBeenCalled();
  });

  it("rejects, rather than throws, when recommendCategory itself fails", async () => {
    vi.mocked(recommendCategory).mockRejectedValueOnce(new Error("groq is down"));
    const result = await validateCandidate(CANDIDATE);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/groq is down/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx.cmd vitest run lib/content-pipeline/__tests__/validate-candidate.test.ts`
Expected: FAIL — `Cannot find module '../validate-candidate'`.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/content-pipeline/validate-candidate.ts
import { recommendCategory } from "@/lib/engine/reveal";
import { assertNoNamedProducts } from "@/lib/engine/guardrails";
import type { PracticeCaseCandidate } from "./generate-cases";

export type ValidationResult = { valid: true } | { valid: false; reason: string };

/**
 * Never throws — every rejection reason (guardrail trip, category mismatch,
 * or any failure from recommendCategory itself) is captured and returned, so
 * run-pipeline.ts can drop one bad candidate without losing the rest of the
 * batch.
 */
export async function validateCandidate(
  candidate: PracticeCaseCandidate
): Promise<ValidationResult> {
  try {
    // Checked separately from recommendCategory's own internal guardrail
    // checks: those cover the MODEL's generated explanation text, not the
    // candidate's own input scenario, which came from a different call site
    // (generate-cases.ts) and could itself name a product.
    assertNoNamedProducts(candidate.rawInput, "practice-candidate.rawInput");

    // The candidate's "correct answer" is never stored (see the design
    // spec's Non-goal section) — this call exists only to check the
    // scenario isn't so ambiguous that the live engine would disagree with
    // what it was generated for.
    const result = await recommendCategory({
      goal: candidate.rawInput,
      problemType: candidate.rawInput,
      guessedCategory: candidate.intendedCategory,
    });

    if (result.revealedCategory !== candidate.intendedCategory) {
      return {
        valid: false,
        reason: `Live engine disagrees with intended category: generated for "${candidate.intendedCategory}", live engine revealed "${result.revealedCategory}" — scenario is likely too ambiguous.`,
      };
    }

    return { valid: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, reason: message };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx.cmd vitest run lib/content-pipeline/__tests__/validate-candidate.test.ts`
Expected: PASS, all 5 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/content-pipeline/validate-candidate.ts lib/content-pipeline/__tests__/validate-candidate.test.ts
git commit -m "feat: validate practice-case candidates against the live engine"
```

---

## Task 5: Pipeline orchestration

**Files:**
- Create: `lib/content-pipeline/run-pipeline.ts`
- Test: `lib/content-pipeline/__tests__/run-pipeline.test.ts`

**Interfaces:**
- Consumes: `generatePracticeCaseCandidates` from `./generate-cases`; `dedupeCandidates` from `./dedupe`; `validateCandidate` from `./validate-candidate`; `getSupabaseAdminClient` from `@/lib/supabase/admin`.
- Produces:
  - `type PipelineSummary = { generated: number; rejectedDuplicate: number; rejectedValidation: number; inserted: number }`
  - `runContentPipeline(): Promise<PipelineSummary>`

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/content-pipeline/__tests__/run-pipeline.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  existingRawInputs: [] as string[],
  inserted: [] as Record<string, unknown>[],
}));

const CANDIDATES = [
  { rawInput: "A retailer wants fake reviews flagged before they go live.", industry: "Retail", intendedCategory: "Classification", difficulty: "easy" as const },
  { rawInput: "A hospital wants nurse questions answered from its handbook.", industry: "Healthcare", intendedCategory: "RAG", difficulty: "medium" as const },
];

vi.mock("../generate-cases", () => ({
  generatePracticeCaseCandidates: vi.fn(async () => CANDIDATES),
}));

vi.mock("../dedupe", () => ({
  dedupeCandidates: vi.fn((candidates: typeof CANDIDATES, existing: string[]) =>
    candidates.filter((c) => !existing.includes(c.rawInput))
  ),
}));

vi.mock("../validate-candidate", () => ({
  validateCandidate: vi.fn(async () => ({ valid: true })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => ({
    from: (table: string) => {
      if (table !== "practice_cases") throw new Error(`unexpected table: ${table}`);
      return {
        select: () => ({
          eq: () => ({
            then: (resolve: (v: { data: { raw_input: string }[]; error: null }) => unknown) =>
              Promise.resolve({
                data: state.existingRawInputs.map((raw_input) => ({ raw_input })),
                error: null,
              }).then(resolve),
          }),
        }),
        insert: (rows: Record<string, unknown>[]) => {
          state.inserted.push(...rows);
          return Promise.resolve({ error: null });
        },
      };
    },
  }),
}));

import { runContentPipeline } from "../run-pipeline";
import { validateCandidate } from "../validate-candidate";
import { dedupeCandidates } from "../dedupe";

beforeEach(() => {
  state.existingRawInputs = [];
  state.inserted = [];
  vi.clearAllMocks();
  vi.mocked(dedupeCandidates).mockImplementation((candidates: typeof CANDIDATES, existing: string[]) =>
    candidates.filter((c) => !existing.includes(c.rawInput))
  );
  vi.mocked(validateCandidate).mockResolvedValue({ valid: true });
});

describe("runContentPipeline", () => {
  it("inserts every generated candidate when nothing is filtered", async () => {
    const summary = await runContentPipeline();
    expect(summary).toEqual({ generated: 2, rejectedDuplicate: 0, rejectedValidation: 0, inserted: 2 });
    expect(state.inserted).toEqual([
      { raw_input: CANDIDATES[0].rawInput, industry: "Retail", difficulty: "easy" },
      { raw_input: CANDIDATES[1].rawInput, industry: "Healthcare", difficulty: "medium" },
    ]);
  });

  it("never writes the intended category to the database", async () => {
    await runContentPipeline();
    for (const row of state.inserted) {
      expect(row).not.toHaveProperty("intendedCategory");
      expect(row).not.toHaveProperty("category");
      expect(row).not.toHaveProperty("intended_category");
    }
  });

  it("counts a deduped candidate as rejectedDuplicate, not inserted", async () => {
    state.existingRawInputs = [CANDIDATES[0].rawInput];
    const summary = await runContentPipeline();
    expect(summary).toEqual({ generated: 2, rejectedDuplicate: 1, rejectedValidation: 0, inserted: 1 });
    expect(state.inserted).toHaveLength(1);
    expect(state.inserted[0].raw_input).toBe(CANDIDATES[1].rawInput);
  });

  it("counts a validation-rejected candidate as rejectedValidation, not inserted", async () => {
    vi.mocked(validateCandidate)
      .mockResolvedValueOnce({ valid: false, reason: "ambiguous" })
      .mockResolvedValueOnce({ valid: true });
    const summary = await runContentPipeline();
    expect(summary).toEqual({ generated: 2, rejectedDuplicate: 0, rejectedValidation: 1, inserted: 1 });
    expect(state.inserted).toHaveLength(1);
    expect(state.inserted[0].raw_input).toBe(CANDIDATES[1].rawInput);
  });

  it("validates candidates sequentially, never with Promise.all", async () => {
    const callOrder: number[] = [];
    vi.mocked(validateCandidate).mockImplementation(async (candidate) => {
      const index = CANDIDATES.findIndex((c) => c.rawInput === candidate.rawInput);
      callOrder.push(index);
      // If run in parallel, the second call could start before this resolves.
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { valid: true };
    });
    await runContentPipeline();
    expect(callOrder).toEqual([0, 1]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx.cmd vitest run lib/content-pipeline/__tests__/run-pipeline.test.ts`
Expected: FAIL — `Cannot find module '../run-pipeline'`.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/content-pipeline/run-pipeline.ts
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { generatePracticeCaseCandidates, type PracticeCaseCandidate } from "./generate-cases";
import { dedupeCandidates } from "./dedupe";
import { validateCandidate } from "./validate-candidate";

export type PipelineSummary = {
  generated: number;
  rejectedDuplicate: number;
  rejectedValidation: number;
  inserted: number;
};

export async function runContentPipeline(): Promise<PipelineSummary> {
  const supabase = getSupabaseAdminClient();

  const candidates = await generatePracticeCaseCandidates();

  const { data: existingRows, error: fetchErr } = await supabase
    .from("practice_cases")
    .select("raw_input")
    .eq("active", true);
  if (fetchErr) throw new Error(fetchErr.message);
  const existingRawInputs = (existingRows as { raw_input: string }[]).map((r) => r.raw_input);

  const deduped = dedupeCandidates(candidates, existingRawInputs);
  const rejectedDuplicate = candidates.length - deduped.length;

  // Sequential, not Promise.all: this repo has already hit Groq's free-tier
  // rate limit doing this once (see tests/eval/category-accuracy.test.ts),
  // and validateCandidate makes one Groq call per candidate.
  const toInsert: PracticeCaseCandidate[] = [];
  let rejectedValidation = 0;
  for (const candidate of deduped) {
    const result = await validateCandidate(candidate);
    if (result.valid) {
      toInsert.push(candidate);
    } else {
      rejectedValidation += 1;
    }
  }

  if (toInsert.length > 0) {
    const { error: insertErr } = await supabase.from("practice_cases").insert(
      // Only these three columns — the candidate's intendedCategory is
      // deliberately never written. See the design spec's Non-goal section:
      // recommendCategory() decides the category live, every time a user
      // plays the case, exactly as it does today.
      toInsert.map((c) => ({
        raw_input: c.rawInput,
        industry: c.industry,
        difficulty: c.difficulty,
      }))
    );
    if (insertErr) throw new Error(insertErr.message);
  }

  return {
    generated: candidates.length,
    rejectedDuplicate,
    rejectedValidation,
    inserted: toInsert.length,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx.cmd vitest run lib/content-pipeline/__tests__/run-pipeline.test.ts`
Expected: PASS, all 5 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/content-pipeline/run-pipeline.ts lib/content-pipeline/__tests__/run-pipeline.test.ts
git commit -m "feat: orchestrate the content pipeline end to end"
```

---

## Task 6: Live integration test

**Files:**
- Create: `tests/integration/content-pipeline-live.test.ts`

**Interfaces:**
- Consumes: `runContentPipeline` from `@/lib/content-pipeline/run-pipeline`.
- Produces: nothing new — a real, gated end-to-end check.

- [ ] **Step 1: Write the test**

```typescript
// tests/integration/content-pipeline-live.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runContentPipeline } from "@/lib/content-pipeline/run-pipeline";

// ---------------------------------------------------------------------------
// A real run of the content pipeline against real Groq and the real Supabase
// project — the one place in this app that writes shared content everyone
// sees, not user-scoped data, which is a higher blast radius than the rest
// of the app and justifies one real end-to-end check before this is ever
// run on a schedule.
//
// Costs real API calls and writes real rows (cleaned up in afterAll), so it
// is gated behind INTEGRATION=1, same as the rest of this suite.
//
// Run: INTEGRATION=1 npx vitest run tests/integration/content-pipeline-live.test.ts
// ---------------------------------------------------------------------------

const RUN = process.env.INTEGRATION === "1";

describe.skipIf(!RUN)("content pipeline (real Groq + real Supabase)", () => {
  let admin: SupabaseClient;
  let existingIdsBefore: Set<string>;

  beforeAll(async () => {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY ||
      !process.env.GROQ_API_KEY
    ) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and GROQ_API_KEY are all required to run this integration test"
      );
    }
    admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data } = await admin.from("practice_cases").select("id");
    existingIdsBefore = new Set((data ?? []).map((r) => r.id as string));
  });

  afterAll(async () => {
    // Best-effort cleanup: delete only the rows this run actually inserted,
    // identified by not having existed beforehand — never touch the
    // pre-existing seeded pool.
    const { data } = await admin.from("practice_cases").select("id");
    const newIds = (data ?? [])
      .map((r) => r.id as string)
      .filter((id) => !existingIdsBefore.has(id));
    if (newIds.length > 0) {
      await admin.from("practice_cases").delete().in("id", newIds);
    }
  });

  it("generates, validates, and inserts real practice cases without storing a category", async () => {
    const summary = await runContentPipeline();

    expect(summary.generated).toBeGreaterThan(0);
    expect(summary.inserted).toBeGreaterThan(0);
    expect(summary.inserted).toBeLessThanOrEqual(summary.generated);

    const { data: rows, error } = await admin
      .from("practice_cases")
      .select("id")
      .order("id", { ascending: false })
      .limit(summary.inserted);
    expect(error).toBeNull();
    expect(rows?.length).toBe(summary.inserted);

    // Confirm no category ever landed in the table — practice_cases has no
    // such column at all, so this is really confirming the insert didn't
    // error trying to write one.
    const { data: fullRows, error: fullErr } = await admin
      .from("practice_cases")
      .select("*")
      .in("id", (rows ?? []).map((r) => r.id));
    expect(fullErr).toBeNull();
    for (const row of fullRows ?? []) {
      expect(Object.keys(row)).not.toContain("category");
      expect(Object.keys(row)).not.toContain("intended_category");
    }
  });
});
```

- [ ] **Step 2: Type-check**

Run: `npx.cmd tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run the live test**

Run: `INTEGRATION=1 npx.cmd vitest run tests/integration/content-pipeline-live.test.ts`
Expected: PASS. This makes real Groq calls (one generation call, then one `recommendCategory` call per surviving candidate — sequential, so this can take a minute or more) and writes/cleans up real rows in the configured Supabase project.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/content-pipeline-live.test.ts
git commit -m "test: add live integration test for the content pipeline"
```

---

## Task 7: Full-suite verification

**Files:** none created or modified — verification only.

- [ ] **Step 1: Type-check the whole project**

Run: `npx.cmd tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Lint the whole project**

Run: `npm.cmd run lint`
Expected: 0 errors (pre-existing warnings in `.claude/skills/impeccable/scripts/*` are unrelated and expected).

- [ ] **Step 3: Run the full unit suite**

Run: `npx.cmd vitest run`
Expected: all tests pass; `tests/integration/*` and `tests/eval/*` self-skip (no `INTEGRATION`/`EVAL` env vars set).

- [ ] **Step 4: Run the eval suite to confirm nothing in the shared engine regressed**

Run: `EVAL=1 npx.cmd vitest run tests/eval/category-accuracy.test.ts`
Expected: PASS — this plan never modifies `lib/engine/reveal.ts`'s behavior, only adds a new consumer of it, so the existing accuracy floor should be unaffected.

---

## Self-review notes

- **Spec coverage:** all 5 components from the spec (generate, dedupe, validate, orchestrate, admin client) have a task; the deferred scheduling decision and batch-size/cadence tuning are explicitly out of scope per the spec's "Open items" section and are not tasks here.
- **Type consistency checked:** `PracticeCaseCandidate` is defined once in Task 3 and imported (never redefined) in Tasks 4 and 5; `ValidationResult` is defined once in Task 4 and imported in Task 5's test mocks; `PipelineSummary` is defined once in Task 5.
- **No placeholders:** every step has complete, runnable code — no "add error handling" or "similar to Task N" shortcuts.
