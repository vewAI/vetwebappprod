// Per-role voice assignment helper.
// Assigns a TTS voice id to a role and persists it in sessionStorage per-attempt
// so the same role keeps the same voice for the life of the attempt/session.

type VoicePreset = {
  id: string;
  label: string;
  gender?: "male" | "female" | "neutral";
};

const VOICE_PRESETS: VoicePreset[] = [
  { id: "alloy", label: "Alloy (neutral)", gender: "neutral" },
  { id: "verse", label: "Verse (male)", gender: "male" },
  { id: "aria", label: "Aria (female)", gender: "female" },
  { id: "matthew", label: "Matthew (male)", gender: "male" },
  { id: "luna", label: "Luna (female)", gender: "female" },
  { id: "oliver", label: "Oliver (male)", gender: "male" },
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

export function getOrAssignVoiceForRole(role: string, attemptId?: string) {
  const key = STORAGE_PREFIX + (attemptId ?? "global");
  try {
    const raw =
      typeof window !== "undefined" ? window.sessionStorage.getItem(key) : null;
    const map = safeParse(raw) as Record<string, string>;
    if (map && map[role]) return map[role];

    // Pick a voice deterministically based on role+attempt so it's stable.
    const pickSeed = (role || "role") + "@" + (attemptId ?? "noattempt");
    const startIdx = hashString(pickSeed) % VOICE_PRESETS.length;
    // Avoid assigning a voice already used by another role within this
    // attempt so each character sounds distinct. Iterate through presets
    // starting from the hashed index and pick the first unused voice.
    const usedVoices = new Set(Object.values(map || {}));
    let chosen = VOICE_PRESETS[startIdx].id;
    if (usedVoices.has(chosen)) {
      // find next available
      for (let i = 1; i < VOICE_PRESETS.length; i++) {
        const idx2 = (startIdx + i) % VOICE_PRESETS.length;
        const candidate = VOICE_PRESETS[idx2].id;
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
