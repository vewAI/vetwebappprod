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
    promptIntegration: {
      title: "How Prompts Integrate Together",
      layers: [
        {
          layer: 1,
          name: "ROLE_PROMPT_DEFINITIONS (Foundation)",
          description: "Stage-specific templates defining the functional role the AI plays. Contains structural rules, data placeholders, and release strategy instructions.",
          example: `"You are roleplaying as the owner... Stay in character..."
{{PRESENTING_COMPLAINT}} → replaced with case data
{{OWNER_BACKGROUND}} → replaced with case data  
{{RELEASE_STRATEGY_INSTRUCTION}} → immediate/on_demand`,
        },
        {
          layer: 2,
          name: "Behavior Prompt (Personality)",
          description: "Per-case persona customizations stored in case_personas.behavior_prompt. Defines HOW the AI says things (tone, mannerisms, personality traits).",
          example: `"Amanda Burns is a 45-year-old horse breeder from Kentucky.
She's practical, no-nonsense, but deeply attached to her animals.
She tends to downplay her worry but watches the vet's face carefully."`,
        },
      ],
      runtimeFlow: [
        "1. Student sends message in a specific stage",
        "2. System loads ROLE_PROMPT_DEFINITIONS template for that stage's roleInfoKey",
        "3. Placeholders are replaced with actual case data (presenting_complaint, owner_background, etc.)",
        "4. Persona behavior_prompt is injected for personality/tone",
        "5. Final prompt combines: Functional instructions + Case data + Personality",
      ],
      responsibilities: [
        { aspect: "WHAT to say (facts, findings)", controlledBy: "ROLE_PROMPT_DEFINITIONS + case fields" },
        { aspect: "HOW to say it (tone, mannerisms)", controlledBy: "Behavior Prompt (case_personas)" },
        { aspect: "WHEN to reveal (filtering)", controlledBy: "findings_release_strategy field" },
        { aspect: "WHO they are (identity)", controlledBy: "case_personas (display_name, voiceId, image_url)" },
      ],
    },
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
      deafWindowAfterTts: 1000,
      description: "Timing delays (ms) for TTS/STT coordination in voice mode. Deaf window prevents mic from hearing its own TTS playback.",
    },
  };

  return NextResponse.json(specs);
}
