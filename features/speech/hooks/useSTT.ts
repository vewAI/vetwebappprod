import { useState, useCallback, useEffect, useRef } from "react";
import { startListening, stopListening } from "../services/sttService";

/**
 * Simple hook for speech-to-text functionality
 */
export function useSTT(onFinal?: (text: string) => void, debounceMs = 700) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const pausedByTtsRef = useRef(false);

  // Buffer for final chunks and debounce timer to merge nearby final events
  const pendingFinalRef = useRef<string>("");
  const timerRef = useRef<number | null>(null);
  // Keep a ref to the latest onFinal so scheduled timers always call the
  // newest callback (prevents stale-closure bugs when parent state like
  // `voiceMode` is captured in the callback).
  const onFinalRef = useRef(onFinal);

  // Keep the ref up to date when onFinal changes
  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  // Helper to schedule onFinal after debounceMs of silence
  const scheduleOnFinal = (chunk: string) => {
    // Append with a space
    pendingFinalRef.current = (pendingFinalRef.current + " " + chunk).trim();

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    timerRef.current = window.setTimeout(() => {
      const toSend = pendingFinalRef.current.trim();
      pendingFinalRef.current = "";
      timerRef.current = null;
      try {
        console.debug("useSTT.scheduleOnFinal: sending final chunk=", toSend);
        const cb = onFinalRef.current;
        if (cb && toSend) cb(toSend);
      } catch (e) {
        console.error("onFinal callback error:", e);
      }
    }, debounceMs) as unknown as number;
  };

  // Handle speech recognition results
  const handleResult = useCallback(
    (text: string, isFinal: boolean) => {
      console.debug("useSTT.handleResult: isFinal=", isFinal, "text=", text);
      if (isFinal) {
        setTranscript((prev) => (prev + " " + text).trim());
        setInterimTranscript("");
        // Debounce final results so short pauses are merged into one send
        try {
          scheduleOnFinal(text);
        } catch (e) {
          console.error("scheduleOnFinal error:", e);
        }
      } else {
        setInterimTranscript(text);
      }
    },
    [onFinal, debounceMs]
  );

  // Start speech recognition
  const start = useCallback(() => {
    console.debug("useSTT.start: starting recognition");
    setIsListening(true);
    startListening(handleResult);
  }, [handleResult]);

  // Stop speech recognition
  const stop = useCallback(() => {
    console.debug("useSTT.stop: stopping recognition");
    stopListening();
    setIsListening(false);
    setInterimTranscript("");
    // flush any pending final immediately when stopping
    try {
      const cb = onFinalRef.current;
      if (pendingFinalRef.current && cb) {
        cb(pendingFinalRef.current.trim());
        pendingFinalRef.current = "";
      }
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    } catch (e) {
      console.error("flush on stop failed", e);
    }
  }, []);

  // Reset transcript
  const reset = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  // Listen for global TTS pause/resume events so the STT hook can be
  // temporarily suspended while TTS playback occurs and resume afterwards.
  useEffect(() => {
    const onPause = () => {
      try {
        if (isListening) {
          pausedByTtsRef.current = true;
          stop();
          console.debug("useSTT: paused due to TTS");
        }
      } catch (e) {
        console.error("useSTT pause handler error", e);
      }
    };

    const onResume = () => {
      try {
        if (pausedByTtsRef.current) {
          pausedByTtsRef.current = false;
          // small delay to allow audio hardware to settle
          setTimeout(() => {
            try {
              start();
              console.debug("useSTT: resumed after TTS");
            } catch (e) {
              console.error("useSTT resume start failed", e);
            }
          }, 80);
        }
      } catch (e) {
        console.error("useSTT resume handler error", e);
      }
    };

    window.addEventListener("vw:tts-pause-stt", onPause);
    window.addEventListener("vw:tts-resume-stt", onResume);
    return () => {
      window.removeEventListener("vw:tts-pause-stt", onPause);
      window.removeEventListener("vw:tts-resume-stt", onResume);
    };
  }, [isListening, start, stop]);

  return {
    start,
    stop,
    reset,
    transcript,
    interimTranscript,
    isListening,
  };
}
