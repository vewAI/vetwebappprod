// Per-role voice assignment helper.
// Assigns a TTS voice id to a role and persists it in sessionStorage per-attempt
// so the same role keeps the same voice for the life of the attempt/session.

export type VoicePreset = {
  id: string;
  label: string;
  gender: "male" | "female" | "neutral";
  accent: "american" | "british" | "australian" | "other";
  provider: "openai" | "elevenlabs";
};
 
export const VOICE_PRESETS: VoicePreset[] = [
  // OpenAI Voices (Standard, Reliable)
  { id: "fable", label: "Fable (British Male)", gender: "male", accent: "british", provider: "openai" },
  { id: "onyx", label: "Onyx (American Male)", gender: "male", accent: "american", provider: "openai" },
  { id: "echo", label: "Echo (American Male)", gender: "male", accent: "american", provider: "openai" },
  { id: "alloy", label: "Alloy (American Neutral)", gender: "neutral", accent: "american", provider: "openai" },
  { id: "shimmer", label: "Shimmer (American Female)", gender: "female", accent: "american", provider: "openai" },
  { id: "nova", label: "Nova (American Female)", gender: "female", accent: "american", provider: "openai" },
  
  // ElevenLabs Voices (High Quality, British Priority)
  { id: "charlie", label: "Charlie (British Male)", gender: "male", accent: "british", provider: "elevenlabs" },
  { id: "george", label: "George (British Male)", gender: "male", accent: "british", provider: "elevenlabs" },
  { id: "harry", label: "Harry (British Male)", gender: "male", accent: "british", provider: "elevenlabs" },
  { id: "alice", label: "Alice (British Female)", gender: "female", accent: "british", provider: "elevenlabs" },
  { id: "charlotte", label: "Charlotte (British Female)", gender: "female", accent: "british", provider: "elevenlabs" },
  { id: "lily", label: "Lily (British Female)", gender: "female", accent: "british", provider: "elevenlabs" },
  { id: "matilda", label: "Matilda (British Female)", gender: "female", accent: "british", provider: "elevenlabs" },
];

const STORAGE_PREFIX = "vmap:";
const ALLOWED_VOICE_IDS = new Set(VOICE_PRESETS.map((preset) => preset.id));

function safeParse(json?: string | null) {
  try {
    return json ? JSON.parse(json) : {};
  } catch (e) {
    return {};
  }
}

export function isSupportedVoice(id?: string | null): id is string {
  if (!id) return false;
  return ALLOWED_VOICE_IDS.has(id);
}

function sanitizeVoiceMap(map: Record<string, string> | undefined | null) {
  const result: Record<string, string> = {};
  if (!map) return { result, mutated: false };
  let mutated = false;
  for (const [role, voiceId] of Object.entries(map)) {
    if (isSupportedVoice(voiceId)) {
      result[role] = voiceId;
    } else {
      mutated = true;
    }
  }
  return { result, mutated } as const;
}

// Simple deterministic hash to pick a voice when none assigned yet.
function hashString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export type VoiceSelectionOptions = {
  preferredVoice?: string;
  sex?: "male" | "female" | "neutral";
};

function resolveOptions(
  arg?: string | VoiceSelectionOptions
): VoiceSelectionOptions {
  if (!arg) return {};
  if (typeof arg === "string") {
    return { preferredVoice: arg };
  }
  return arg;
}

export function getOrAssignVoiceForRole(
  role: string,
  attemptId?: string,
  options?: string | VoiceSelectionOptions
) {
  const resolved = resolveOptions(options);
  const safePreferredVoice = isSupportedVoice(resolved.preferredVoice)
    ? resolved.preferredVoice
    : undefined;
  const sex = resolved.sex;
  const key = STORAGE_PREFIX + (attemptId ?? "global");
  try {
    const raw =
      typeof window !== "undefined" ? window.sessionStorage.getItem(key) : null;
    const { result: map, mutated } = sanitizeVoiceMap(safeParse(raw));
    if (mutated && typeof window !== "undefined") {
      window.sessionStorage.setItem(key, JSON.stringify(map));
    }

    // If a preferred voice is specified and valid, it should override any
    // previously cached random assignment. This ensures that if the backend
    // configuration changes (e.g. fixing a wrong voice ID), the client
    // updates immediately.
    if (safePreferredVoice && map[role] !== safePreferredVoice) {
      const updated = { ...map, [role]: safePreferredVoice };
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(key, JSON.stringify(updated));
      }
      return safePreferredVoice;
    }

    if (map[role]) return map[role];

    if (safePreferredVoice) {
      const updated = { ...map, [role]: safePreferredVoice };
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(key, JSON.stringify(updated));
      }
      return safePreferredVoice;
    }

    const candidateVoices = (() => {
      let pool = VOICE_PRESETS;

      // 1. Filter by Gender (Strict)
      if (sex && sex !== "neutral") {
        const genderMatches = pool.filter((p) => p.gender === sex);
        if (genderMatches.length > 0) {
          pool = genderMatches;
        }
      }

      // 2. Prioritize British Accent
      // If British voices exist in the pool, restrict selection to them.
      // This ensures auto-assigned voices are British by default.
      const britishMatches = pool.filter((p) => p.accent === "british");
      if (britishMatches.length > 0) {
        return britishMatches;
      }

      return pool;
    })();

    // Pick a voice deterministically based on role+attempt so it's stable.
    const pickSeed = (role || "role") + "@" + (attemptId ?? "noattempt");
    const startIdx = hashString(pickSeed) % candidateVoices.length;
    // Avoid assigning a voice already used by another role within this
    // attempt so each character sounds distinct. Iterate through presets
    // starting from the hashed index and pick the first unused voice.
    const usedVoices = new Set(Object.values(map));
    let chosen = candidateVoices[startIdx].id;
    if (usedVoices.has(chosen)) {
      // find next available
      for (let i = 1; i < candidateVoices.length; i++) {
        const idx2 = (startIdx + i) % candidateVoices.length;
        const candidate = candidateVoices[idx2].id;
        if (!usedVoices.has(candidate)) {
          chosen = candidate;
          break;
        }
      }
    }

    // Persist mapping in sessionStorage for the attempt
    try {
      const newMap = { ...map, [role]: chosen };
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(key, JSON.stringify(newMap));
      }
    } catch (e) {
      // ignore storage errors
    }

    return chosen;
  } catch (e) {
    return VOICE_PRESETS[0].id;
  }
}

export function listVoicePresets() {
  return VOICE_PRESETS.slice();
}
