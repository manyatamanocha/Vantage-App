import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// This suite exercises the guess-then-reveal round trip against REAL
// infrastructure: the actual (remote) Supabase project's Postgres + Auth, with
// RLS enforced, and the actual Groq API. Nothing here is mocked except the one
// thing that has no meaning outside an HTTP request (see below). It costs real
// API calls and writes real rows (cleaned up in afterAll), so it is gated
// behind INTEGRATION=1 rather than run as part of the default test suite.
//
// Run: INTEGRATION=1 npx vitest run tests/integration/guess-then-reveal.test.ts
//
// Local Supabase (`supabase start`) is not available in this environment, so
// this runs against the real project configured in `.env.local` instead. That
// is intentional, not a shortcut: Task 13 is explicitly the one place in the
// plan meant to exercise the real Groq parsing contract and real Postgres/RLS
// end-to-end.
// ---------------------------------------------------------------------------

const RUN = process.env.INTEGRATION === "1";

// -- next/headers cookie fake -------------------------------------------
//
// Every server action under test (createDraftSolve, runStructureStep,
// saveGuess, runRevealStep) calls getSupabaseServerClient(), which calls
// next/headers' cookies() to read/write the auth session cookie.
//
// Investigated directly before writing this test: calling cookies() from a
// bare Vitest process (no Next.js App Router request scope) throws
//   "`cookies` was called outside a request scope."
// There is no graceful degradation in this Next.js version (16.3.2) — a test
// that just imports and calls these actions, as the task brief's literal
// example does, throws immediately.
//
// Rather than test only the underlying lib/engine functions (structureProblem
// / recommendCategory) with a hand-built Postgres client — which would skip
// the actions' own auth + RLS plumbing entirely — this fakes the one thing
// cookies() actually provides across a request: a persistent cookie jar. All
// four action calls below share this in-memory jar, standing in for the
// browser cookie header a real request boundary would carry. Sign-in happens
// through this exact same getSupabaseServerClient() code path (see beforeAll),
// so @supabase/ssr's own setAll()/getAll() populate and read the session --
// nothing about Supabase's auth cookie format is hand-rolled here. That keeps
// the actions themselves under test, including the RLS policies that require
// auth.uid() = user_id, using a real signed-in session rather than a
// service-role bypass.
type Cookie = { name: string; value: string };
const jar: Cookie[] = [];

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => jar.map((c) => ({ ...c })),
    set: (name: string, value: string) => {
      const existing = jar.find((c) => c.name === name);
      if (existing) existing.value = value;
      else jar.push({ name, value });
    },
  }),
}));

// vi.mock calls are hoisted above imports by Vitest, so by the time these
// modules (and their `next/headers` import) load, the mock above is already
// in effect -- the same pattern the rest of the suite uses, e.g.
// app/solve/new/__tests__/actions.test.ts.
import { createDraftSolve } from "@/app/solve/new/actions";
import { runStructureStep } from "@/app/solve/[id]/structure/actions";
import { saveGuess } from "@/app/solve/[id]/guess/actions";
import { runRevealStep } from "@/app/solve/[id]/reveal/actions";
import { getSupabaseServerClient } from "@/lib/supabase/server";

describe.skipIf(!RUN)(
  "guess-then-reveal round trip (real Groq + real Supabase)",
  () => {
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const testEmail = `vantage-integration-test-${runId}@example.invalid`;
    const testPassword = `Integration-Test-${runId}!`;

    let admin: SupabaseClient;
    let userId: string | undefined;
    let solveId: string | undefined;

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

      // Service-role client: this test's own setup/teardown/verification path,
      // deliberately independent of the RLS-scoped session under test below.
      admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      // A disposable, real auth.users row -- service role bypasses RLS and
      // email confirmation -- so the RLS-protected inserts/updates exercised
      // below run under a real auth.uid(), exactly as production does.
      const { data: created, error: createErr } =
        await admin.auth.admin.createUser({
          email: testEmail,
          password: testPassword,
          email_confirm: true,
        });
      if (createErr || !created.user) {
        throw new Error(`Failed to create test user: ${createErr?.message}`);
      }
      userId = created.user.id;

      // Sign in through the production code path so @supabase/ssr writes the
      // session into the mocked cookie jar itself (see the next/headers mock
      // above) -- every subsequent action call reads that same session back.
      const supabase = await getSupabaseServerClient();
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });
      if (signInErr) {
        throw new Error(`Failed to sign in test user: ${signInErr.message}`);
      }
    });

    afterAll(async () => {
      // Best-effort cleanup so this run -- and repeated runs -- don't leave
      // junk in the real project. `solves` cascades to `takeaways` on delete.
      if (solveId) {
        await admin.from("solves").delete().eq("id", solveId);
      }
      if (userId) {
        await admin.auth.admin.deleteUser(userId);
      }
    });

    it("persists a full solve from intake through reveal", async () => {
      const { solveId: id } = await createDraftSolve({
        rawInput:
          "Client wants to answer support questions using their internal knowledge base",
        source: "live",
      });
      solveId = id;
      expect(solveId).toBeTruthy();

      // Real Groq call #1: structures the raw ask into goal + problemType.
      const structured = await runStructureStep(solveId);
      expect(structured.goal.length).toBeGreaterThan(0);
      expect(structured.problemType.length).toBeGreaterThan(0);

      await saveGuess(solveId, "Classification");

      // Real Groq call #2: reveals the category and compares it to the guess.
      const revealed = await runRevealStep(solveId);
      expect(revealed.revealedCategory).toBeDefined();
      expect(typeof revealed.match).toBe("boolean");
      expect(revealed.whyItFits.length).toBeGreaterThan(0);
      expect(revealed.whyNotAlternatives.length).toBeGreaterThan(0);

      // Confirm the round trip actually landed in Postgres and not just in the
      // in-memory return values -- read back independently via the
      // service-role client.
      const { data: row, error } = await admin
        .from("solves")
        .select(
          "goal, problem_type, guessed_category, revealed_category, correct, tool_class"
        )
        .eq("id", solveId)
        .single();
      expect(error).toBeNull();
      expect(row?.goal).toBe(structured.goal);
      expect(row?.problem_type).toBe(structured.problemType);
      expect(row?.guessed_category).toBe("Classification");
      expect(row?.revealed_category).toBe(revealed.revealedCategory);
      expect(row?.correct).toBe(revealed.match);
      expect(row?.tool_class).toBe(revealed.toolClass);
    });
  }
);
