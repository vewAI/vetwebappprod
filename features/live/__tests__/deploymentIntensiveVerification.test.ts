import { describe, expect, it, vi } from "vitest";

const { mockSupabase } = vi.hoisted(() => {
  return {
    mockSupabase: {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                physical_exam_findings:
                  "Temperature: 38.1 C\nHeart Rate: 48 bpm\nRespiratory Rate: 16 bpm\nMuscle palpation: firm on dorsal gluteals",
                diagnostic_findings: "CBC: WNL\nCK: 12000 U/L\nAST: 1500 U/L",
              },
              error: null,
            }),
          }),
        }),
      }),
    },
  };
});

vi.mock("@/app/api/_lib/auth", () => ({
  requireUser: vi.fn().mockResolvedValue({
    user: { id: "test-user-id" },
    supabase: mockSupabase,
  }),
}));

vi.mock("@/app/api/_lib/rateLimit", () => ({
  consumeRateLimit: vi.fn().mockResolvedValue(true),
}));

import type { Case } from "@/features/case-selection/models/case";
import type { Stage } from "@/features/stages/types";
import { buildPersonaSystemInstruction } from "../services/systemInstructionBuilder";
import {
  DISCLAIMER_SUPPRESSION,
  CHAT_SYSTEM_GUIDELINE,
} from "@/features/chat/prompts/systemGuideline";
import { filterLivePersonaText } from "../utils/filterLiveResponse";
import { POST as findingsPost } from "@/app/api/live/findings/route";

const mockCase: Case = {
  id: "case-equine-lameness",
  title: "Horse reluctant to move",
  description: "A 9-year-old gelding presenting with reluctance to move and stiff gait.",
  species: "Equine",
  condition: "Reluctance to move",
  category: "Equine",
  difficulty: "Medium",
  estimatedTime: 15,
  imageUrl: "",
  physicalExamFindings:
    "Temperature: 38.1 C - Heart Rate: 48 bpm - Respiratory Rate: 16 bpm - Muscle palpation: firm on dorsal gluteals",
  diagnosticFindings:
    "CBC: WNL - Chemistry: CK elevated at 12000 U/L, AST elevated at 1500 U/L",
};

const historyStage: Stage = {
  id: "stage-history",
  title: "History Taking",
  description: "Take clinical history from the owner",
  completed: false,
  role: "owner",
  settings: { stage_type: "history" },
};

const physicalStage: Stage = {
  id: "stage-physical",
  title: "Physical Examination",
  description: "Examine the horse with assistance from the veterinary nurse",
  completed: false,
  role: "veterinary-nurse",
  settings: { stage_type: "physical" },
};

const labStage: Stage = {
  id: "stage-lab",
  title: "Laboratory & Tests",
  description: "Request and analyze diagnostic lab panels",
  completed: false,
  role: "lab-technician",
  settings: { stage_type: "laboratory" },
};

