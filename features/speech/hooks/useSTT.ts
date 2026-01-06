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

  // Device detection for mobile optimizations
  const isMobile = typeof window !== "undefined" && /Mobi|Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(window.navigator.userAgent);

  // Buffer for final chunks and debounce timer to merge nearby final events
  const pendingFinalRef = useRef<string>("");
  const debounceRef = useRef<number>(debounceMs);
  const [ambientLevel, setAmbientLevel] = useState<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const analyserIntervalRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  // Keep a ref to the latest onFinal so scheduled timers always call the
  // newest callback (prevents stale-closure bugs when parent state like
  // `voiceMode` is captured in the callback).
  const onFinalRef = useRef(onFinal);

  // Keep the ref up to date when onFinal changes
  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  // Mobile-specific: auto-restart STT if interrupted
  useEffect(() => {
    if (!isMobile || !isListening) return;
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && !isListening) {
        // Try to restart listening if interrupted
        start();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isMobile, isListening]);

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
    }, debounceRef.current) as unknown as number;
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
        // If microphone stream is available, create an analyser to measure ambient level
        try {
          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (stream) {
              const AudioContextCtor = (window as any).AudioContext || (window as any).webkitAudioContext;
              if (AudioContextCtor) {
                if (!audioCtxRef.current) audioCtxRef.current = new AudioContextCtor();
                const ctx = audioCtxRef.current!;
                const src = ctx.createMediaStreamSource(stream);
                const analyser = ctx.createAnalyser();
                analyser.fftSize = 2048;
                src.connect(analyser);
                analyserRef.current = analyser;
                // poll RMS
                if (analyserIntervalRef.current === null) {
                  analyserIntervalRef.current = window.setInterval(() => {
                    try {
                      const buf = new Float32Array(analyser.frequencyBinCount);
                      analyser.getFloatTimeDomainData(buf);
                      let sum = 0;
                      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
                      const rms = Math.sqrt(sum / buf.length);
                      // normalize roughly to 0..1 (experimental)
                      const level = Math.min(1, rms * 10);
                      setAmbientLevel(level);
                    } catch (e) {
                      // ignore
                    }
                  }, 250) as unknown as number;
                }
              }
            }
          }
        } catch (e) {
          // non-fatal: analyser optional
        }
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
      if (analyserIntervalRef.current) {
        window.clearInterval(analyserIntervalRef.current);
        analyserIntervalRef.current = null;
      }
      if (audioCtxRef.current) {
        try {
          audioCtxRef.current.close();
        } catch {}
        audioCtxRef.current = null;
      }
    };
  }, []);

  // Listen for global STT errors
  const [error, setError] = useState<string | null>(null);

  // Register the global error handler once on mount
  useEffect(() => {
    // Dynamically import to avoid cycle if needed, or just import
    const { registerOnError } = require("../services/sttService");
    registerOnError((errCode: string) => {
      console.warn("STT Error received in hook:", errCode);
      setError(errCode);
      setIsListening(false);
    });
  }, []);

  return {
    start,
    stop,
    abort,
    reset,
    transcript,
    interimTranscript,
    isListening,
    error, // Exposed to UI
    ambientLevel,
    setDebounceMs: (ms: number) => { debounceRef.current = Math.max(100, Number(ms) || 100); }
  };
}
