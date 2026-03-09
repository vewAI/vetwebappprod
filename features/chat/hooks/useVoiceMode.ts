"use client";

import { useCallback, useState } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { canStartListening, setSttSuppressed, exitDeafMode, clearAllSttBlocks } from "@/features/speech/services/sttService";

type VoiceToast = { title: string; body: string };

type UseVoiceModeDeps = {
  voiceMode: boolean;
  setVoiceMode: Dispatch<SetStateAction<boolean>>;
  voiceModeRef: MutableRefObject<boolean>;
  requestPermission: () => Promise<void>;
  showMicToast: (message: string, durationMs?: number) => void;
  userToggledOffRef: MutableRefObject<boolean>;
  reset: () => void;
  setInput: (next: string) => void;
  baseInputRef: MutableRefObject<string>;
  setTtsEnabledState: (next: boolean) => void;
  isSuppressingSttRef: MutableRefObject<boolean>;
  resumeListeningRef: MutableRefObject<boolean>;
  isPlayingAudioRef: MutableRefObject<boolean>;
  pushSttTrace: (entry: Record<string, unknown>) => void;
  safeStart: () => void;
  stopAndMaybeSend: () => void;
  stop: () => void;
  voiceModeToastTimerRef: MutableRefObject<number | null>;
  setTimepointToast: (toast: VoiceToast) => void;
  hideTimepointToastWithFade: (duration?: number) => void;
};

export function useVoiceMode({
  voiceMode,
  setVoiceMode,
  voiceModeRef,
  requestPermission,
  showMicToast,
  userToggledOffRef,
  reset,
  setInput,
  baseInputRef,
  setTtsEnabledState,
  isSuppressingSttRef,
  resumeListeningRef,
  isPlayingAudioRef,
  pushSttTrace,
  safeStart,
  stopAndMaybeSend,
  stop,
  voiceModeToastTimerRef,
  setTimepointToast,
  hideTimepointToastWithFade,
}: UseVoiceModeDeps) {
  const [showModeControls, setShowModeControls] = useState<boolean>(true);

  const setVoiceModeEnabled = useCallback(
    async (next: boolean) => {
      if (next) {
        try {
          await requestPermission();
        } catch (e) {
          showMicToast("Microphone access required — please allow access", 4000);
          console.warn("Microphone permission denied or failed", e);
          setVoiceMode(true);
          return;
        }
      }

      setVoiceMode((current) => {
        if (current === next) {
          return current;
        }
        if (next) {
          userToggledOffRef.current = false;
          reset();
          setInput("");
          baseInputRef.current = "";
          setTtsEnabledState(true);

          if (isSuppressingSttRef.current) {
            resumeListeningRef.current = true;
            pushSttTrace({ event: "voiceMode_enabled", action: "deferred_resume_due_to_suppression" });
          } else if (!isPlayingAudioRef.current) {
            pushSttTrace({ event: "voiceMode_enabled", action: "scheduling_start" });
            setTimeout(() => {
              try {
                clearAllSttBlocks();
                isSuppressingSttRef.current = false;
                safeStart();
              } catch (e) {
                pushSttTrace({ event: "voiceMode_start_error", err: String(e) });
              }
            }, 150);
          } else {
            pushSttTrace({ event: "voiceMode_enabled", action: "blocked_audio_playing" });
          }

          try {
            setTimepointToast({ title: "SPEAK - Voice Mode Activated", body: "" });
            if (voiceModeToastTimerRef.current) {
              window.clearTimeout(voiceModeToastTimerRef.current);
              voiceModeToastTimerRef.current = null;
            }
            voiceModeToastTimerRef.current = window.setTimeout(() => {
              hideTimepointToastWithFade(300);
              voiceModeToastTimerRef.current = null;
            }, 2000);
          } catch (e) {
            // ignore toast errors
          }
        } else {
          userToggledOffRef.current = true;
          stopAndMaybeSend();
          stop();
          setTtsEnabledState(false);

          try {
            setTimepointToast({ title: "WRITE - Write Mode Activated", body: "" });
            if (voiceModeToastTimerRef.current) {
              window.clearTimeout(voiceModeToastTimerRef.current);
              voiceModeToastTimerRef.current = null;
            }
            voiceModeToastTimerRef.current = window.setTimeout(() => {
              hideTimepointToastWithFade(300);
              voiceModeToastTimerRef.current = null;
            }, 2000);
          } catch (e) {
            // ignore toast errors
          }
        }
        return next;
      });
    },
    [
      requestPermission,
      showMicToast,
      setVoiceMode,
      userToggledOffRef,
      reset,
      setInput,
      baseInputRef,
      setTtsEnabledState,
      isSuppressingSttRef,
      resumeListeningRef,
      isPlayingAudioRef,
      pushSttTrace,
      safeStart,
      setTimepointToast,
      voiceModeToastTimerRef,
      hideTimepointToastWithFade,
      stopAndMaybeSend,
      stop,
    ],
  );

  const toggleVoiceMode = useCallback(() => {
    try {
      setShowModeControls(false);
    } catch (e) {}
    // If voice mode is on but STT stalled (e.g. after blur/refocus),
    // re-engage instead of toggling off.
    if (voiceModeRef.current) {
      clearAllSttBlocks();
      isSuppressingSttRef.current = false;
      isPlayingAudioRef.current = false;
      userToggledOffRef.current = false;
      setTimeout(() => safeStart(), 80);
      return;
    }
    void setVoiceModeEnabled(true);
  }, [setVoiceModeEnabled, voiceModeRef, safeStart, userToggledOffRef, isSuppressingSttRef, isPlayingAudioRef]);

  return {
    showModeControls,
    setShowModeControls,
    setVoiceModeEnabled,
    toggleVoiceMode,
  };
}

export default useVoiceMode;
