# Vantage App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Vantage as a real, working web app — a guess-then-reveal tool that turns a messy client problem into an AI-approach category recommendation, reused across a reactive loop (live problems) and a proactive loop (daily practice).

**Architecture:** Next.js (App Router, TypeScript) full-stack app on Vercel. Supabase for Postgres + Auth + Storage. Groq API (Groq SDK, free tier) called server-side only, at three call sites (Structure, Reveal, Handback) that share one "understand → recommend" engine module.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind + shadcn/ui, Supabase (Postgres/Auth/Storage), `groq-sdk`, Vitest (unit), Playwright or integration tests against local Supabase CLI.

**Spec:** `docs/superpowers/specs/2026-08-23-vantage-app-design.md`

## Global Constraints

- Groq API calls happen **server-side only** (route handlers / server actions) — the API key must never reach the browser bundle.
- Every AI output the user sees must be confirmable/correctable before it's treated as final (Structure step has an Edit affordance; nothing skips straight from AI output to persisted truth without the user seeing it).
- Guess step (Feature 4) is pure client-side — no network dependency, no AI call.
- One shared engine module powers both the reactive loop and the proactive (practice) loop — do not fork the logic.
- Recommendations are category-level and tool-class-level only, never a named product (per Solution Overview — "never says 'use Tool X'").
- Each Groq call site wraps with a single retry + timeout; on failure, no fallback content is invented, and any already-persisted input from earlier steps is preserved.
- Auth is work-email based (Feature 1).
- Groq's free tier is rate-limited — the retry/timeout wrapper is the only rate-limit handling for the MVP; no queueing or backoff beyond one retry.

---

## Phase 0 — Project Scaffolding
**Recommended coding-agent model: Haiku** (boilerplate/config, no novel logic — cheap and fast is the right trade here)

### Task 1: Initialize Next.js project, Supabase client, Groq client

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`
- Create: `lib/supabase/client.ts` (browser client)
- Create: `lib/supabase/server.ts` (server client, cookie-based auth)
- Create: `lib/groq.ts` (server-only Groq client singleton)
- Create: `.env.local.example`
- Test: `lib/__tests__/groq.test.ts`

**Interfaces:**
- Produces: `getSupabaseServerClient(): SupabaseClient` from `lib/supabase/server.ts`, used by every server action in later tasks.
- Produces: `getGroqClient(): Groq` from `lib/groq.ts`, used by all three Groq call sites (Phases 2, 3, 6).

- [ ] **Step 1: Scaffold the Next.js app**

```bash
npx create-next-app@latest vantage-app --typescript --tailwind --app --src-dir=false --import-alias "@/*"
cd vantage-app
npx shadcn@latest init -d
npm install @supabase/supabase-js @supabase/ssr groq-sdk
npm install -D vitest @vitejs/plugin-react
```

- [ ] **Step 2: Add environment variable template**

`.env.local.example`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GROQ_API_KEY=
```

- [ ] **Step 3: Write `lib/groq.ts`**

```typescript
import Groq from "groq-sdk";

let client: Groq | null = null;

export function getGroqClient(): Groq {
  if (typeof window !== "undefined") {
    throw new Error("getGroqClient() must only be called server-side");
  }
  if (!client) {
    client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return client;
}
```

- [ ] **Step 4: Write the failing test for the server-only guard**

`lib/__tests__/groq.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";

describe("getGroqClient", () => {
  it("throws when called in a browser-like environment", async () => {
    vi.stubGlobal("window", {});
    const { getGroqClient } = await import("../groq");
    expect(() => getGroqClient()).toThrow(/server-side/);
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 5: Run test to verify it fails, then passes**

Run: `npx vitest run lib/__tests__/groq.test.ts`
Expected: passes once `lib/groq.ts` exists as written above (write test after implementation here since this is a scaffolding guard, not new behavior — confirm it fails if you comment out the `typeof window` check, then restore it).

- [ ] **Step 6: Write `lib/supabase/client.ts` and `lib/supabase/server.ts`**

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";

export function getSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

```typescript
// lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) =>
          list.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
      },
    }
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Supabase and Groq clients"
```

---

## Phase 1 — Auth & Data Model
**Recommended coding-agent model: Sonnet** (schema correctness and auth wiring are well-trodden but need care — not boilerplate, not novel reasoning)

### Task 2: Database schema migration

**Files:**
- Create: `supabase/migrations/0001_init.sql`
- Test: `supabase/tests/0001_init.test.sql` (pgTAP, or manual check via `supabase db reset` if pgTAP unavailable)

**Interfaces:**
- Produces tables: `solves`, `takeaways`, `practice_cases`, `user_settings` — consumed by every task from Phase 2 onward.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0001_init.sql
create table solves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('live', 'practice')),
  raw_input text not null,
  industry text,
  goal text,
  problem_type text,
  guessed_category text,
  revealed_category text,
  tool_class text,
  correct boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table takeaways (
  id uuid primary key default gen_random_uuid(),
  solve_id uuid not null references solves(id) on delete cascade,
  draft_text text not null,
  generated_at timestamptz not null default now()
);

create table practice_cases (
  id uuid primary key default gen_random_uuid(),
  raw_input text not null,
  industry text,
  difficulty text not null default 'medium',
  active boolean not null default true
);

create table user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  practice_difficulty text not null default 'medium',
  practice_frequency text not null default 'daily'
);

alter table solves enable row level security;
alter table takeaways enable row level security;
alter table user_settings enable row level security;

create policy "own solves" on solves for all using (auth.uid() = user_id);
create policy "own takeaways" on takeaways for all using (
  auth.uid() = (select user_id from solves where solves.id = takeaways.solve_id)
);
create policy "own settings" on user_settings for all using (auth.uid() = user_id);
```

