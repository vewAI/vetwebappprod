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
    // Concise prompt summaries for quick reference in the admin UI
    promptSamples: [
      { key: "getOwnerPrompt", summary: "Owner persona template - strict guardrails: no diagnosis, no findings, non-expert observant tone, encourages reasoning and concise history." },
      { key: "getPhysicalExamPrompt", summary: "Nurse/Physical exam template - clipboard-style reporting: report only requested systems, temperatures in °F and °C, do NOT provide diagnosis or suggest treatments; supports 'immediate' or 'on_demand' release strategies." },
      { key: "getDiagnosticPrompt", summary: "Diagnostic/lab template - report only requested test categories; do NOT provide diagnosis or treatment; includes standard profiles for CBC and Chemistry panels." },
      { key: "getOwnerFollowUpPrompt", summary: "Owner follow-up - focuses on test necessity, costs, expectations, and pragmatic next steps for owners." },
      { key: "getOwnerDiagnosisPrompt", summary: "Owner diagnosis communication template - for discharge and prognosis discussions; still must not contradict the 'no diagnosis' guardrail when used in training contexts." },
      { key: "getTreatmentPlanPrompt", summary: "Treatment plan role - high-level care coordination messages for the nurse persona; do NOT suggest or prescribe definitive treatments in place of student reasoning." },
    ],
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
      description: "Incomplete phrases detected by STT will insert a placeholder '...' and wait for user continuation. The system supports both 'voice-first' and standard flows. In voice-first mode the assistant may speak before the message text appears; in standard mode text appears immediately and audio plays after. The STT service provides `canStartListening()` and `scheduleClearSuppressionWhen()` helpers to safely coordinate starts after TTS or UI interactions.",
      speakMode: {
        description: "Speak Mode governs how TTS and STT interact during conversational flows.",
        behavior: [
          "Voice-first: Assistant audio may play before the assistant message text is appended; text replaces a temporary placeholder after playback completes.",
          "Standard: Assistant text appears immediately, then audio plays; STT is paused for playback and will only resume when it is safe.",
          "UI-driven persona greetings (e.g., switching to Nurse via UI) explicitly DO NOT force mic resume to avoid accidental auto-listen.",
        ],
        incompleteFragmentTiming: {
          initialWaitMs: 4000, // When an incomplete fragment (placeholder '...') is detected, wait 4s for continuation
          extendedWaitMs: 4000, // If still incomplete, extend another 4s before forcing a send (total potential wait 8s)
          note: "Implementation detail: first timer is 4s; if the trailing token still looks incomplete, an additional 4s timer will send unless the fragment is extended by user speech."
        },
        autoSendBehavior: "Auto-sends triggered by STT use small flash feedback and can be blocked by duplicate detection; manual sends always override auto-send blocks.",
      },
      descriptionLong: "Key helpers: `playTtsAndPauseStt` will set STT suppression and enter 'deaf mode' while audio plays, clear suppression only when audio ends (using a polling safety guard), and resume STT only if the mic was actively listening before playback and the user hasn't manually toggled it off.",
      helpers: {
        canStartListening: "Service-level guard that returns false while explicit suppression, deaf mode, or cooldown windows are active. Use before calling startListening().",
        scheduleClearSuppressionWhen: "Polls a predicate (every 200ms up to 8s by default) and clears STT suppression when it becomes safe (e.g., audio finished). Returns a cancel function.",
        suppressionReasons: "When suppression is set, a 'reason' string is logged for telemetry (e.g., 'tts', 'tts-clear', 'ui-greeting', 'manual').",
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
      suppressionClear: 50, // ms: nominal buffer used when clearing suppression after TTS (used with skipCooldown)
      sttResumeDelay: 50, // ms: small buffer applied before attempting to restart STT after audio
      resumeRetryDelay: 800, // ms: retry start if first resume attempt didn't take
      deafWindowAfterTts: 1650, // ms: deaf mode duration (prevents capturing own TTS + safety buffer)
      // How deaf time is calculated: we use a base trailing safety window (1500ms) and apply
      // a small safety multiplier (10%) to handle browser audio lag and codec buffering.
      // Implementation: DEAF_WINDOW_AFTER_TTS_MS = Math.round(1500 * 1.1) => ~1650ms.
      deafWindowCalc: "deafWindowAfterTts = Math.round(1500 * 1.1) (~1650ms) - base trailing safety window (1500ms) plus 10% safety buffer.",
      description: "Timings used to coordinate TTS playback and STT suppression/resume. Key helpers: playTtsAndPauseStt will enter deaf mode and set suppression; scheduleClearSuppressionWhen is used to clear suppression only when playback has actually ended. Telemetry emits suppression reasons for easier triage.",
    },
  };

  return NextResponse.json(specs);
}
