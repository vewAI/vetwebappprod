import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUserMock } = vi.hoisted(() => ({ requireUserMock: vi.fn() }));
vi.mock("@/app/api/_lib/auth", () => ({ requireUser: requireUserMock }));

import { POST } from "@/app/api/live/session/route";

function request(body: Record<string, unknown>) {
  return new Request("http://localhost/api/live/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("live session access", () => {
  beforeEach(() => requireUserMock.mockReset());

  it("creates an administrator test attempt without a class session", async () => {
    const insert = vi.fn((row: Record<string, unknown>) => {
      expect(row).toHaveProperty("case_id", "case-1");
      return { select: () => ({ single: async () => ({ data: { id: "test-attempt" }, error: null }) }) };
    });
    requireUserMock.mockResolvedValue({
      role: "admin",
      user: { id: "admin-1" },
      supabase: { from: vi.fn(() => ({ insert })) },
    });

    const response = await POST(request({ caseId: "case-1", testMode: true }));
    expect(response.status).toBe(200);
    expect((await response.json()).attemptId).toBe("test-attempt");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ case_id: "case-1", user_id: "admin-1" }));
    expect(insert.mock.calls[0][0]).not.toHaveProperty("session_id");
  });

  it("denies student access to test mode", async () => {
    const from = vi.fn();
    requireUserMock.mockResolvedValue({ role: "student", user: { id: "student-1" }, supabase: { from } });

    const response = await POST(request({ caseId: "case-1", testMode: true }));
    expect(response.status).toBe(403);
    expect(from).not.toHaveBeenCalled();
  });

  it("cannot resume an attempt through another class session", async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(async () => ({ data: { id: "attempt-1", session_id: "session-1", last_stage_index: 1 } })),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    requireUserMock.mockResolvedValue({
      role: "student",
      user: { id: "student-1" },
      supabase: { from: vi.fn(() => query) },
    });

    const response = await POST(request({ caseId: "case-1", attemptId: "attempt-1", sessionId: "session-2" }));
    expect(response.status).toBe(403);
    expect(query.eq).toHaveBeenCalledWith("case_id", "case-1");
    expect(query.eq).toHaveBeenCalledWith("completion_status", "in_progress");
  });

  it("does not silently create a new attempt when a resume link is stale", async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(async () => ({ data: null })),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    const from = vi.fn(() => query);
    requireUserMock.mockResolvedValue({ role: "student", user: { id: "student-1" }, supabase: { from } });

    const response = await POST(request({ caseId: "case-1", attemptId: "old-attempt" }));
    expect(response.status).toBe(404);
    expect(from).toHaveBeenCalledTimes(1);
  });
});
