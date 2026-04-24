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
}

export const LIVE_AUDIO_CONFIG: AudioConfig = {
  inputSampleRate: 16000,
  outputSampleRate: 24000,
  inputEncoding: "pcm_s16le",
  outputEncoding: "pcm_s16le",
};

export const GEMINI_LIVE_MODEL =
  "gemini-3.1-flash-live-preview";

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
