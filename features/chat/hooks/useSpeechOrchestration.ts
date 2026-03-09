"use client";

import { useRef, type MutableRefObject } from "react";
import type { TtsEventDetail } from "@/features/speech/models/tts-events";
import {
  setSttSuppressed,
  setSttSuppressedFor,
  enterDeafMode,
  exitDeafMode,
  canStartListening,
} from "@/features/speech/services/sttService";
import { speakRemote, speakRemoteStream, stopActiveTtsPlayback } from "@/features/speech/services/ttsService";
import { estimateTtsDurationMs } from "@/features/chat/utils/ttsEstimate";

export type TtsPlaybackMeta = Omit<TtsEventDetail, "audio"> | undefined;

type UseSpeechOrchestrationDeps = {
  abort: () => void;
  stop: () => void;
  reset: () => void;
  setInput: (next: string) => void;
  setFallbackNotice: (next: string | null) => void;
  sanitizeForTts: (text: string) => string;
  ttsAvailable: boolean;
  speak: (text: string, lang?: string, gender?: "male" | "female") => void;
  speakAsync?: (text: string, lang?: string, gender?: "male" | "female") => Promise<void>;
  safeStart: () => void;
  attemptStartListening: (initialDelay?: number) => void;
  pushSttTrace: (entry: Record<string, unknown>) => void;
  isListening: boolean;
  isPlayingAudioRef: MutableRefObject<boolean>;
  isSuppressingSttRef: MutableRefObject<boolean>;
  lastTtsEndRef: MutableRefObject<number>;
  autoSendFinalTimerRef: MutableRefObject<number | null>;
  autoSendPendingTextRef: MutableRefObject<string | null>;
  voiceModeRef: MutableRefObject<boolean>;
  userToggledOffRef: MutableRefObject<boolean>;
  wasMicPausedForTtsRef: MutableRefObject<boolean>;
  resumeListeningRef: MutableRefObject<boolean>;
  baseInputRef: MutableRefObject<string>;
};

