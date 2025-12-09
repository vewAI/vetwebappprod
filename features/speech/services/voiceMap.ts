// Per-role voice assignment helper.
// Assigns a TTS voice id to a role and persists it in sessionStorage per-attempt
// so the same role keeps the same voice for the life of the attempt/session.

export type VoicePreset = {
  id: string;
  label: string;
  gender?: "male" | "female" | "neutral";
};
 
export const VOICE_PRESETS: VoicePreset[] = [
  { id: "alloy", label: "Alloy (neutral)", gender: "neutral" },
  { id: "verse", label: "Verse (male)", gender: "male" },
  { id: "coral", label: "Coral (female)", gender: "female" },
  { id: "nova", label: "Nova (female)", gender: "female" },
  { id: "onyx", label: "Onyx (male)", gender: "male" },
  { id: "echo", label: "Echo (neutral)", gender: "neutral" },
  { id: "shimmer", label: "Shimmer (female)", gender: "female" },
  { id: "ballad", label: "Ballad (male)", gender: "male" },
  { id: "ash", label: "Ash (neutral)", gender: "neutral" },
  { id: "sage", label: "Sage (neutral)", gender: "neutral" },
  { id: "marin", label: "Marin (female)", gender: "female" },
  { id: "cedar", label: "Cedar (male)", gender: "male" },
  { id: "fable", label: "Fable (neutral)", gender: "neutral" },
];

const STORAGE_PREFIX = "vmap:";

function safeParse(json?: string | null) {
  try {
    return json ? JSON.parse(json) : {};
  } catch (e) {
    return {};
  }
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
  const { preferredVoice, sex } = resolveOptions(options);
  const key = STORAGE_PREFIX + (attemptId ?? "global");
  try {
    const raw =
      typeof window !== "undefined" ? window.sessionStorage.getItem(key) : null;
    const map = safeParse(raw) as Record<string, string>;
    if (preferredVoice) {
      if (!map || map[role] !== preferredVoice) {
        const updated = { ...(map ?? {}), [role]: preferredVoice };
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(key, JSON.stringify(updated));
        }
      }
      return preferredVoice;
    }
    if (map && map[role]) return map[role];

    const candidateVoices = (() => {
      if (!sex || sex === "neutral") {
        return VOICE_PRESETS;
      }
      const matches = VOICE_PRESETS.filter(
        (preset) => preset.gender === sex || preset.gender === "neutral"
      );
      return matches.length ? matches : VOICE_PRESETS;
    })();

    // Pick a voice deterministically based on role+attempt so it's stable.
    const pickSeed = (role || "role") + "@" + (attemptId ?? "noattempt");
    const startIdx = hashString(pickSeed) % candidateVoices.length;
    // Avoid assigning a voice already used by another role within this
    // attempt so each character sounds distinct. Iterate through presets
    // starting from the hashed index and pick the first unused voice.
    const usedVoices = new Set(Object.values(map || {}));
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
      const newMap = { ...(map || {}), [role]: chosen };
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
