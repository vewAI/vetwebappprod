import { describe, it, expect } from "vitest";
import { postProcessTranscript } from "@/features/speech/services/sttService";

describe("postProcessTranscript phrase corrections", () => {
  it("maps 'college basketball' to 'cardiovascular'", () => {
    expect(postProcessTranscript("college basketball")).toContain(
      "cardiovascular",
    );
    expect(
      postProcessTranscript("please do college basketball exam"),
    ).toContain("cardiovascular");
  });

  it("maps 'The Simpsons' to 'the symptoms' and 'simpsons' to 'symptoms'", () => {
    expect(postProcessTranscript("when did The Simpsons start")).toContain(
      "symptoms",
    );
    expect(postProcessTranscript("simpsons")).toContain("symptoms");
  });

  it("maps urinalysis mis-hearings to 'urinalysis'", () => {
    expect(postProcessTranscript("you're analysis")).toContain("urinalysis");
    expect(postProcessTranscript("your analysis")).toContain("urinalysis");
    expect(postProcessTranscript("ur analysis")).toContain("urinalysis");
  });
});