- [ ] **Step 2: Apply and verify locally**

Run: `supabase db reset`
Expected: migration applies with no errors; `supabase db diff` shows no drift.

- [ ] **Step 3: Verify RLS with a manual query**

Run (via `supabase db execute` or SQL editor), as an authenticated test user, confirm you cannot select another user's `solves` row:
```sql
select * from solves where user_id != auth.uid();
```
Expected: 0 rows regardless of data present, because RLS blocks it.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_init.sql
git commit -m "feat: add solves/takeaways/practice_cases/user_settings schema with RLS"
```

### Task 3: Sign-up / Login (Feature 1)

**Files:**
- Create: `app/(auth)/signup/page.tsx`
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/actions.ts`
- Test: `app/(auth)/__tests__/actions.test.ts`

**Interfaces:**
- Consumes: `getSupabaseServerClient()` from Task 1.
- Produces: `signUpWithEmail(formData: FormData): Promise<{ error?: string }>`, `signInWithEmail(formData: FormData): Promise<{ error?: string }>` — used by the two page forms, and by any later page that needs to check auth state via Supabase's session.

- [ ] **Step 1: Write the failing test for signUpWithEmail validation**

```typescript
// app/(auth)/__tests__/actions.test.ts
import { describe, it, expect } from "vitest";
import { signUpWithEmail } from "../actions";

describe("signUpWithEmail", () => {
  it("rejects missing email", async () => {
    const fd = new FormData();
    fd.set("password", "correcthorsebatterystaple");
    const result = await signUpWithEmail(fd);
    expect(result.error).toMatch(/email/i);
  });
});
```

- [ ] **Step 2: Run test, verify it fails** (module doesn't exist yet)

Run: `npx vitest run app/(auth)/__tests__/actions.test.ts`
Expected: FAIL — cannot find module `../actions`.

- [ ] **Step 3: Implement `actions.ts`**

```typescript
"use server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function signUpWithEmail(formData: FormData): Promise<{ error?: string }> {
  const email = formData.get("email")?.toString() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  if (!email) return { error: "Email is required" };
  if (!password || password.length < 8) return { error: "Password must be at least 8 characters" };

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };
  return {};
}

export async function signInWithEmail(formData: FormData): Promise<{ error?: string }> {
  const email = formData.get("email")?.toString() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  if (!email || !password) return { error: "Email and password are required" };

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  return {};
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run app/(auth)/__tests__/actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Build the sign-up and login pages (screen 2a)**

```tsx
// app/(auth)/signup/page.tsx
import { signUpWithEmail } from "../actions";

export default function SignUpPage() {
  return (
    <form action={async (fd) => { "use server"; await signUpWithEmail(fd); }}>
      <input name="email" type="email" placeholder="Work email" required />
      <input name="password" type="password" placeholder="Password" required minLength={8} />
      <button type="submit">Sign up</button>
    </form>
  );
}
```

(Login page follows the same shape, calling `signInWithEmail`.)

- [ ] **Step 6: Commit**

```bash
git add app/\(auth\)
git commit -m "feat: work-email sign-up and login (Feature 1)"
```

---

## Phase 2 — Intake & Structure (first Groq call site)
**Recommended coding-agent model: Opus** (this is the first prompt-engineering surface in the app — the parsing contract set here is reused by Phase 3, so it's worth the stronger model)

### Task 4: Intake form (Feature 2)

**Files:**
- Create: `app/solve/new/page.tsx`
- Create: `app/solve/new/actions.ts`
- Test: `app/solve/new/__tests__/actions.test.ts`

**Interfaces:**
- Consumes: `getSupabaseServerClient()` (Task 1).
- Produces: `createDraftSolve(input: { rawInput: string; industry?: string; source: "live" | "practice" }): Promise<{ solveId: string }>` — consumed by Task 5 (Structure step) and Task 9 (practice loop).

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi } from "vitest";
import { createDraftSolve } from "../actions";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: () => ({
      insert: () => ({
        select: () => ({
          single: async () => ({ data: { id: "s1" }, error: null }),
        }),
      }),
    }),
  }),
}));

describe("createDraftSolve", () => {
  it("returns the new solve id", async () => {
    const result = await createDraftSolve({ rawInput: "client wants churn prediction", source: "live" });
    expect(result.solveId).toBe("s1");
  });

  it("rejects empty raw input", async () => {
    await expect(createDraftSolve({ rawInput: "", source: "live" })).rejects.toThrow(/raw input/i);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run app/solve/new/__tests__/actions.test.ts`
Expected: FAIL — `createDraftSolve` not defined.

- [ ] **Step 3: Implement**

```typescript
"use server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function createDraftSolve(input: {
  rawInput: string;
  industry?: string;
  source: "live" | "practice";
}): Promise<{ solveId: string }> {
  if (!input.rawInput.trim()) throw new Error("Raw input is required");

  const supabase = await getSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("solves")
    .insert({
      user_id: userId,
      source: input.source,
      raw_input: input.rawInput,
      industry: input.industry ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return { solveId: data.id };
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run app/solve/new/__tests__/actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Build the intake page (screen 2c)**

```tsx
// app/solve/new/page.tsx
import { createDraftSolve } from "./actions";
import { redirect } from "next/navigation";

export default function NewSolvePage() {
  async function handleSubmit(formData: FormData) {
    "use server";
    const { solveId } = await createDraftSolve({
      rawInput: formData.get("rawInput")!.toString(),
      industry: formData.get("industry")?.toString() || undefined,
      source: "live",
    });
    redirect(`/solve/${solveId}/structure`);
  }

  return (
    <form action={handleSubmit}>
      <textarea name="rawInput" placeholder="What's the client asking for?" required />
      <input name="industry" placeholder="Industry (optional)" />
      <button type="submit">Continue</button>
    </form>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add app/solve/new
git commit -m "feat: problem intake, bucket-1 handler (Feature 2)"
```

### Task 5: Structure step — first Groq call (Feature 3)

**Files:**
- Create: `lib/engine/structure.ts`
- Create: `app/solve/[id]/structure/page.tsx`
- Create: `app/solve/[id]/structure/actions.ts`
- Test: `lib/engine/__tests__/structure.test.ts`

**Interfaces:**
- Consumes: `getGroqClient()` (Task 1), `getSupabaseServerClient()` (Task 1).
- Produces: `structureProblem(rawInput: string, industry?: string): Promise<{ goal: string; problemType: string }>` from `lib/engine/structure.ts` — this is the shared parsing contract Task 7 (Reveal) also follows for its own Groq call.

- [ ] **Step 1: Write the failing test with a mocked Groq client**

```typescript
// lib/engine/__tests__/structure.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/groq", () => ({
  getGroqClient: () => ({
    chat: {
      completions: {
        create: async () => ({
          choices: [{ message: { content: JSON.stringify({ goal: "Reduce churn", problemType: "Predict which customers will cancel" }) } }],
        }),
      },
    },
  }),
}));

