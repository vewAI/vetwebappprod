import { useState, useCallback, useEffect, useRef } from "react";
import {
  startListening,
  stopListening,
  abortListening,
  isSttSuppressed,
  isInDeafMode,
  isGlobalPaused,
  canStartListening,
} from "../services/sttService";

type UseSttOptions = {
  inputDeviceId?: string | null;
};

/**
 * Simple hook for speech-to-text functionality
 */
export function useSTT(
  onFinal?: (text: string) => void,
  debounceMs = 700,
  options: UseSttOptions = {},
) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const startInFlightRef = useRef(false);

  // Device detection for mobile optimizations
  const isMobile =
    typeof window !== "undefined" &&
    /Mobi|Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(
      window.navigator.userAgent,
    );

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
        // SAFETY CHECK: Do not auto-restart if suppressed, in deaf mode, or globally paused
        if (isSttSuppressed() || isInDeafMode() || isGlobalPaused()) {
          console.debug(
            "useSTT: Visibility change ignored - suppressed/deaf/paused",
          );
          return;
        } // Also consult the central service-level guard before starting
        try {
          if (!canStartListening()) {
            console.debug(
              "useSTT: Visibility change start ignored - service guard",
            );
            return;
          }
        } catch (e) {
          // If the helper fails, fall back to the existing checks
        } // Try to restart listening if interrupted
        start();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isMobile, isListening]);

  // Desktop resume handling added after `start` is defined below.

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
      // Merge finals into the existing transcript but avoid duplicating
      // overlapping words that were already shown as interim. For example,
      // if interim emitted "Corporate" and final is "Corporate heart rate",
      // merge to "Corporate heart rate" instead of "Corporate Corporate heart rate".
      const mergeAvoidOverlap = (prev: string, next: string) => {
        if (!prev || !next) return (prev + " " + next).trim();
        const pWords = prev.trim().split(/\s+/);
        const nWords = next.trim().split(/\s+/);
        // Find largest overlap where tail of prev equals head of next
        const maxOverlap = Math.min(pWords.length, nWords.length);
        for (let k = maxOverlap; k > 0; k--) {
          const tail = pWords.slice(-k).join(" ").toLowerCase();
          const head = nWords.slice(0, k).join(" ").toLowerCase();
          if (tail === head) {
            return [...pWords.slice(0, pWords.length - k), ...nWords].join(" ");
          }
        }
        return (prev + " " + next).trim();
      };

      // On any result, clear the health timer and reset fail counts
      try {
        if (listeningHealthTimerRef.current) {
          window.clearTimeout(listeningHealthTimerRef.current as number);
          listeningHealthTimerRef.current = null;
        }
        listeningFailCountRef.current = 0;
      } catch {}

      if (isFinal) {
        setTranscript((prev) => mergeAvoidOverlap(prev, text));
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
    [debounceMs],
  );

  // Start speech recognition
  const listeningHealthTimerRef = useRef<number | null>(null);
  const listeningFailCountRef = useRef<number>(0);

  const clearListeningHealthTimer = () => {
    try {
      if (listeningHealthTimerRef.current) {
        window.clearTimeout(listeningHealthTimerRef.current as number);
        listeningHealthTimerRef.current = null;
      }
    } catch {}
  };

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

        // Start a health-check timer: if we don't see any interim/final results
        // or ambient activity within HEALTH_TIMEOUT_MS, try to restart once.
        // This check can be disabled at build-time by setting
        // NEXT_PUBLIC_ENABLE_STT_HEALTHCHECK=true in the environment. By
        // default it is disabled to avoid unwanted automatic mic shutdowns.
        try {
          // Health checks previously allowed auto-restart/stop behavior when
          // no audio frames were observed. Disable this by default to avoid
          // automatic mic turn-off due to timeout. To re-enable for debugging,
          // set NEXT_PUBLIC_ENABLE_STT_HEALTHCHECK=true in the environment.
          const HEALTH_CHECK_ENABLED = false; // process.env.NEXT_PUBLIC_ENABLE_STT_HEALTHCHECK === 'true';
          if (HEALTH_CHECK_ENABLED) {
            const HEALTH_TIMEOUT_MS = 2500;
            clearListeningHealthTimer();
            listeningHealthTimerRef.current = window.setTimeout(() => {
              try {
                // If we're suppressed or in deaf mode, ignore this check
                const { isInDeafMode } = require("../services/sttService");
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const sttSuppressed =
                  require("../services/sttService").isSttSuppressed();
                if (sttSuppressed || isInDeafMode()) return;

                // No results seen - attempt a soft restart up to 3 times
                listeningFailCountRef.current += 1;
                console.warn(
                  "STT health check: no audio results detected, attempting restart",
                  { attempt: listeningFailCountRef.current },
                );
                // Try a stop/start cycle
                try {
                  stopListening();
                } catch {}
                setIsListening(false);
                window.setTimeout(() => {
                  try {
                    // Attempt to start again
                    start();
                  } catch (e) {
                    console.error("STT health check restart failed", e);
                  }
                }, 400);

                if (listeningFailCountRef.current >= 3) {
                  // Escalate: set an error and give up auto-restarts until user action
                  setError("stt-unresponsive");
                  console.error(
                    "STT health check: unresponsive after 3 attempts, please check microphone settings",
                  );
                  clearListeningHealthTimer();
                }
              } catch (e) {
                // ignore
              }
            }, HEALTH_TIMEOUT_MS) as unknown as number;
          }
        } catch (e) {}

        // If microphone stream is available, create an analyser to measure ambient level
        try {
          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({
              audio: true,
            });
            if (stream) {
              const AudioContextCtor =
                (window as any).AudioContext ||
                (window as any).webkitAudioContext;
              if (AudioContextCtor) {
                if (!audioCtxRef.current)
                  audioCtxRef.current = new AudioContextCtor();
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
                      for (let i = 0; i < buf.length; i++)
                        sum += buf[i] * buf[i];
                      const rms = Math.sqrt(sum / buf.length);
                      // normalize roughly to 0..1 (experimental)
                      const level = Math.min(1, rms * 10);
                      setAmbientLevel(level);

                      // If ambient level rises, clear the health timer and reset counts
                      if (level > 0.01) {
                        listeningFailCountRef.current = 0;
                        clearListeningHealthTimer();
                      }
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

  // Desktop: ensure STT resumes when the page becomes visible again.
  // We intentionally do NOT auto-pause when the page becomes hidden — the
  // app-level logic controls pausing. On visibility -> visible, attempt to
  // restart listening if appropriate (not suppressed, not deaf, service allows).
  useEffect(() => {
    const handleVisibilityResume = () => {
      try {
        if (document.visibilityState !== "visible") return;
        // If already starting/started, nothing to do
        if (startInFlightRef.current) return;
        // Rely on service-level guards for suppression/deaf-mode
        try {
          if (isSttSuppressed()) return;
        } catch {}
        try {
          if (isInDeafMode()) return;
        } catch {}
        try {
          if (!canStartListening()) return;
        } catch {}
        // Small delay to avoid racing with other resume logic
        setTimeout(() => {
          try {
            start();
          } catch (e) {
            // ignore
          }
        }, 100);
      } catch (e) {
        // ignore
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityResume);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityResume);
    };
  }, [start]);

  // Stop speech recognition
  const stop = useCallback(() => {
    stopListening();
    setIsListening(false);
    setInterimTranscript("");
    // clear health timers and reset fail count
    try {
      if (listeningHealthTimerRef.current) {
        window.clearTimeout(listeningHealthTimerRef.current as number);
        listeningHealthTimerRef.current = null;
      }
      listeningFailCountRef.current = 0;
    } catch {}
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
    // clear health timers and reset fail count
    try {
      if (listeningHealthTimerRef.current) {
        window.clearTimeout(listeningHealthTimerRef.current as number);
        listeningHealthTimerRef.current = null;
      }
      listeningFailCountRef.current = 0;
    } catch {}
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
    setDebounceMs: (ms: number) => {
      debounceRef.current = Math.max(100, Number(ms) || 100);
    },
  };
}
