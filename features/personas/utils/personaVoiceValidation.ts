import { VOICE_PRESETS } from "@/features/speech/services/voiceMap";

export type PersonaVoiceEntry = {
  role: string;
  displayName?: string;
  voiceId?: string | null;
};

export type VoiceConflict = {
  voiceId: string;
  voiceLabel: string;
  personas: string[];
};

export type VoiceValidationResult = {
  valid: boolean;
  conflicts: VoiceConflict[];
  error?: string;
};

/**
 * Normalizes a voice identifier for reliable comparison.
 */
export function normalizeVoiceId(voiceId?: string | null): string {
  return (voiceId ?? "").trim().toLowerCase();
}

/**
 * Returns a human-friendly voice label (e.g. "Nova (American Female)")
 * or the normalized voice ID if unknown.
 */
export function getVoiceLabel(voiceId?: string | null): string {
  const norm = normalizeVoiceId(voiceId);
  if (!norm) return "";
  const preset = VOICE_PRESETS.find((p) => p.id.toLowerCase() === norm);
  return preset?.label ?? (voiceId ? voiceId.trim() : "");
}

/**
 * Validates that all personas assigned to a case have distinct voices.
 * If two or more personas share the same voice ID (case-insensitive),
 * validation fails with a descriptive, user-facing error message.
 */
export function validatePersonaVoices(personas: PersonaVoiceEntry[]): VoiceValidationResult {
  const byVoice = new Map<string, PersonaVoiceEntry[]>();

  for (const p of personas) {
    const norm = normalizeVoiceId(p.voiceId);
    if (!norm) continue; // Unassigned / blank voice is skipped

    const existing = byVoice.get(norm) ?? [];
    existing.push(p);
    byVoice.set(norm, existing);
  }

  const conflicts: VoiceConflict[] = [];

  for (const [normVoice, list] of byVoice.entries()) {
    if (list.length > 1) {
      const label = getVoiceLabel(normVoice);
      const personaLabels = list.map((item) => {
        const name = item.displayName?.trim();
        return name && name.toLowerCase() !== item.role.toLowerCase()
          ? `${item.role} (${name})`
          : item.role;
      });

      conflicts.push({
        voiceId: normVoice,
        voiceLabel: label,
        personas: personaLabels,
      });
    }
  }

  if (conflicts.length === 0) {
    return { valid: true, conflicts: [] };
  }

  // Format a clear, educator-friendly error message
  const firstConflict = conflicts[0];
  const personaListStr =
    firstConflict.personas.length === 2
      ? `${firstConflict.personas[0]} and ${firstConflict.personas[1]}`
      : firstConflict.personas.join(", ");

  const error = `The ${personaListStr} cannot share the same voice ("${firstConflict.voiceLabel}"). Each persona must have a distinct voice so students can clearly distinguish who is speaking. Please select a different voice.`;

  return {
    valid: false,
    conflicts,
    error,
  };
}

/**
 * Finds an alternative voice preset that is not already taken by other personas in the case.
 * Prefers the requested gender, or falls back to any available voice.
 */
export function findDistinctAlternativeVoice(
  takenVoiceIds: string[],
  targetSex?: string | null,
  avoidVoiceId?: string | null,
): string {
  const takenNorms = new Set(
    takenVoiceIds
      .concat(avoidVoiceId ? [avoidVoiceId] : [])
      .map((id) => normalizeVoiceId(id))
      .filter(Boolean),
  );

  const normalizedSex = (targetSex ?? "").trim().toLowerCase();

  // 1. First priority: matching gender and not taken
  if (normalizedSex && normalizedSex !== "neutral") {
    const candidate = VOICE_PRESETS.find(
      (p) => (p.gender === normalizedSex || p.gender === "neutral") && !takenNorms.has(p.id.toLowerCase()),
    );
    if (candidate) return candidate.id;
  }

  // 2. Second priority: any available voice preset not taken
  const anyCandidate = VOICE_PRESETS.find((p) => !takenNorms.has(p.id.toLowerCase()));
  if (anyCandidate) return anyCandidate.id;

  // 3. Fallback
  return normalizedSex === "male" ? "george" : "alice";
}