export function useSpeechOrchestration(deps: UseSpeechOrchestrationDeps) {
  const playbackRunIdRef = useRef(0);

  const playTtsAndPauseStt = async (text: string, voice?: string, meta?: TtsPlaybackMeta, gender?: "male" | "female", skipResume?: boolean) => {
    const ensureSttSuppressedDuringPlayback = () => {
      try {
        setSttSuppressed(true);
        deps.isSuppressingSttRef.current = true;
      } catch {}
    };
    ensureSttSuppressedDuringPlayback();
    
    if (!text) return;
    stopActiveTtsPlayback();
    const runId = ++playbackRunIdRef.current;
    deps.isPlayingAudioRef.current = true;

    if (deps.autoSendFinalTimerRef.current) {
      window.clearTimeout(deps.autoSendFinalTimerRef.current);
      deps.autoSendFinalTimerRef.current = null;
    }
    deps.autoSendPendingTextRef.current = null;

    try {
      enterDeafMode();
    } catch {}

    try {
      setSttSuppressed(true, false, "tts");
    } catch {}
    deps.isSuppressingSttRef.current = true;

    const forced = (meta as any)?.forceResume === true;
    const voiceModeActive = deps.voiceModeRef.current === true;
    deps.wasMicPausedForTtsRef.current = Boolean((deps.isListening || forced || voiceModeActive) && !deps.userToggledOffRef.current);
    deps.resumeListeningRef.current = Boolean(deps.wasMicPausedForTtsRef.current);

    const ttsResumeExecuted = { current: false } as { current: boolean };
    const clearTtsEstimatedTimer = (timerRef: { current: number | null }) => {
      try {
        if (timerRef.current) {
          window.clearTimeout(timerRef.current as number);
          timerRef.current = null;
        }
      } catch {}
    };

    const RESUME_DELAY_AFTER_TTS_MS = 120;
    const RESUME_DEAF_BUFFER_MS = 50;

    const doTtsResume = (skipResumeLocal = false) => {
      const tryResumeWhenSafe = () => {
        try {
          if (playbackRunIdRef.current !== runId) return;
          if (ttsResumeExecuted.current) return;
          if (deps.isPlayingAudioRef.current) {
            window.setTimeout(tryResumeWhenSafe, 200);
            return;
          }

          ttsResumeExecuted.current = true;
          deps.isSuppressingSttRef.current = false;
          
          try {
            // Keep only a tiny trailing buffer to avoid echo while allowing
            // mic resume quickly after assistant speech.
            exitDeafMode(RESUME_DEAF_BUFFER_MS);
          } catch {}

          try {
            setSttSuppressed(false, true, "tts-resume");
          } catch {}

          if (skipResumeLocal || skipResume) return;

          const shouldResumeDueToTts = deps.wasMicPausedForTtsRef.current && !deps.userToggledOffRef.current;

          if (shouldResumeDueToTts) {
            deps.wasMicPausedForTtsRef.current = false;
            deps.resumeListeningRef.current = false;
            try {
              deps.pushSttTrace({ event: "tts_resume_flow", path: "primary", delay: RESUME_DELAY_AFTER_TTS_MS });
            } catch (e) {}
            deps.attemptStartListening(RESUME_DELAY_AFTER_TTS_MS);
            try {
              window.setTimeout(() => {
                try {
                  if (deps.voiceModeRef.current && !deps.isListening && !deps.userToggledOffRef.current) {
                    deps.pushSttTrace({ event: "tts_retry_start_after_resume" });
                    try {
                      if (!canStartListening()) return;
                    } catch (e) {}
                    deps.safeStart();
                  }
                } catch (e) {
                  // ignore retry failures
                }
              }, 800);
            } catch (e) {}
          } else if (deps.resumeListeningRef.current) {
            deps.resumeListeningRef.current = false;
            try {
              deps.pushSttTrace({ event: "tts_resume_flow", path: "fallback", delay: RESUME_DELAY_AFTER_TTS_MS });
            } catch (e) {}
            deps.attemptStartListening(RESUME_DELAY_AFTER_TTS_MS);
            try {
              window.setTimeout(() => {
                try {
                  if (deps.voiceModeRef.current && !deps.isListening && !deps.userToggledOffRef.current) {
                    deps.pushSttTrace({ event: "tts_retry_start_after_fallback" });
                    try {
                      if (!canStartListening()) return;
                    } catch (e) {}
                    deps.safeStart();
                  }
                } catch (e) {
                  // ignore retry failures
                }
              }, 800);
            } catch (e) {}
          } else if (deps.voiceModeRef.current && !deps.userToggledOffRef.current) {
            try {
              deps.pushSttTrace({ event: "tts_resume_flow", path: "voiceMode_fallback" });
            } catch (e) {}
            deps.attemptStartListening(RESUME_DELAY_AFTER_TTS_MS);
          } else {
            
          }
        } catch (e) {
          console.error("Error while attempting safe resume after TTS:", e);
        }
      };

      tryResumeWhenSafe();
    };

    const ttsEstimatedEndTimerRef: { current: number | null } = { current: null };

    try {
      deps.abort();
    } catch {}
    try {
      deps.stop();
    } catch {}

    try {
      deps.reset();
    } catch {}

    try {
      deps.baseInputRef.current = "";
      deps.setInput("");
    } catch (e) {}

    await new Promise((resolve) => setTimeout(resolve, 700));

    const estimatedMs = estimateTtsDurationMs(text);
    try {
      clearTtsEstimatedTimer(ttsEstimatedEndTimerRef);
      const ESTIMATE_RESUME_BUFFER_MS = 50;
      const TTS_ESTIMATE_MULTIPLIER = 1.35;
      const resumeDelay = Math.round(estimatedMs * TTS_ESTIMATE_MULTIPLIER) + ESTIMATE_RESUME_BUFFER_MS;
      
      ttsEstimatedEndTimerRef.current = window.setTimeout(() => {
        
        doTtsResume();
      }, resumeDelay);

      try {
        const SAFETY_BUFFER_MS = 500;
        setSttSuppressedFor(resumeDelay + SAFETY_BUFFER_MS, "tts");
      } catch (e) {
        // ignore failures to set suppression
      }

      const FORCED_RESUME_MS = 4000;
      const forcedResumeTimer = window.setTimeout(() => {
        try {
          if (!deps.isListening && !deps.isPlayingAudioRef.current && deps.voiceModeRef.current && !deps.userToggledOffRef.current) {
            deps.pushSttTrace({ event: "forced_resume_safety_timer_fired" });
            deps.isSuppressingSttRef.current = false;
            try {
              setSttSuppressed(false, true, "tts-forced");
            } catch {}
            try {
              // Forced safety resume must clear deaf mode immediately before
              // calling safeStart, otherwise canStartListening stays blocked.
              exitDeafMode(0);
            } catch {}
            deps.safeStart();
          }
        } catch (e) {
          // ignore
        }
      }, FORCED_RESUME_MS);

      (ttsEstimatedEndTimerRef as any).forcedResumeTimer = forcedResumeTimer;
    } catch (e) {
      // ignore timer scheduling errors
    }

    try {
      const ttsText = deps.sanitizeForTts(text);
      try {
        await speakRemoteStream(ttsText, voice, meta);
      } catch (streamErr) {
        try {
          await speakRemote(ttsText, voice, meta);
        } catch (bufErr) {
          try {
            deps.setFallbackNotice("High-quality voice unavailable. Using browser fallback.");
            setTimeout(() => deps.setFallbackNotice(null), 4000);

            if (deps.ttsAvailable && deps.speakAsync) {
              await deps.speakAsync(ttsText, "en-US", gender);
            } else if (deps.ttsAvailable) {
              deps.speak(ttsText, "en-US", gender);
              // speak() is fire-and-forget; wait roughly the expected duration
              // to avoid re-enabling STT while browser TTS is still speaking.
              await new Promise((resolve) => setTimeout(resolve, Math.max(estimateTtsDurationMs(ttsText), 1500)));
            }
          } catch (e) {
            console.error("TTS playback failed:", e);
          }
        }
      }
    } finally {
      if (playbackRunIdRef.current !== runId) {
        return;
      }
      deps.isPlayingAudioRef.current = false;
      deps.lastTtsEndRef.current = Date.now();
      
      try {
        const forcedTimer = (ttsEstimatedEndTimerRef as any).forcedResumeTimer;
        if (forcedTimer) {
          window.clearTimeout(forcedTimer);
          (ttsEstimatedEndTimerRef as any).forcedResumeTimer = null;
        }
      } catch {}
      try {
        doTtsResume();
      } catch (e) {
        console.warn("Error triggering TTS resume after playback finished", e);
      }
    }
  };

  return {
    playTtsAndPauseStt,
  };
}

export default useSpeechOrchestration;
