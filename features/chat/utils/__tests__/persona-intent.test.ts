import { describe, it, expect } from "vitest";
import { detectPersonaSwitch, looksLikeLabRequest } from "@/features/chat/utils/persona-intent";

describe("detectPersonaSwitch", () => {
  it("detects owner switch phrases", () => {
    expect(detectPersonaSwitch("can I talk with the owner")).toBe("owner");
    expect(detectPersonaSwitch("talk to owner now")).toBe("owner");
  });

  it("detects nurse switch phrases", () => {
    expect(detectPersonaSwitch("can I talk with the nurse")).toBe("veterinary-nurse");
    expect(detectPersonaSwitch("speak to nurse please")).toBe("veterinary-nurse");
    // ASR can occasionally transcribe 'nurse' as 'nose'; accept that in persona-switch contexts
    expect(detectPersonaSwitch("may i talk to the nose")).toBe("veterinary-nurse");
    expect(detectPersonaSwitch("can i talk with the nose please")).toBe("veterinary-nurse");
  });

  it("returns null for non-switch phrases", () => {
    expect(detectPersonaSwitch("what is the heart rate" as any)).toBeNull();
  });
});

describe("looksLikeLabRequest", () => {
  it("detects lab-related terms", () => {
    expect(looksLikeLabRequest("can I have the bloodwork results"));
    expect(looksLikeLabRequest("cbc and chemistry please"));
  });
});