import { structureProblem } from "../structure";

describe("structureProblem", () => {
  it("parses goal and problemType from the model response", async () => {
    const result = await structureProblem("client wants to know who will cancel next quarter");
    expect(result.goal).toBe("Reduce churn");
    expect(result.problemType).toBe("Predict which customers will cancel");
  });

  it("throws a clear error on unparseable response", async () => {
    const { getGroqClient } = await import("@/lib/groq");
    vi.mocked(getGroqClient).mockReturnValueOnce({
      chat: { completions: { create: async () => ({ choices: [{ message: { content: "not json" } }] }) } },
    } as any);
    await expect(structureProblem("x")).rejects.toThrow(/parse/i);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run lib/engine/__tests__/structure.test.ts`
Expected: FAIL — `structureProblem` not defined.

- [ ] **Step 3: Implement `structureProblem`**

```typescript
// lib/engine/structure.ts
import { getGroqClient } from "@/lib/groq";

const SYSTEM_PROMPT = `You turn a messy, informal client ask into two fields: a clear one-sentence "goal" and a one-sentence "problemType" description. Respond with ONLY a JSON object: {"goal": "...", "problemType": "..."}. No prose, no markdown fences.`;

export async function structureProblem(
  rawInput: string,
  industry?: string
): Promise<{ goal: string; problemType: string }> {
  const client = getGroqClient();
  const userContent = industry ? `Industry: ${industry}\nClient ask: ${rawInput}` : `Client ask: ${rawInput}`;

  const response = await withRetry(() =>
    client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 300,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    })
  );

  const text = response.choices[0]?.message?.content ?? "";
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed.goal !== "string" || typeof parsed.problemType !== "string") {
      throw new Error("missing fields");
    }
    return { goal: parsed.goal, problemType: parsed.problemType };
  } catch {
    throw new Error("Failed to parse structure response");
  }
}

async function withRetry<T>(fn: () => Promise<T>, timeoutMs = 15000): Promise<T> {
  const attempt = () =>
    Promise.race([
      fn(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs)),
    ]);
  try {
    return await attempt();
  } catch {
    return await attempt();
  }
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run lib/engine/__tests__/structure.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the server action and editable confirmation page (screen 2d)**

```typescript
// app/solve/[id]/structure/actions.ts
"use server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { structureProblem } from "@/lib/engine/structure";

export async function runStructureStep(solveId: string): Promise<{ goal: string; problemType: string }> {
  const supabase = await getSupabaseServerClient();
  const { data: solve, error: fetchErr } = await supabase.from("solves").select("raw_input, industry").eq("id", solveId).single();
  if (fetchErr) throw new Error(fetchErr.message);

  const { goal, problemType } = await structureProblem(solve.raw_input, solve.industry ?? undefined);

  const { error: updateErr } = await supabase
    .from("solves")
    .update({ goal, problem_type: problemType })
    .eq("id", solveId);
  if (updateErr) throw new Error(updateErr.message);

  return { goal, problemType };
}

export async function editStructure(solveId: string, goal: string, problemType: string): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from("solves").update({ goal, problem_type: problemType }).eq("id", solveId);
  if (error) throw new Error(error.message);
}
```

