import { describe, expect, it } from "vitest";
import {
  appendLiveTextFragment,
  filterLivePersonaText,
} from "../filterLiveResponse";

describe("filterLivePersonaText", () => {
  it("removes the warning boilerplate while preserving the persona reply", () => {
    const result = filterLivePersonaText(
      "someone else, please consult a medical professional. This is not medical advice or diagnosis. I'm so sorry, I think there might be a misunderstanding.. Are you asking about Cerveso's symptoms since yesterday?",
    );

    expect(result).toEqual({
      suppressed: false,
      text: "Are you asking about Cerveso's symptoms since yesterday?",
    });
  });

  it("suppresses a turn made entirely of disclaimer text", () => {
    const result = filterLivePersonaText(
      "I'm unable to provide medical advice. Please consult a veterinary professional.",
    );

    expect(result).toEqual({ text: "", suppressed: true });
  });

  it("keeps normal persona dialogue unchanged", () => {
    const result = filterLivePersonaText(
      "He has been eating less since yesterday, but he is still drinking normally.",
    );

    expect(result).toEqual({
      text: "He has been eating less since yesterday, but he is still drinking normally.",
      suppressed: false,
    });
  });
});

describe("appendLiveTextFragment", () => {
  it("merges overlapping streamed fragments without duplicating text", () => {
    let text = appendLiveTextFragment("Are you asking about", "about Cerveso?");
    text = appendLiveTextFragment(text, "Are you asking about Cerveso?");

    expect(text).toBe("Are you asking about Cerveso?");
  });

  it("accepts cumulative fragments from the API", () => {
    let text = appendLiveTextFragment("Are you", "Are you asking");
    text = appendLiveTextFragment(text, "Are you asking about Cerveso?");

    expect(text).toBe("Are you asking about Cerveso?");
  });
});
