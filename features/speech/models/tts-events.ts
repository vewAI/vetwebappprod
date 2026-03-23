export const TTS_START_EVENT = "vw:tts-start" as const;
export const TTS_END_EVENT = "vw:tts-end" as const;

export type TtsEventName = typeof TTS_START_EVENT | typeof TTS_END_EVENT;

export type TtsEventDetail = {
  audio?: HTMLAudioElement;
  caseId?: string;
  role?: string;
  roleKey?: string;
  displayRole?: string;
  messageId?: string;
  forceResume?: boolean;
  metadata?: Record<string, unknown>;
};

export function dispatchTtsEvent(eventName: TtsEventName, detail?: TtsEventDetail) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  } catch (error) {
    console.warn("Failed to dispatch TTS event", error);
  }
}

export function dispatchTtsStart(detail?: TtsEventDetail) {
  dispatchTtsEvent(TTS_START_EVENT, detail);
}

export function dispatchTtsEnd(detail?: TtsEventDetail) {
  dispatchTtsEvent(TTS_END_EVENT, detail);
}
