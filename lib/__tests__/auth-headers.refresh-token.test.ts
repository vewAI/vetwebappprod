import { beforeEach, describe, expect, it, vi } from "vitest";

const spies = vi.hoisted(() => {
  const signOut = vi.fn(async () => ({ error: null }));
  const refreshSession = vi.fn(async () => ({ data: { session: null }, error: null }));
  const getSession = vi.fn(async () => ({ data: { session: null }, error: null }));
  return { signOut, refreshSession, getSession };
});

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: spies.getSession,
      refreshSession: spies.refreshSession,
      signOut: spies.signOut,
    },
  },
}));

import { getAccessToken } from "../auth-headers";

describe("getAccessToken refresh-token handling", () => {
  beforeEach(() => {
    spies.getSession.mockReset();
    spies.refreshSession.mockReset();
    spies.signOut.mockReset();

    spies.signOut.mockResolvedValue({ error: null });
    spies.refreshSession.mockResolvedValue({ data: { session: null }, error: null });
  });

  it("clears local session and skips refreshSession on invalid refresh token error", async () => {
    spies.getSession.mockResolvedValue({
      data: { session: null },
      error: {
        code: "refresh_token_not_found",
        message: "Invalid Refresh Token: Refresh Token Not Found",
      },
    });

    const token = await getAccessToken();

    expect(token).toBeNull();
    expect(spies.signOut).toHaveBeenCalledTimes(1);
    expect(spies.refreshSession).not.toHaveBeenCalled();
  });

  it("returns access token when session is valid", async () => {
    spies.getSession.mockResolvedValue({
      data: { session: { access_token: "abc123" } },
      error: null,
    });

    const token = await getAccessToken();

    expect(token).toBe("abc123");
    expect(spies.signOut).not.toHaveBeenCalled();
  });
});