The page calls `runStructureStep` on load, renders `goal`/`problemType` in editable fields with an Edit affordance calling `editStructure`, then a Continue button routes to `/solve/[id]/guess`.

- [ ] **Step 6: Commit**

```bash
git add lib/engine/structure.ts app/solve/\[id\]/structure
git commit -m "feat: structure step, first Groq call site (Feature 3)"
```

---

## Phase 3 — Guess & Reveal: the core recommendation engine
**Recommended coding-agent model: Opus 4.8** (this is the load-bearing interaction in the product — comparative "why not the alternatives" reasoning and the guess-before-reveal mechanic are what the whole Solution Overview hinges on; use the strongest available model here)

### Task 6: Category taxonomy + guess UI (Feature 4)

**Files:**
- Create: `lib/engine/taxonomy.ts`
- Create: `app/solve/[id]/guess/page.tsx`
- Create: `app/solve/[id]/guess/actions.ts`
- Test: `lib/engine/__tests__/taxonomy.test.ts`

**Interfaces:**
- Produces: `CATEGORY_TAXONOMY: readonly string[]` from `lib/engine/taxonomy.ts` — consumed by the guess UI here and by the Reveal prompt in Task 7 (so both sides of the guess-then-reveal use the same fixed list).
- Produces: `saveGuess(solveId: string, guessedCategory: string): Promise<void>` — consumed by Task 7.

- [ ] **Step 1: Write the failing test for taxonomy shape**

```typescript
// lib/engine/__tests__/taxonomy.test.ts
import { describe, it, expect } from "vitest";
import { CATEGORY_TAXONOMY } from "../taxonomy";

describe("CATEGORY_TAXONOMY", () => {
  it("has no duplicate entries", () => {
    expect(new Set(CATEGORY_TAXONOMY).size).toBe(CATEGORY_TAXONOMY.length);
  });
  it("includes the categories referenced in the product spec", () => {
    expect(CATEGORY_TAXONOMY).toContain("Classification");
    expect(CATEGORY_TAXONOMY).toContain("RAG");
    expect(CATEGORY_TAXONOMY).toContain("Prediction");
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run lib/engine/__tests__/taxonomy.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the taxonomy**

```typescript
// lib/engine/taxonomy.ts
export const CATEGORY_TAXONOMY = [
  "Classification",
  "RAG",
  "Prediction",
  "Summarization",
  "Generation",
  "Extraction",
  "Recommendation",
  "Anomaly Detection",
] as const;

export type Category = (typeof CATEGORY_TAXONOMY)[number];
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run lib/engine/__tests__/taxonomy.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement `saveGuess` and the guess UI (screen 2e)**

```typescript
// app/solve/[id]/guess/actions.ts
"use server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function saveGuess(solveId: string, guessedCategory: string): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from("solves").update({ guessed_category: guessedCategory }).eq("id", solveId);
  if (error) throw new Error(error.message);
}
```

The guess page renders `CATEGORY_TAXONOMY` as tap targets, calls `saveGuess` client-side-triggered server action on selection (no Groq call, no network dependency beyond the Supabase write), then routes to `/solve/[id]/reveal`.

- [ ] **Step 6: Commit**

```bash
git add lib/engine/taxonomy.ts app/solve/\[id\]/guess
git commit -m "feat: category taxonomy and guess-before-reveal UI (Feature 4)"
```

### Task 7: Reveal step — second Groq call, comparative reasoning (Feature 5, Feature 6)

**Files:**
- Create: `lib/engine/reveal.ts`
- Create: `app/solve/[id]/reveal/page.tsx`
- Create: `app/solve/[id]/reveal/actions.ts`
- Test: `lib/engine/__tests__/reveal.test.ts`

**Interfaces:**
- Consumes: `getGroqClient()` (Task 1), `CATEGORY_TAXONOMY` (Task 6), `getSupabaseServerClient()` (Task 1).
- Produces: `recommendCategory(input: { goal: string; problemType: string; guessedCategory: string }): Promise<RevealResult>` where
  ```typescript
  type RevealResult = {
    match: boolean;
    revealedCategory: string;
    whyItFits: string;
    whyNotAlternatives: { category: string; reason: string }[];
    toolClass: "general-purpose" | "specialized";
  };
  ```
  This is the shared "category-level recommendation engine" (Feature 6) — Task 9 (practice loop) calls the same function.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/engine/__tests__/reveal.test.ts
import { describe, it, expect, vi } from "vitest";

const mockResponse = {
  match: false,
  revealedCategory: "RAG",
  whyItFits: "The client needs answers grounded in their own documents, not generated from general knowledge.",
  whyNotAlternatives: [{ category: "Classification", reason: "There's no fixed label set to sort inputs into." }],
  toolClass: "specialized",
};

