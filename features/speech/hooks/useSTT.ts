import { useState, useCallback, useEffect, useRef } from "react";
import { startListening, stopListening, abortListening } from "../services/sttService";

type UseSttOptions = {
  inputDeviceId?: string | null;
};

/**
 * Simple hook for speech-to-text functionality
 */
export function useSTT(
  onFinal?: (text: string) => void,
  debounceMs = 700,
  options: UseSttOptions = {}
) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const startInFlightRef = useRef(false);

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
    [debounceMs]
  );

  // Start speech recognition
  const start = useCallback(() => {
    if (startInFlightRef.current) {
      return;
    }
    startInFlightRef.current = true;
    (async () => {
      try {
        const ok = await startListening(handleResult, {
          deviceId: options?.inputDeviceId ?? undefined,
        });
        setIsListening(Boolean(ok));
      } catch (e) {
        console.error("startListening failed:", e);
        setIsListening(false);
      } finally {
        startInFlightRef.current = false;
      }
    })();
  }, [handleResult, options?.inputDeviceId]);

  // Stop speech recognition
  const stop = useCallback(() => {
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

  // Abort speech recognition (discard pending)
  const abort = useCallback(() => {
    abortListening();
    setIsListening(false);
    setInterimTranscript("");
    pendingFinalRef.current = "";
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
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

  return {
    start,
    stop,
    abort,
    reset,
    transcript,
    interimTranscript,
    isListening,
  };
}