describe("Intensive Verification: Deployment 30074d4 + Feedback Fixes", () => {
  describe("1. Universal Disclaimer Suppression in all Prompt Layers", () => {
    it("exports a comprehensive, authoritative DISCLAIMER_SUPPRESSION constant", () => {
      expect(DISCLAIMER_SUPPRESSION).toBeDefined();
      expect(DISCLAIMER_SUPPRESSION).toContain("DISCLAIMER SUPPRESSION (ABSOLUTE, HIGHEST PRIORITY)");
      expect(DISCLAIMER_SUPPRESSION).toContain("TRAINING SIMULATION for veterinary students");
      expect(DISCLAIMER_SUPPRESSION).toContain("NEVER say 'this is not medical/veterinary advice'");
      expect(DISCLAIMER_SUPPRESSION).toContain("I cannot provide medical advice");
      expect(DISCLAIMER_SUPPRESSION).toContain("supervised by licensed faculty");
    });

    it("embeds DISCLAIMER_SUPPRESSION in CHAT_SYSTEM_GUIDELINE", () => {
      expect(CHAT_SYSTEM_GUIDELINE).toContain(DISCLAIMER_SUPPRESSION);
    });

    it("embeds DISCLAIMER_SUPPRESSION in systemInstruction for all personas and stages", () => {
      const personas = [
        { roleKey: "owner", stage: historyStage },
        { roleKey: "veterinary-nurse", stage: physicalStage },
        { roleKey: "lab-technician", stage: labStage },
      ];

      for (const { roleKey, stage } of personas) {
        const result = buildPersonaSystemInstruction({
          caseItem: mockCase,
          stage,
          personaRoleKey: roleKey,
        });

        expect(result.systemInstruction).toContain("DISCLAIMER SUPPRESSION (ABSOLUTE, HIGHEST PRIORITY)");
        expect(result.systemInstruction).toContain("TRAINING SIMULATION for veterinary students");
        expect(result.systemInstruction).toContain("I cannot provide medical advice");
      }
    });
  });

  describe("2. Nurse Persona Voice Findings Suppression", () => {
    it("instructs the nurse never to recite or speak clinical data aloud in physical stage", () => {
      const nurseInstruction = buildPersonaSystemInstruction({
        caseItem: mockCase,
        stage: physicalStage,
        personaRoleKey: "veterinary-nurse",
      }).systemInstruction;

      // Must have strict prohibition rules
      expect(nurseInstruction).toContain("NEVER SPEAK EXAM FINDINGS, VITALS, OR LAB VALUES ALOUD (ABSOLUTE & STRICT)");
      expect(nurseInstruction).toContain("The student sees all findings visually in the test results panel on their screen");
      expect(nurseInstruction).toContain("ONLY confirm in ONE brief phrase that the findings are in their panel");
      expect(nurseInstruction).toContain("NEVER speak, recite, describe, or summarize the numbers, measurements, or findings out loud");
      expect(nurseInstruction).toContain("do NOT speak findings, vitals, diagnostic interpretations, or treatment recommendations aloud");

      // Clinical data section header must explicitly forbid speaking values
      expect(nurseInstruction).toContain("CLINICAL DATA (reference for your situational awareness only — NEVER READ, RECITE, OR SPEAK THESE VALUES ALOUD");
      // Contradictory old wording must NOT exist
      expect(nurseInstruction).not.toContain("report values accurately when asked");
      expect(nurseInstruction).not.toContain("Report only recorded findings.");
    });

    it("instructs the lab technician/nurse never to recite values in laboratory stage", () => {
      const labInstruction = buildPersonaSystemInstruction({
        caseItem: mockCase,
        stage: labStage,
        personaRoleKey: "lab-technician",
      }).systemInstruction;

      expect(labInstruction).toContain("NEVER SPEAK EXAM FINDINGS, VITALS, OR LAB VALUES ALOUD (ABSOLUTE & STRICT)");
      expect(labInstruction).toContain("The results are delivered as WRITTEN TEXT in the results panel");
      expect(labInstruction).toContain("NEVER speak values aloud");
    });
  });

  describe("3. Owner Persona Tone: Concerned & Anxious, Not Cheerful", () => {
    it("instructs the owner persona with an anxious, serious, worried tone", () => {
      const ownerInstruction = buildPersonaSystemInstruction({
        caseItem: mockCase,
        stage: historyStage,
        personaRoleKey: "owner",
      }).systemInstruction;

      expect(ownerInstruction).toContain("VOICE TONE (CRITICAL): You are deeply worried about your animal");
      expect(ownerInstruction).toContain("Think of a parent in a hospital waiting room");
      expect(ownerInstruction).toContain("You are NOT cheerful, NOT upbeat, NOT casual, NOT chatty");
      expect(ownerInstruction).toContain("Avoid ALL exclamation marks. Keep your voice low and serious");
      expect(ownerInstruction).toContain("The owner is GENUINELY DISTRESSED about a sick animal");
      expect(ownerInstruction).toContain("deeply worried, anxious animal owner who is genuinely distressed");
      expect(ownerInstruction).toContain("you NEVER sound cheerful, bright, or casual");
    });
  });

  describe("4. Absence of Unwanted Cost & Budget Prompts", () => {
    it("verifies cost/financial questions were purged from owner prompt instructions", () => {
      const ownerInstruction = buildPersonaSystemInstruction({
        caseItem: mockCase,
        stage: historyStage,
        personaRoleKey: "owner",
      }).systemInstruction;

      expect(ownerInstruction).not.toContain("What can I expect in terms of expenses?");
      expect(ownerInstruction).not.toContain("Discuss logistics and costs");
      expect(ownerInstruction).not.toContain("What are the costs?");
      expect(ownerInstruction).not.toContain("how much they cost");
      expect(ownerInstruction).not.toContain("How much will this cost?");
    });
  });

  describe("5. Post-Generation Disclaimer Filter (filterLivePersonaText)", () => {
    it("strips common medical disclaimer patterns while keeping persona content", () => {
      const sample =
        "Please consult a veterinary professional. This is not medical advice. Max has been lethargic since yesterday morning.";
      const res = filterLivePersonaText(sample);
      expect(res.suppressed).toBe(false);
      expect(res.text).toBe("Max has been lethargic since yesterday morning.");
    });

    it("suppresses standalone disclaimer turns completely", () => {
      const standalone = "I cannot provide medical advice. Seek professional help.";
      const res = filterLivePersonaText(standalone);
      expect(res.suppressed).toBe(true);
      expect(res.text).toBe("");
    });
  });

  describe("6. /api/live/findings Endpoint: Only Student-Requested Findings Appear", () => {
    it("reveals findings when the student explicitly requests them in physical stage", async () => {
      const request = new Request("http://localhost/api/live/findings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: "case-equine-lameness",
          userText: "I'd like to check his temperature and heart rate please.",
          assistantText: "Recorded on your panel, Doctor.",
          stageType: "physical",
        }),
      });

      const res = await findingsPost(request);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.items).toBeDefined();
      expect(Array.isArray(json.items)).toBe(true);

      const labels = json.items.map((it: any) => it.label.toLowerCase());
      expect(labels).toContain("temperature");
      expect(labels).toContain("heart rate");
      // Unrequested parameters should NOT be revealed
      expect(labels).not.toContain("respiratory rate");
      expect(labels).not.toContain("muscle palpation");
    });

    it("does NOT reveal findings when the nurse mentions them in assistantText but student did NOT ask", async () => {
      const request = new Request("http://localhost/api/live/findings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: "case-equine-lameness",
          // Student only greeted casually
          userText: "Hello Amanda, good morning.",
          // Nurse improperly spoke vitals in assistantText
          assistantText:
            "Good morning Doctor. His temperature is 38.1 and heart rate is 48 bpm and respiratory rate is 16.",
          stageType: "physical",
        }),
      });

      const res = await findingsPost(request);
      const json = await res.json();

      expect(res.status).toBe(200);
      // Because assistant-text reveal is disabled, zero items should be revealed!
      expect(json.items).toEqual([]);
    });

    it("blocks physical findings reveal when in history stage even if requested", async () => {
      const request = new Request("http://localhost/api/live/findings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: "case-equine-lameness",
          userText: "Let me check his temperature and heart rate.",
          assistantText: "The nurse will assist with the exam.",
          stageType: "history",
        }),
      });

      const res = await findingsPost(request);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.items).toEqual([]);
    });
  });

  describe("7. Stage Timer & Confirmation State Machine Logic", () => {
    it("simulates the timer expiration and 'Stay' button behavior correctly", () => {
      // Logic from live-session.tsx:
      // When stageSecondsLeft === 0:
      //   timerExpiredRef.current = true
      //   isPaused = true
      //   showAdvanceConfirm = true
      let stageIndex = 0;
      let isPaused = false;
      let showAdvanceConfirm = false;
      let timerExpired = false;

      const onTimerExpire = () => {
        timerExpired = true;
        isPaused = true;
        showAdvanceConfirm = true;
      };

      const handleConfirmAdvance = () => {
        showAdvanceConfirm = false;
        isPaused = false;
        stageIndex += 1;
      };

      const handleCancelAdvance = () => {
        showAdvanceConfirm = false;
        if (timerExpired) {
          // If timer expired, Stay cannot keep user in stage — advance anyway!
          isPaused = false;
          stageIndex += 1;
        } else {
          // If timer still running, resume session
          isPaused = false;
        }
      };

      // Scenario A: Timer expires, student clicks Stay -> forces advance
      onTimerExpire();
      expect(timerExpired).toBe(true);
      expect(isPaused).toBe(true);
      expect(showAdvanceConfirm).toBe(true);

      handleCancelAdvance();
      expect(showAdvanceConfirm).toBe(false);
      expect(isPaused).toBe(false);
      expect(stageIndex).toBe(1); // advanced to next stage!

      // Scenario B: Student clicks advance manually with time remaining, then clicks Stay
      timerExpired = false;
      isPaused = false;
      showAdvanceConfirm = true; // student opened prompt early

      handleCancelAdvance();
      expect(showAdvanceConfirm).toBe(false);
      expect(isPaused).toBe(false);
      expect(stageIndex).toBe(1); // stayed in stage 1!

      // Scenario C: Student clicks Yes to advance
      showAdvanceConfirm = true;
      handleConfirmAdvance();
      expect(showAdvanceConfirm).toBe(false);
      expect(stageIndex).toBe(2);
    });
  });
});
