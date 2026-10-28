import { describe, expect, it } from "vitest";
import {
  buildReasoningScaffoldingInstruction,
  ROLE_PROMPT_DEFINITIONS,
} from "../roleInfoService";

describe("buildReasoningScaffoldingInstruction", () => {
  it("provides Socratic reasoning scaffolding instructions for Easy difficulty", () => {
    const easyInstruction = buildReasoningScaffoldingInstruction("Easy");
    expect(easyInstruction).toContain("early-year student");
    expect(easyInstruction).toContain("Socratic");
    expect(easyInstruction).toContain("without giving away diagnoses");
  });

  it("provides standard support instructions for Medium difficulty", () => {
    const mediumInstruction = buildReasoningScaffoldingInstruction("Medium");
    expect(mediumInstruction).toContain("intermediate student");
    expect(mediumInstruction).toContain("standard professional support");
  });

  it("provides strict neutral exam simulation instructions for Hard difficulty", () => {
    const hardInstruction = buildReasoningScaffoldingInstruction("Hard");
    expect(hardInstruction).toContain("Hard (advanced / exam simulation)");
    expect(hardInstruction).toContain("Strict neutral execution");
    expect(hardInstruction).toContain("Do NOT give hints");
  });
});

describe("ROLE_PROMPT_DEFINITIONS difficulty scaffolding integration", () => {
  it("injects Socratic scaffolding into getPhysicalExamPrompt for Easy cases", () => {
    const def = ROLE_PROMPT_DEFINITIONS.getPhysicalExamPrompt;
    const replacements = def.buildReplacements({
      caseRow: { difficulty: "Easy", physical_exam_findings: "HR: 80" } as any,
      userMessage: "What are the vitals?",
    });

    expect(replacements.REASONING_SCAFFOLDING_INSTRUCTION).toContain("early-year student");
    expect(replacements.REASONING_SCAFFOLDING_INSTRUCTION).toContain("Socratic");
  });

  it("injects Socratic scaffolding into getDiagnosticPrompt for Easy cases", () => {
    const def = ROLE_PROMPT_DEFINITIONS.getDiagnosticPrompt;
    const replacements = def.buildReplacements({
      caseRow: { difficulty: "Easy", diagnostic_findings: "CBC normal" } as any,
      userMessage: "Can I get CBC?",
    });

    expect(replacements.REASONING_SCAFFOLDING_INSTRUCTION).toContain("early-year student");
  });

  it("injects exam neutrality into getDiagnosticPrompt for Hard cases", () => {
    const def = ROLE_PROMPT_DEFINITIONS.getDiagnosticPrompt;
    const replacements = def.buildReplacements({
      caseRow: { difficulty: "Hard", diagnostic_findings: "CBC normal" } as any,
      userMessage: "Can I get CBC?",
    });

    expect(replacements.REASONING_SCAFFOLDING_INSTRUCTION).toContain("Strict neutral execution");
  });
});
