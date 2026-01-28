import { describe, it, expect } from "vitest";
import { postProcessTranscript } from "@/features/speech/services/sttService";

describe("postProcessTranscript phrase corrections", () => {
  it("maps 'college basketball' to 'cardiovascular'", () => {
    expect(postProcessTranscript("college basketball")).toContain("cardiovascular");
    expect(postProcessTranscript("please do college basketball exam")).toContain("cardiovascular");
  });
});
