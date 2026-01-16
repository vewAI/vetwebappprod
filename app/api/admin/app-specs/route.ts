import { NextResponse } from "next/server";
import { ROLE_PROMPT_DEFINITIONS } from "@/features/role-info/services/roleInfoService";

/**
 * GET /api/admin/app-specs
 * Returns core application specifications for admin reference.
 */
export async function GET() {
  // Extract role prompt definitions (templates and docs only, not functions)
  const rolePrompts = Object.entries(ROLE_PROMPT_DEFINITIONS).map(([key, def]) => ({
    key,
    defaultTemplate: def.defaultTemplate,
    placeholderDocs: def.placeholderDocs,
  }));

  // Core app specifications
  const specs = {
    rolePromptDefinitions: rolePrompts,
    findingsReleaseStrategies: [
      {
        value: "immediate",
        description: "Provide all findings/results immediately when asked.",
      },
      {
        value: "on_demand",
        description: "Only reveal findings for the EXACT test or system requested. Ask for clarification on general requests.",
      },
    ],
    defaultStages: [
      { id: "stage-1", title: "History Taking", role: "Client (Owner)", roleInfoKey: "getOwnerPrompt" },
      { id: "stage-2", title: "Physical Examination", role: "Veterinary Nurse", roleInfoKey: "getPhysicalExamPrompt" },
      { id: "stage-3", title: "Diagnostic Planning", role: "Client (Owner)", roleInfoKey: "getOwnerFollowUpPrompt" },
      { id: "stage-4", title: "Laboratory & Tests", role: "Laboratory Technician", roleInfoKey: "getDiagnosticPrompt" },
      { id: "stage-5", title: "Treatment Plan", role: "Veterinary Nurse", roleInfoKey: "getTreatmentPlanPrompt" },
      { id: "stage-6", title: "Client Communication", role: "Client (Owner)", roleInfoKey: "getOwnerDiagnosisPrompt" },
    ],
    personaRoleKeys: [
      { key: "owner", description: "The animal owner/client persona" },
      { key: "nurse", description: "The veterinary nurse/technician persona" },
    ],
    voiceProviders: [
      { provider: "elevenlabs", description: "ElevenLabs TTS - high quality voices" },
      { provider: "openai", description: "OpenAI TTS - fast, reliable" },
    ],
    sttConfig: {
      provider: "openai-whisper",
      incompletePhraseSuffixes: ["and", "but", "so", "because", "with", "the", "a", "an", "to", "for", "of", "or", "if", "when", "that", "which", "who", "where", "is", "are", "was", "were", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "can", "may", "might", "must", "shall", "also", "then", "than", "as", "at", "by", "in", "on", "up", "out", "about", "into", "through", "during", "before", "after", "above", "below", "between", "under", "again", "further", "once", "here", "there", "all", "each", "few", "more", "most", "other", "some", "such", "no", "not", "only", "own", "same", "just", "now", "very", "even", "still", "already", "always", "never", "often", "sometimes", "usually", "really", "actually", "probably", "perhaps", "maybe", "likely", "certainly", "definitely", "basically", "essentially", "generally", "typically", "specifically", "particularly", "especially", "mainly", "mostly", "partly", "primarily", "simply", "just", "quite", "rather", "somewhat", "fairly", "pretty", "very", "really", "too", "enough", "almost", "nearly", "hardly", "barely", "scarcely", "only", "merely", "just", "even", "still", "already", "yet", "anymore", "either", "neither", "both", "whether"],
      description: "Incomplete phrases ending with these words will show '...' and wait for continuation",
    },
    ttsConfig: {
      preDelay: 600,
      suppressionClear: 600,
      sttResumeDelay: 720,
      description: "Timing delays (ms) for TTS/STT coordination in voice mode",
    },
  };

  return NextResponse.json(specs);
}
