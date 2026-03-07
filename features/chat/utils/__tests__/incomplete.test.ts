import { describe, it, expect } from "vitest";
import { endsWithIncompleteMarker } from "@/features/chat/utils/incomplete";

describe("endsWithIncompleteMarker", () => {
  it("flags pronouns and interrogatives as incomplete (except 'you')", () => {
    // 'you' should not block sends
    expect(!endsWithIncompleteMarker("where are you")).toBe(true);
    expect(endsWithIncompleteMarker("this is the"));
    expect(endsWithIncompleteMarker("i"));
    expect(endsWithIncompleteMarker("can i"));
  });

  it("does NOT flag 'is' and 'to' as incomplete per requirement", () => {
    expect(!endsWithIncompleteMarker("it is")).toBe(true);
    expect(!endsWithIncompleteMarker("going to")).toBe(true);
  });
});
