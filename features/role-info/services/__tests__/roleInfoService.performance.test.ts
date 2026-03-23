import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  maybeSingleSpy,
  eqSpy,
  selectSpy,
  fromSpy,
} = vi.hoisted(() => {
  const maybeSingle = vi.fn(async () => ({ data: null, error: null }));
  const eq = vi.fn(() => ({ eq, maybeSingle }));
  const select = vi.fn(() => ({ eq, maybeSingle }));
  const from = vi.fn(() => ({ select }));
  return {
    maybeSingleSpy: maybeSingle,
    eqSpy: eq,
    selectSpy: select,
    fromSpy: from,
  };
});

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: fromSpy,
  },
}));

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdminClient: () => null,
}));

import { getRoleInfoPrompt } from "../roleInfoService";

describe("getRoleInfoPrompt performance guard", () => {
  beforeEach(() => {
    fromSpy.mockClear();
    selectSpy.mockClear();
    eqSpy.mockClear();
    maybeSingleSpy.mockClear();
    maybeSingleSpy.mockResolvedValue({ data: null, error: null });
  });

  it("skips cases table fetch when caseRowOverride is provided", async () => {
    const caseRowOverride = {
      id: "case-1",
      title: "Performance Test Case",
      owner_background: "Owner summary",
    } as Record<string, unknown>;

    await getRoleInfoPrompt("case-1", 0, "How is the horse?", undefined, caseRowOverride);

    const casesFromCalls = fromSpy.mock.calls.filter((call) => call[0] === "cases");
    expect(casesFromCalls.length).toBe(0);
  });

  it("queries cases table when caseRowOverride is not provided", async () => {
    await getRoleInfoPrompt("case-1", 0, "How is the horse?");

    const casesFromCalls = fromSpy.mock.calls.filter((call) => call[0] === "cases");
    expect(casesFromCalls.length).toBeGreaterThan(0);
  });
});
