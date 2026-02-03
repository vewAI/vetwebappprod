import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";

vi.mock("axios");

// Tests run in a node/test environment where the Supabase client may be a lightweight
// shim. Mock auth helpers so chatService can proceed without a real supabase session.
vi.mock("@/lib/auth-headers", () => ({
  getAccessToken: async () => "FAKE_TOKEN",
  buildAuthHeaders: async (_base: Record<string, string>, token?: string) => ({
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }),
}));

import { chatService } from "@/features/chat/services/chatService";

describe("chatService.sendMessage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("includes personaRoleKey when provided on messages", async () => {
    (axios.post as unknown as vi.Mock).mockResolvedValue({ data: { content: "ok" } });

    const msgs = [{ role: "user", content: "Hi", personaRoleKey: "veterinary-nurse" }] as any;

    await chatService.sendMessage(msgs, 0, "case-1");

    expect((axios.post as unknown as vi.Mock).mock.calls.length).toBeGreaterThan(0);
    const callPayload = (axios.post as unknown as vi.Mock).mock.calls[0][1];
    expect(Array.isArray(callPayload.messages)).toBe(true);
    expect(callPayload.messages[0].personaRoleKey).toBe("veterinary-nurse");
  });
});
