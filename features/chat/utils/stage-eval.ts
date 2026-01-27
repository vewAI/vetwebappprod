import type { Message } from "@/features/chat/models/chat";
import { debugEventBus } from "@/lib/debug-events-fixed";

export type StageEvalResult = {
  status: "ready" | "insufficient";
  metrics: { userTurns: number; assistantTurns: number; matchedAssistantKeywords: number };
};

export function emitStageEvaluation(caseId: string | null | undefined, stageIndex: number, messages: Message[]) {
  try {
    // Lightweight evaluation using same heuristics as ChatInterface.evaluateStageCompletion
    const userTurns = messages.filter((m) => m.stageIndex === stageIndex && m.role === "user").length;
    const assistantTurns = messages.filter((m) => m.stageIndex === stageIndex && m.role === "assistant").length;
    // For telemetry we just estimate keyword hits
    const matchedAssistantKeywords = messages
      .filter((m) => m.stageIndex === stageIndex && m.role === "assistant")
      .reduce((acc, m) => acc + (/(temperature|pulse|heart rate|respiratory|vitals|lungs|auscultation)/i.test(String(m.content || "")) ? 1 : 0), 0);

    const result: StageEvalResult = {
      status: (userTurns >= 2 && assistantTurns >= 2 && matchedAssistantKeywords >= 2) ? "ready" : "insufficient",
      metrics: { userTurns, assistantTurns, matchedAssistantKeywords },
    };

    debugEventBus.emitEvent?.("info", "StageEval", "evaluation", { caseId, stageIndex, result });
    return result;
  } catch (e) {
    try { debugEventBus.emitEvent?.("error", "StageEval", "failed", { error: String(e) }); } catch {}
    return { status: "insufficient", metrics: { userTurns: 0, assistantTurns: 0, matchedAssistantKeywords: 0 } };
  }
}
