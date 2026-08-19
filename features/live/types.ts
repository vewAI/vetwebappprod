export type LiveSessionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export type LiveEventType =
  | "connected"
  | "audioReceived"
  | "textReceived"
  | "inputTranscription"
  | "interrupted"
  | "disconnected"
  | "error"
  | "turnComplete";

export interface LiveEvent {
  type: LiveEventType;
  data?: unknown;
}

export interface AudioConfig {
  inputSampleRate: number;
  outputSampleRate: number;
  inputEncoding: "pcm_s16le";
  outputEncoding: "pcm_s16le";
}

export interface PersonaInstruction {
  roleKey: string;
  displayName: string;
  portraitUrl?: string;
  systemInstruction: string;
  voiceName?: string;
}

export interface LiveSessionState {
  status: LiveSessionStatus;
  isSpeaking: boolean;
  isListening: boolean;
  currentPersona: PersonaInstruction | null;
  currentStageIndex: number;
  transcript: TranscriptEntry[];
  error: string | null;
}

export interface TranscriptEntry {
  id: string;
  speaker: "user" | "persona";
  text: string;
  timestamp: number;
  /** Persona role key (owner, veterinary-nurse, lab-technician) for persona turns. */
  roleKey?: string;
}

export const LIVE_AUDIO_CONFIG: AudioConfig = {
  inputSampleRate: 16000,
  outputSampleRate: 24000,
  inputEncoding: "pcm_s16le",
  outputEncoding: "pcm_s16le",
};

export const GEMINI_LIVE_MODEL =
  "gemini-3.1-flash-live-preview";

export const GEMINI_VOICE_MAP: Record<string, string> = {
  female: "Aoede",
  male: "Orus",
};

// Gemini Live does not expose an accent parameter. Keep the British-English
// instruction enabled for every persona so the voice configuration cannot
// silently fall back to the default neutral-American delivery.
export const LIVE_BRITISH_ACCENT = true;

export const STAGE_TYPE_TO_PERSONA: Record<string, string> = {
  history: "owner",
  physical: "veterinary-nurse",
  diagnostic: "owner",
  laboratory: "lab-technician",
  treatment: "veterinary-nurse",
  communication: "owner",
};

export const PERSONA_DISPLAY_NAMES: Record<string, string> = {
  owner: "Pet Owner",
  "veterinary-nurse": "Veterinary Nurse",
  "lab-technician": "Lab Technician",
};
