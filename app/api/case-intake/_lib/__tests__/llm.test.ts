import { describe, it, expect } from "vitest";
import { parseJsonFromLlm } from "../llm";

describe("parseJsonFromLlm", () => {
  it("parses valid raw JSON string", () => {
    const raw = '{"species": "Equine", "condition": "Colic"}';
    const result = parseJsonFromLlm(raw);
    expect(result).toEqual({ species: "Equine", condition: "Colic" });
  });

  it("strips ```json code fences", () => {
    const raw = '```json\n{\n  "species": "Canine",\n  "condition": "Parvovirus"\n}\n```';
    const result = parseJsonFromLlm(raw);
    expect(result).toEqual({ species: "Canine", condition: "Parvovirus" });
  });

  it("strips generic ``` code fences", () => {
    const raw = '```\n{"status": "ok"}\n```';
    const result = parseJsonFromLlm(raw);
    expect(result).toEqual({ status: "ok" });
  });

  it("extracts JSON embedded in conversational prose", () => {
    const raw = 'Here is the extracted case data:\n{"title": "Laminitis in Mare"}\nHope this helps!';
    const result = parseJsonFromLlm(raw);
    expect(result).toEqual({ title: "Laminitis in Mare" });
  });

  it("throws error for completely unparseable input", () => {
    expect(() => parseJsonFromLlm("This is just plain text without any JSON")).toThrow();
  });
});
