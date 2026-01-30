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
          description: "Stage-specific templates defining the functional role the AI plays. Contains STRICT GUARDRAILS, information delivery rules, data placeholders, and release strategy instructions. These are UNIVERSAL rules that apply to ALL cases.",
          example: `STRICT GUARDRAILS (Non-Negotiable):
- NO DIAGNOSIS: Never reveal the diagnosis
- NO TREATMENT: Never suggest treatments (owner) / Follow student's lead (nurse)
- STRICT SCOPE: Only provide what was specifically requested
- NATURAL LANGUAGE: No JSON, speak professionally

{{PRESENTING_COMPLAINT}} → replaced with case data
{{OWNER_BACKGROUND}} → replaced with case data  
{{RELEASE_STRATEGY_INSTRUCTION}} → immediate/on_demand`,
        },
        {
          layer: 2,
          name: "Behavior Prompt (Personality)",
          description: "Per-case persona customizations stored in case_personas.behavior_prompt. Defines ONLY personality traits - tone, mannerisms, background. The pedagogical rules are now in Layer 1.",
          example: `"Amanda Burns is a 45-year-old horse breeder from Kentucky.
She's practical, no-nonsense, but deeply attached to her animals.
She tends to downplay her worry but watches the vet's face carefully."

NOTE: No need to repeat guardrails here - they're built into the foundation layer.`,
        },
      ],
      runtimeFlow: [
        "1. Student sends message in a specific stage",
        "2. System loads ROLE_PROMPT_DEFINITIONS template for that stage's roleInfoKey",
        "3. Template includes: STRICT GUARDRAILS + ROLE & TONE + INTERACTION GUIDELINES",
        "4. Placeholders are replaced with actual case data",
        "5. Persona behavior_prompt is injected for personality/tone only",
        "6. Final prompt = Universal rules + Case data + Personality traits",
      ],
      responsibilities: [
        { aspect: "WHAT to say (facts, findings)", controlledBy: "ROLE_PROMPT_DEFINITIONS + case fields" },
        { aspect: "WHAT NOT to say (guardrails)", controlledBy: "ROLE_PROMPT_DEFINITIONS (NO DIAGNOSIS, NO TREATMENT, STRICT SCOPE)" },
        { aspect: "HOW to deliver info", controlledBy: "ROLE_PROMPT_DEFINITIONS (temperature in F+C, missing data handling)" },
        { aspect: "HOW to sound (personality)", controlledBy: "Behavior Prompt (case_personas.behavior_prompt)" },
        { aspect: "WHEN to reveal (filtering)", controlledBy: "findings_release_strategy field" },
        { aspect: "WHO they are (identity)", controlledBy: "case_personas (display_name, voiceId, image_url)" },
      ],
      ownerGuardrails: [
        "NEVER reveal or hint at the diagnosis",
        "NEVER describe physical exam findings or clinical metrics",
        "NEVER mention lab results or diagnostic findings",
        "NEVER suggest specific treatments",
        "Observe SYMPTOMS (behavior), not SIGNS (clinical measurements)",
        "Encourage reasoning, challenge vagueness, flag missed steps",
      ],
      nurseGuardrails: [
        "NEVER mention the diagnosis or diagnostics_summary",
        "NEVER provide or suggest treatment plans",
        "STRICT SCOPE: Only provide what was specifically requested",
        "Report temperatures in BOTH Fahrenheit AND Celsius",
        "Missing data = show within normal limits values",
        "Standard profiles for Haematology and Biochemistry requests",
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
      // Short list maintained for UI docs; actual detection uses a smaller, curated set and
      // the `endsWithIncompleteMarker` helper. Note: 'you' was intentionally removed so
      // sentences ending in "you" no longer block auto-send.
      incompletePhraseSuffixes: ["and", "but", "so", "because", "with", "the", "a", "an", "to", "for", "of", "or", "if", "when", "that", "which", "is", "are", "was", "were"],
      description: "Incomplete phrases detected by STT will insert a placeholder '...' and wait for user continuation. The service provides `canStartListening()` and `scheduleClearSuppressionWhen()` helpers to safely coordinate starts after TTS or UI interactions.",
      helpers: {
        canStartListening: "Service-level guard that returns false while explicit suppression, deaf mode, or cooldown windows are active. Use before calling startListening().",
        scheduleClearSuppressionWhen: "Polls a predicate (every 200ms up to 8s by default) and clears STT suppression when it becomes safe (e.g., audio finished). Returns a cancel function.",
        constants: {
          suppressionPollIntervalMs: 200,
          suppressionPollTimeoutMs: 8000
        }
      }
    },
    ttsConfig: {
      // Updated to reflect service behavior: we use a conservative pre-delay to allow
      // microphone hardware to release and permission prompts to resolve,
      // a small resume buffer after audio completes, and a longer 'deaf window' to
      // ignore any trailing audio that could be self-captured.
      preDelay: 700, // ms: wait for hardware/permission stabilization before starting audio play
      suppressionClear: 50, // ms: nominal buffer used when clearing suppression after TTS
      sttResumeDelay: 50, // ms: small buffer applied before attempting to restart STT after audio
      resumeRetryDelay: 800, // ms: retry start if first resume attempt didn't take
      deafWindowAfterTts: 1650, // ms: deaf mode duration (prevents capturing own TTS + safety buffer)
      description: "Timings used to coordinate TTS playback and STT suppression/resume. Key helpers: playTtsAndPauseStt will enter deaf mode and set suppression; scheduleClearSuppressionWhen is used to clear suppression only when playback has actually ended.",
    },
  };

  return NextResponse.json(specs);
}
