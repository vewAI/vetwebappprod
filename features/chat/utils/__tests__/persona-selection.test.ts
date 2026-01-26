import { chooseSafePersonaKey } from "@/features/chat/utils/persona-selection";

import { describe, it, expect } from "vitest";

describe("chooseSafePersonaKey", () => {
  it("prefers userPersonaKey when present", () => {
    const v = chooseSafePersonaKey({ userPersonaKey: "owner", activePersona: "veterinary-nurse" });
    expect(v).toBe("owner");
  });

  it("prefers selectedPersonaAtSend over response persona", () => {
    const v = chooseSafePersonaKey({ selectedPersonaAtSend: "veterinary-nurse", responsePersonaKey: "owner" });
    expect(v).toBe("veterinary-nurse");
  });

  it("falls back to lastSentPersona if selected not present", () => {
    const v = chooseSafePersonaKey({ lastSentPersona: "veterinary-nurse", responsePersonaKey: "owner" });
    expect(v).toBe("veterinary-nurse");
  });

  it("prefers server response persona if nothing else", () => {
    const v = chooseSafePersonaKey({ responsePersonaKey: "owner", activePersona: "veterinary-nurse" });
    expect(v).toBe("owner");
  });

  it("falls back to active persona when appropriate", () => {
    const v = chooseSafePersonaKey({ activePersona: "veterinary-nurse" });
    expect(v).toBe("veterinary-nurse");
  });
});