vi.mock("@/lib/groq", () => ({
  getGroqClient: () => ({
    chat: {
      completions: {
        create: async () => ({ choices: [{ message: { content: JSON.stringify(mockResponse) } }] }),
      },
    },
  }),
}));

import { recommendCategory } from "../reveal";

describe("recommendCategory", () => {
  it("returns match=false when the guess differs from the revealed category", async () => {
    const result = await recommendCategory({ goal: "Answer client questions from internal docs", problemType: "Doc Q&A", guessedCategory: "Classification" });
    expect(result.match).toBe(false);
    expect(result.revealedCategory).toBe("RAG");
    expect(result.whyNotAlternatives.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run lib/engine/__tests__/reveal.test.ts`
Expected: FAIL — `recommendCategory` not defined.

- [ ] **Step 3: Implement `recommendCategory`**

```typescript
// lib/engine/reveal.ts
import { getGroqClient } from "@/lib/groq";
import { CATEGORY_TAXONOMY } from "./taxonomy";

export type RevealResult = {
  match: boolean;
  revealedCategory: string;
  whyItFits: string;
  whyNotAlternatives: { category: string; reason: string }[];
  toolClass: "general-purpose" | "specialized";
};

const SYSTEM_PROMPT = `You are Vantage's recommendation engine. Given a structured client problem and the user's guessed AI-approach category, decide the correct category from this fixed list only: ${CATEGORY_TAXONOMY.join(", ")}.

Never recommend a named product or tool — only a category from the list, plus a tool-class of "general-purpose" or "specialized".

Respond with ONLY JSON matching this shape, no prose, no markdown fences:
{"match": boolean, "revealedCategory": string, "whyItFits": string, "whyNotAlternatives": [{"category": string, "reason": string}], "toolClass": "general-purpose" | "specialized"}

whyNotAlternatives must cover the 1-3 most plausible other categories from the list and explain concretely why each does not fit this specific problem — not generic definitions.`;

export async function recommendCategory(input: {
  goal: string;
  problemType: string;
  guessedCategory: string;
}): Promise<RevealResult> {
  const client = getGroqClient();
  const userContent = `Goal: ${input.goal}\nProblem type: ${input.problemType}\nUser's guess: ${input.guessedCategory}`;

  const response = await withRetry(() =>
    client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 800,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    })
  );

  const text = response.choices[0]?.message?.content ?? "";
  let parsed: RevealResult;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Failed to parse reveal response");
  }
  if (!CATEGORY_TAXONOMY.includes(parsed.revealedCategory as any)) {
    throw new Error(`Model returned a category outside the taxonomy: ${parsed.revealedCategory}`);
  }
  return parsed;
}

async function withRetry<T>(fn: () => Promise<T>, timeoutMs = 20000): Promise<T> {
  const attempt = () =>
    Promise.race([
      fn(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs)),
    ]);
  try {
    return await attempt();
  } catch {
    return await attempt();
  }
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run lib/engine/__tests__/reveal.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the server action and reveal page (screen 2f)**

```typescript
// app/solve/[id]/reveal/actions.ts
"use server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { recommendCategory } from "@/lib/engine/reveal";

export async function runRevealStep(solveId: string) {
  const supabase = await getSupabaseServerClient();
  const { data: solve, error: fetchErr } = await supabase
    .from("solves")
    .select("goal, problem_type, guessed_category")
    .eq("id", solveId)
    .single();
  if (fetchErr) throw new Error(fetchErr.message);

  const result = await recommendCategory({
    goal: solve.goal,
    problemType: solve.problem_type,
    guessedCategory: solve.guessed_category,
  });

  const { error: updateErr } = await supabase
    .from("solves")
    .update({
      revealed_category: result.revealedCategory,
      tool_class: result.toolClass,
      correct: result.match,
    })
    .eq("id", solveId);
  if (updateErr) throw new Error(updateErr.message);

  return result;
}
```

The reveal page renders match/mismatch, `whyItFits`, each `whyNotAlternatives` entry, and `toolClass`, then routes to the session summary (Task 11).

- [ ] **Step 6: Commit**

```bash
git add lib/engine/reveal.ts app/solve/\[id\]/reveal
git commit -m "feat: reveal step with comparative reasoning and tool-class (Features 5, 6)"
```

---

## Phase 4 — Proactive loop, session summary, practice history
**Recommended coding-agent model: Sonnet** (reuses the Phase 2/3 engine as-is — moderate integration work, no new prompt design)

### Task 8: Daily practice screen with inline Learn & Remember (Feature 7)

**Files:**
- Create: `app/practice/today/page.tsx`
- Create: `app/practice/today/actions.ts`
- Test: `app/practice/today/__tests__/actions.test.ts`

**Interfaces:**
- Consumes: `createDraftSolve` (Task 4), `recommendCategory` (Task 7), `practice_cases` table (Task 2).
- Produces: `getTodaysPracticeCase(): Promise<{ id: string; rawInput: string; industry?: string }>` — used only by this page.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          limit: () => ({ single: async () => ({ data: { id: "pc1", raw_input: "x", industry: null }, error: null }) }),
        }),
      }),
    }),
  }),
}));

