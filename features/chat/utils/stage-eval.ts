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
    // For telemetry we estimate keyword hits on both assistant and user messages
    const keyRegex = /(temperature|pulse|heart rate|respiratory|vitals|lungs|auscultation)/i;
    const matchedAssistantKeywords = messages
      .filter((m) => m.stageIndex === stageIndex && m.role === "assistant")
      .reduce((acc, m) => acc + (keyRegex.test(String(m.content || "")) ? 1 : 0), 0);
    const matchedUserKeywords = messages
      .filter((m) => m.stageIndex === stageIndex && m.role === "user")
      .reduce((acc, m) => acc + (keyRegex.test(String(m.content || "")) ? 1 : 0), 0);

    const totalKeywordHits = matchedAssistantKeywords + matchedUserKeywords;

    // Heuristic: require at least two user turns and at least two keyword hits total.
    // Either the assistant should have contributed multiple turns, or the user must have
    // explicitly requested/mentioned keywords multiple times.
    const ready = userTurns >= 2 && totalKeywordHits >= 2 && (assistantTurns >= 2 || matchedUserKeywords >= 2);

    const result: StageEvalResult = {
      status: ready ? "ready" : "insufficient",
      metrics: { userTurns, assistantTurns, matchedAssistantKeywords },
    };

    // Emit richer telemetry including counts for both user and assistant keyword matches
    try { debugEventBus.emitEvent?.("info", "StageEval", "evaluation", { caseId, stageIndex, result, matchedUserKeywords, matchedAssistantKeywords }); } catch {}
    return result;
  } catch (e) {
    try { debugEventBus.emitEvent?.("error", "StageEval", "failed", { error: String(e) }); } catch {}
    return { status: "insufficient", metrics: { userTurns: 0, assistantTurns: 0, matchedAssistantKeywords: 0 } };
  }
}
