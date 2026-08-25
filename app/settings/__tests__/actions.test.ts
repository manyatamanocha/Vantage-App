import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  user: null as { id: string } | null,
  settingsRow: null as { practice_difficulty: string; practice_frequency: string; default_question_type?: string } | null,
}));

const upsertMock = vi.fn(
  async (_patch: Record<string, string>): Promise<{ error: { message: string } | null }> => ({ error: null })
);
const maybeSingleMock = vi.fn(async () => ({ data: state.settingsRow, error: null }));

vi.mock("@/lib/supabase/server", () => {
  const buildClient = () => ({
    auth: {
      getUser: async () => ({ data: { user: state.user } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: maybeSingleMock,
        }),
      }),
      upsert: upsertMock,
    }),
  });
  return {
    getSupabaseServerClient: async () => buildClient(),
    getVerifiedUser: async () => ({ supabase: buildClient(), user: state.user }),
  };
});

import { getSettings, updateSettings } from "../actions";

beforeEach(() => {
  state.user = { id: "u1" };
  state.settingsRow = null;
  vi.clearAllMocks();
  maybeSingleMock.mockImplementation(async () => ({ data: state.settingsRow, error: null }));
  upsertMock.mockImplementation(async () => ({ error: null }));
});

describe("getSettings", () => {
  it("returns the user's actual saved values when a row exists", async () => {
    state.settingsRow = {
      practice_difficulty: "hard",
      practice_frequency: "weekly",
      default_question_type: "quiz",
    };

    const result = await getSettings("u1");

    expect(result).toEqual({
      practiceDifficulty: "hard",
      practiceFrequency: "weekly",
      defaultQuestionType: "quiz",
    });
  });

  it("returns defaults matching the DB column defaults when no row exists, without throwing", async () => {
    state.settingsRow = null;

    await expect(getSettings("u1")).resolves.toEqual({
      practiceDifficulty: "medium",
      practiceFrequency: "daily",
      defaultQuestionType: "scenario",
    });
  });

  it("throws when there is no authenticated user", async () => {
    state.user = null;
    await expect(getSettings("u1")).rejects.toThrow(/not authenticated/i);
  });
});

describe("updateSettings", () => {
  it("writes the provided patch", async () => {
    await updateSettings("u1", { practiceDifficulty: "hard" });
    expect(upsertMock).toHaveBeenCalled();
  });

  it("throws when there is no authenticated user", async () => {
    state.user = null;
    await expect(
      updateSettings("u1", { practiceDifficulty: "hard" })
    ).rejects.toThrow(/not authenticated/i);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("only includes the patched field (plus user_id) when a single field is supplied", async () => {
    await updateSettings("u1", { practiceDifficulty: "easy" });

    expect(upsertMock).toHaveBeenCalledWith({
      user_id: "u1",
      practice_difficulty: "easy",
    });
  });

  it("includes both fields plus user_id when both are supplied", async () => {
    await updateSettings("u1", { practiceDifficulty: "easy", practiceFrequency: "off" });

    expect(upsertMock).toHaveBeenCalledWith({
      user_id: "u1",
      practice_difficulty: "easy",
      practice_frequency: "off",
    });
  });

  it("propagates an error from the database", async () => {
    upsertMock.mockImplementationOnce(async () => ({ error: { message: "db error" } }));

    await expect(
      updateSettings("u1", { practiceDifficulty: "hard" })
    ).rejects.toThrow("db error");
  });
});
