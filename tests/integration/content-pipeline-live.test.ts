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
    // Fail loudly rather than silently treating an error as "table is
    // empty" — an empty existingIdsBefore would make afterAll's cleanup
    // below delete every row in the table, including the seeded pool.
    const { data, error } = await admin.from("practice_cases").select("id");
    if (error) throw new Error(`Failed to snapshot existing practice_cases ids: ${error.message}`);
    existingIdsBefore = new Set((data ?? []).map((r) => r.id as string));
  });

  afterAll(async () => {
    // Best-effort cleanup: delete only the rows this run actually inserted,
    // identified by not having existed beforehand — never touch the
    // pre-existing seeded pool. Same fail-loudly reasoning as beforeAll: a
    // swallowed error here would again make newIds "everything", not
    // "nothing".
    const { data, error } = await admin.from("practice_cases").select("id");
    if (error) throw new Error(`Failed to fetch practice_cases ids for cleanup: ${error.message}`);
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

    // Identify the rows this run actually inserted the same way afterAll's
    // cleanup does — by set difference against the pre-run snapshot, not by
    // ordering on `id` (a random UUID, not an insertion-ordered column).
    const { data: allRows, error: fetchErr } = await admin.from("practice_cases").select("*");
    expect(fetchErr).toBeNull();
    const insertedRows = (allRows ?? []).filter((r) => !existingIdsBefore.has(r.id as string));
    expect(insertedRows.length).toBe(summary.inserted);

    // Confirm no category ever landed in the table — practice_cases has no
    // such column at all, so this is really confirming the insert didn't
    // error trying to write one.
    for (const row of insertedRows) {
      expect(Object.keys(row)).not.toContain("category");
      expect(Object.keys(row)).not.toContain("intended_category");
    }
  });
});
