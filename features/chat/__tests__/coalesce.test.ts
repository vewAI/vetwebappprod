import { describe, it, expect } from "vitest";
import { coalesceMessages } from "../utils/coalesce";

describe("coalesceMessages", () => {
  it("merges adjacent messages with same personaRoleKey and preserves the key", () => {
    const msgs = [
      { sender: "user", personaRoleKey: "owner", content: "one" },
      { sender: "user", personaRoleKey: "owner", content: "two" },
      { sender: "user", personaRoleKey: "nurse", content: "three" },
      { sender: "assistant", content: "ok" },
    ];
    const res = coalesceMessages(msgs as any);
    expect(res.length).toBe(3);
    expect(res[0].content).toContain("one");
    expect(res[0].content).toContain("two");
    expect(res[0].personaRoleKey).toBe("owner");
  });
});
