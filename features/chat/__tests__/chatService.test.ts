import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import { chatService } from "@/features/chat/services/chatService";

vi.mock("axios");

describe("chatService.sendMessage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("includes personaRoleKey when provided on messages", async () => {
    (axios.post as unknown as vi.Mock).mockResolvedValue({ data: { content: "ok" } });

    const msgs = [
      { role: "user", content: "Hi", personaRoleKey: "veterinary-nurse" },
    ] as any;

    await chatService.sendMessage(msgs, 0, "case-1");

    expect((axios.post as unknown as vi.Mock).mock.calls.length).toBeGreaterThan(0);
    const callPayload = (axios.post as unknown as vi.Mock).mock.calls[0][1];
    expect(Array.isArray(callPayload.messages)).toBe(true);
    expect(callPayload.messages[0].personaRoleKey).toBe("veterinary-nurse");
  });
});