import { getTodaysPracticeCase } from "../actions";

describe("getTodaysPracticeCase", () => {
  it("returns an active practice case", async () => {
    const result = await getTodaysPracticeCase();
    expect(result.id).toBe("pc1");
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run app/practice/today/__tests__/actions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// app/practice/today/actions.ts
"use server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function getTodaysPracticeCase(): Promise<{ id: string; rawInput: string; industry?: string }> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("practice_cases")
    .select("id, raw_input, industry")
    .eq("active", true)
    .limit(1)
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id, rawInput: data.raw_input, industry: data.industry ?? undefined };
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run app/practice/today/__tests__/actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Build the practice page (screen 2i)**

The page calls `getTodaysPracticeCase`, then `createDraftSolve({ rawInput, industry, source: "practice" })`, renders guess UI (reuse Task 6 component) and reveal (reuse Task 7's `recommendCategory` via a single combined action since guess and reveal happen on one screen here), and renders an inline "Learn & remember" panel (key takeaway + common pitfall) sourced from the same reveal response's `whyItFits`/`whyNotAlternatives` fields — no new Groq call needed beyond Task 7's.

- [ ] **Step 6: Commit**

```bash
git add app/practice/today
git commit -m "feat: daily practice loop reusing the guess-then-reveal engine (Feature 7)"
```

### Task 9: Session summary + practice history (Features 9, 10)

**Files:**
- Create: `app/solve/[id]/summary/page.tsx`
- Create: `app/practice/history/page.tsx`
- Create: `app/practice/history/actions.ts`
- Test: `app/practice/history/__tests__/actions.test.ts`

**Interfaces:**
- Consumes: `solves` table (Task 2).
- Produces: `listSolves(userId: string): Promise<SolveHistoryRow[]>` where `SolveHistoryRow = { id: string; source: "live" | "practice"; revealedCategory: string; correct: boolean; createdAt: string }` — consumed by Task 12 (Progress screen) for its own separate aggregation queries, not by re-using this function.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: async () => ({
            data: [{ id: "s1", source: "live", revealed_category: "RAG", correct: true, created_at: "2026-08-01T00:00:00Z" }],
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

import { listSolves } from "../actions";

describe("listSolves", () => {
  it("maps db rows to camelCase history rows", async () => {
    const result = await listSolves("u1");
    expect(result[0]).toEqual({ id: "s1", source: "live", revealedCategory: "RAG", correct: true, createdAt: "2026-08-01T00:00:00Z" });
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run app/practice/history/__tests__/actions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// app/practice/history/actions.ts
"use server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type SolveHistoryRow = { id: string; source: "live" | "practice"; revealedCategory: string; correct: boolean; createdAt: string };

export async function listSolves(userId: string): Promise<SolveHistoryRow[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("solves")
    .select("id, source, revealed_category, correct, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data.map((row: any) => ({
    id: row.id,
    source: row.source,
    revealedCategory: row.revealed_category,
    correct: row.correct,
    createdAt: row.created_at,
  }));
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run app/practice/history/__tests__/actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Build the summary page (screen 2h) and history page (screen 2j)**

Summary page reads the completed `solves` row plus its `takeaways` row (if generated) and next-step links (solve another / today's practice / home). History page renders `listSolves` results tagged with category and Correct/Missed status.

- [ ] **Step 6: Commit**

```bash
git add app/solve/\[id\]/summary app/practice/history
git commit -m "feat: session summary and practice history (Features 9, 10)"
```

---

## Phase 5 — Progress & Settings
**Recommended coding-agent model: Haiku** (aggregation queries and preference forms — straightforward CRUD, no reasoning-heavy logic)

### Task 10: Progress screen (Feature 11)

**Files:**
- Create: `app/progress/page.tsx`
- Create: `app/progress/actions.ts`
- Test: `app/progress/__tests__/actions.test.ts`

**Interfaces:**
- Consumes: `solves` table (Task 2).
- Produces: `getProgressStats(userId: string): Promise<{ firstGuessAccuracy: number; byCategory: Record<string, number> }>` — used only by this page.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({
    from: () => ({
      select: () => ({
        eq: async () => ({
          data: [
            { revealed_category: "Classification", correct: true },
            { revealed_category: "Classification", correct: false },
            { revealed_category: "RAG", correct: true },
          ],
          error: null,
        }),
      }),
    }),
  }),
}));

import { getProgressStats } from "../actions";

describe("getProgressStats", () => {
  it("computes overall and per-category accuracy", async () => {
    const result = await getProgressStats("u1");
    expect(result.firstGuessAccuracy).toBeCloseTo(2 / 3);
    expect(result.byCategory["Classification"]).toBeCloseTo(0.5);
    expect(result.byCategory["RAG"]).toBeCloseTo(1);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run app/progress/__tests__/actions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// app/progress/actions.ts
"use server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function getProgressStats(userId: string): Promise<{ firstGuessAccuracy: number; byCategory: Record<string, number> }> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.from("solves").select("revealed_category, correct").eq("user_id", userId);
  if (error) throw new Error(error.message);

  const rows = data as { revealed_category: string; correct: boolean }[];
  const firstGuessAccuracy = rows.length ? rows.filter((r) => r.correct).length / rows.length : 0;

  const byCategory: Record<string, number> = {};
  const grouped = new Map<string, boolean[]>();
  for (const row of rows) {
    const list = grouped.get(row.revealed_category) ?? [];
    list.push(row.correct);
    grouped.set(row.revealed_category, list);
  }
  for (const [category, results] of grouped) {
    byCategory[category] = results.filter(Boolean).length / results.length;
  }

  return { firstGuessAccuracy, byCategory };
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run app/progress/__tests__/actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Build the progress page (screen 2k)** rendering accuracy, a trend line (group by week from `createdAt`, client-side), and the per-category breakdown.

- [ ] **Step 6: Commit**

```bash
git add app/progress
git commit -m "feat: progress screen with accuracy and per-category breakdown (Feature 11)"
```

### Task 11: Settings screen (Feature 12)

**Files:**
- Create: `app/settings/page.tsx`
- Create: `app/settings/actions.ts`
- Test: `app/settings/__tests__/actions.test.ts`

**Interfaces:**
- Consumes: `user_settings` table (Task 2), `getProgressStats` (Task 10, reused for the per-category summary shown here).
- Produces: `updateSettings(userId: string, patch: { practiceDifficulty?: string; practiceFrequency?: string }): Promise<void>`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi } from "vitest";

const updateMock = vi.fn(async () => ({ error: null }));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({
    from: () => ({ update: (patch: any) => ({ eq: updateMock }) }),
  }),
}));

import { updateSettings } from "../actions";

describe("updateSettings", () => {
  it("writes the provided patch", async () => {
    await updateSettings("u1", { practiceDifficulty: "hard" });
    expect(updateMock).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run app/settings/__tests__/actions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// app/settings/actions.ts
"use server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function updateSettings(
  userId: string,
  patch: { practiceDifficulty?: string; practiceFrequency?: string }
): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const dbPatch: Record<string, string> = {};
  if (patch.practiceDifficulty) dbPatch.practice_difficulty = patch.practiceDifficulty;
  if (patch.practiceFrequency) dbPatch.practice_frequency = patch.practiceFrequency;
  const { error } = await supabase.from("user_settings").update(dbPatch).eq("user_id", userId);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run app/settings/__tests__/actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Build the settings page (screen 2l)** with difficulty/frequency controls, per-category strength summary (via `getProgressStats`), and a sign-out control (calls Supabase `auth.signOut()`).

- [ ] **Step 6: Commit**

```bash
git add app/settings
git commit -m "feat: settings screen with practice preferences (Feature 12)"
```

---

## Phase 6 — Handback artifact (third Groq call site)
**Recommended coding-agent model: Sonnet** (a new Groq call site, but a simpler generation task than Phase 3's comparative reasoning)

### Task 12: Handback generation (Feature 8)

**Files:**
- Create: `lib/engine/handback.ts`
- Create: `app/solve/[id]/handback/page.tsx`
- Create: `app/solve/[id]/handback/actions.ts`
- Test: `lib/engine/__tests__/handback.test.ts`

**Interfaces:**
- Consumes: `getGroqClient()` (Task 1), `solves`/`takeaways` tables (Task 2).
- Produces: `generateHandback(input: { goal: string; problemType: string; revealedCategory: string }): Promise<string>` (the draft text).

- [ ] **Step 1: Write the failing test**

```typescript
// lib/engine/__tests__/handback.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/groq", () => ({
  getGroqClient: () => ({
    chat: {
      completions: {
        create: async () => ({ choices: [{ message: { content: "Draft: here's how we'll address churn using a prediction model..." } }] }),
      },
    },
  }),
}));

import { generateHandback } from "../handback";

describe("generateHandback", () => {
  it("returns non-empty draft text", async () => {
    const text = await generateHandback({ goal: "Reduce churn", problemType: "Predict cancellations", revealedCategory: "Prediction" });
    expect(text.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run lib/engine/__tests__/handback.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// lib/engine/handback.ts
import { getGroqClient } from "@/lib/groq";

const SYSTEM_PROMPT = `You write a short, client-facing takeaway draft (3-5 sentences) summarizing how AI will address the client's problem, given the confirmed problem and AI-approach category. Plain language, no jargon, no named products. Respond with only the draft text, no preamble.`;

export async function generateHandback(input: { goal: string; problemType: string; revealedCategory: string }): Promise<string> {
  const client = getGroqClient();
  const response = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 400,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Goal: ${input.goal}\nProblem type: ${input.problemType}\nCategory: ${input.revealedCategory}` },
    ],
  });
  const text = response.choices[0]?.message?.content ?? "";
  if (!text.trim()) throw new Error("Handback generation returned empty text");
  return text;
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run lib/engine/__tests__/handback.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the server action and page (screens 2g, 2h) with Preview/Copy/Download**

```typescript
// app/solve/[id]/handback/actions.ts
"use server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { generateHandback } from "@/lib/engine/handback";

export async function createHandback(solveId: string): Promise<string> {
  const supabase = await getSupabaseServerClient();
  const { data: solve, error: fetchErr } = await supabase.from("solves").select("goal, problem_type, revealed_category").eq("id", solveId).single();
  if (fetchErr) throw new Error(fetchErr.message);

  const draftText = await generateHandback({ goal: solve.goal, problemType: solve.problem_type, revealedCategory: solve.revealed_category });

  const { error: insertErr } = await supabase.from("takeaways").insert({ solve_id: solveId, draft_text: draftText });
  if (insertErr) throw new Error(insertErr.message);

  return draftText;
}
```

Download uses a client-side blob (`text/plain`) built from the returned draft text; Copy uses the Clipboard API.

- [ ] **Step 6: Commit**

```bash
git add lib/engine/handback.ts app/solve/\[id\]/handback
git commit -m "feat: handback client-takeaway artifact (Feature 8)"
```

---

## Phase 7 — Integration testing & deployment
**Recommended coding-agent model: Sonnet** (mocking/test-harness setup and deploy config need judgment but no novel product logic)

### Task 13: Guess-then-reveal integration test + Vercel/Supabase deploy config

**Files:**
- Create: `tests/integration/guess-then-reveal.test.ts`
- Create: `vercel.json` (if non-default settings needed)
- Create: `supabase/config.toml` (via `supabase init`, if not already present from Task 2)
- Test: the integration test itself is the deliverable

**Interfaces:**
- Consumes: `createDraftSolve` (Task 4), `runStructureStep` (Task 5), `saveGuess` (Task 6), `runRevealStep` (Task 7) — exercised end-to-end against a local Supabase instance.

- [ ] **Step 1: Start local Supabase for integration testing**

Run: `supabase start`
Expected: local Postgres + Auth running, matching the schema from Task 2 (`supabase db reset` applies migrations).

- [ ] **Step 2: Write the integration test**

```typescript
// tests/integration/guess-then-reveal.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { createDraftSolve } from "@/app/solve/new/actions";
import { runStructureStep } from "@/app/solve/[id]/structure/actions";
import { saveGuess } from "@/app/solve/[id]/guess/actions";
import { runRevealStep } from "@/app/solve/[id]/reveal/actions";

describe("guess-then-reveal round trip", () => {
  it("persists a full solve from intake through reveal", async () => {
    const { solveId } = await createDraftSolve({
      rawInput: "Client wants to answer support questions using their internal knowledge base",
      source: "live",
    });
    const structured = await runStructureStep(solveId);
    expect(structured.goal.length).toBeGreaterThan(0);

    await saveGuess(solveId, "Classification");
    const revealed = await runRevealStep(solveId);

    expect(revealed.revealedCategory).toBeDefined();
    expect(typeof revealed.match).toBe("boolean");
  });
});
```

Note: this test hits the real Groq API against a local Supabase instance (per the spec's integration-testing approach) — requires `GROQ_API_KEY` set in the test environment. Groq's free tier is rate-limited, so if this test is run repeatedly in a short window it may hit a 429 — the retry wrapper in `structureProblem`/`recommendCategory` covers a single transient failure, but do not loop this test in a tight retry script. If running this in CI without a budget for live API calls, gate it behind an `INTEGRATION=1` env check rather than mocking Groq here, since the point of this test is exercising the real parsing contract end-to-end.

- [ ] **Step 3: Run the integration test**

Run: `INTEGRATION=1 npx vitest run tests/integration/guess-then-reveal.test.ts`
Expected: PASS against local Supabase + live Groq API.

- [ ] **Step 4: Add Vercel deployment config**

Ensure `vercel.json` (if needed for custom build settings) and confirm environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`) are documented in `.env.local.example` (already done in Task 1) and set in the Vercel project dashboard — this is a manual dashboard step, not a code change.

- [ ] **Step 5: Commit**

```bash
git add tests/integration
git commit -m "test: end-to-end guess-then-reveal integration test"
```

---

## Model Assignment Summary

| Phase | Covers | Recommended coding-agent model | Why |
|---|---|---|---|
| 0 — Scaffolding | Task 1 | Haiku | Pure boilerplate/config |
| 1 — Auth & Data Model | Tasks 2-3 | Sonnet | Schema + auth correctness, well-trodden patterns |
| 2 — Intake & Structure | Tasks 4-5 | Opus | First Groq call site; parsing contract reused later |
| 3 — Guess & Reveal | Tasks 6-7 | **Opus 4.8** | Load-bearing comparative reasoning; the core of the product |
| 4 — Proactive loop, summary, history | Tasks 8-9 | Sonnet | Reuses established engine, integration-heavy |
| 5 — Progress & Settings | Tasks 10-11 | Haiku | Aggregation queries and preference CRUD |
| 6 — Handback artifact | Task 12 | Sonnet | New but simpler Groq call site |
| 7 — Integration testing & deploy | Task 13 | Sonnet | Test-harness judgment, no new product logic |

## Open items carried from the spec (unblocked, but worth resolving before public copy ships)

- `Problem Statement.md` staleness in the source vault — doesn't affect this plan's tasks, only external-facing PRD language.
- Groq free-tier rate limits — fine for MVP build/demo; revisit if usage grows past free-tier limits (see spec's Architecture section).
