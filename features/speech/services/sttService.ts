import { debugEventBus } from "@/lib/debug-events-fixed";

// Global recognition instance
type _ResultRow = Record<string, unknown>;
type _ResultList = { [index: number]: unknown };

// Use a loose typing for the browser SpeechRecognition instance
let recognition: any = null;
let micStream: MediaStream | null = null;
// Whether we should auto-restart recognition when it ends (true while
// the app intends continuous listening). Cleared by stopListening().
let shouldRestart = false;
// When true, suppress any attempts to start recognition (used while TTS plays)
let sttSuppressed = false;
// Timestamp (ms) until which starts are suppressed even after clearing the explicit flag.
let sttSuppressedUntil = 0;
const STT_SUPPRESSION_COOLDOWN_MS = 800; // cooldown after suppression is lifted

// DEAF WINDOW: Timestamp (ms) until which ALL recognition results are IGNORED.
// This is the nuclear option - even if recognition is active, we discard results.
// This prevents the mic from "hearing" TTS audio no matter what.
let deafUntil = 0;
const DEAF_WINDOW_AFTER_TTS_MS = 1500; // ignore all results for 1.5s after TTS ends

// Global pause state - when true, STT should not auto-start on visibility changes
let globalPaused = false;
// Small guard to avoid re-entrant start calls
let starting = false;
// Restart protection: avoid infinite start/stop loops by limiting attempts
let restartAttempts = 0;
const MAX_RESTARTS = 6; // after this many rapid restarts, stop and surface a warning

// Global error handler type
type ErrorHandler = (error: string) => void;
let globalOnError: ErrorHandler | null = null;

export function registerOnError(handler: ErrorHandler) {
  globalOnError = handler;
}

/**
 * Start speech recognition
 * @param callback Function to call with speech recognition results
 */
type StartListeningOptions = {
  deviceId?: string;
};

// Veterinary-preferred vocabulary: when the recognizer returns ambiguous
// or common-language words, prefer these domain terms where reasonable.
const VET_PREFERRED = [
  "udder",
  "teat",
  "mastitis",
  "bovine",
  "borborygmi",
  "ketones",
  "creatinine",
  "palpate",
  "auscultate",
  "rumen",
  "abomasum",
  "ileum",
  "ilium",
  "tachycardia",
  "bradycardia",
  "pyrexia",
];

// Common veterinary homophone / simple corrections. Keys are the
// raw recognized token (lowercased) and values are the preferred
// veterinary term.
const CORRECTIONS: Record<string, string> = {
  "utter": "udder",
  "keytones": "ketones",
  "creatine": "creatinine",
  "creating": "creatinine",
  "borborigmi": "borborygmi",
  "borborygmi": "borborygmi",
  // Common mis-hearings of 'rumen'
  "roman": "rumen",
  // User may say 'nifa' which should be the acronym 'NEFA' (Non-Esterified Fatty Acids)
  "nifa": "NEFA",
  // Common mis-hearing of 'rectal' as 'rental'
  "rental": "rectal",
  // Short-hand mis-hearings for basophils
  "baseball": "basophils",
};

// Phrase-level corrections for multi-word mis-transcriptions.
const PHRASE_CORRECTIONS: Record<string, string> = {
  "kitchen buddies": "ketone bodies",
  "kitchen buddy": "ketone body",
  "old findingd": "all findings",
  "old findings": "all findings",
  "give me old findings": "give me all findings",
  // Mis-transcription where 'Roman' is heard instead of 'rumen'
  "roman turnover": "rumen turnover",
  "room in turnover": "rumen turnover",
  "room and turnover": "rumen turnover",
  "breathing rights": "breathing rate",
};

// Common mis-hearing where users say something that sounds like 'ask quotation'
// but actually mean 'auscultation'.
PHRASE_CORRECTIONS["ask quotation"] = "auscultation";
// Common mis-hearing: 'baseball fields' -> 'basophils'
PHRASE_CORRECTIONS["baseball fields"] = "basophils";
PHRASE_CORRECTIONS["baseball field"] = "basophils";

function postProcessTranscript(text: string): string {
  let processed = text;
  // Collapse very short immediate repeats like "okay don't okay don't don't worry"
  // by removing adjacent repeated n-grams for n=1..4.
  const collapseShortRepeats = (s: string) => {
    try {
      const words = s.trim().split(/\s+/);
      if (words.length < 3) return s;
      // Check window sizes from longest to shortest to prefer longer phrase matches
      for (let n = Math.min(4, Math.floor(words.length / 2)); n >= 1; n--) {
        let i = 0;
        const out: string[] = [];
        while (i < words.length) {
          // Look ahead for immediate repeat of next n words
          const chunk = words.slice(i, i + n).join(" ");
          const next = words.slice(i + n, i + 2 * n).join(" ");
          if (chunk && next && chunk.toLowerCase() === next.toLowerCase()) {
            // Skip the repeated chunk once
            out.push(chunk);
            i += 2 * n;
            // Skip any additional immediate repeats of the same chunk
            while (i + n <= words.length && words.slice(i, i + n).join(" ").toLowerCase() === chunk.toLowerCase()) {
              i += n;
            }
          } else {
            out.push(words[i]);
            i += 1;
          }
        }
        const candidate = out.join(" ");
        if (candidate.split(/\s+/).length < words.length) return candidate;
      }
      return s;
    } catch (e) {
      return s;
    }
  };

  processed = collapseShortRepeats(processed);
  const substitutions: Array<{ from: string; to: string }> = [];

  // Prefer veterinary sense for ambiguous tokens (e.g., 'other' -> 'udder').
  // Only do these replacements on whole-word boundaries to avoid accidental
  // mangling of unrelated words. Record substitutions for telemetry.
  const beforeOther = processed;
  processed = processed.replace(/\bother\b/gi, "udder");
  if (processed !== beforeOther) substitutions.push({ from: "other", to: "udder" });
  const beforeOther2 = processed;
  processed = processed.replace(/\b(the|my|her|cow's|left|right|front|rear)\s+other\b/gi, "$1 udder");
  if (processed !== beforeOther2) substitutions.push({ from: "other (positional)", to: "udder" });
  const beforeOther3 = processed;
  processed = processed.replace(/\bother\s+(swelling|edema|pain|heat)\b/gi, "udder $1");
  if (processed !== beforeOther3) substitutions.push({ from: "other <symptom>", to: "udder <symptom>" });

  // If the recognized text contains common-language tokens that map to
  // veterinary terms, apply those corrections.
  // First apply phrase-level corrections to handle multi-word mis-hearings
  for (const [wrongPhrase, rightPhrase] of Object.entries(PHRASE_CORRECTIONS)) {
    const escaped = wrongPhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp("\\b" + escaped + "\\b", "gi");
    const before = processed;
    const after = processed.replace(pattern, rightPhrase);
    if (after !== before) substitutions.push({ from: wrongPhrase, to: rightPhrase });
    processed = after;
  }

  for (const [wrong, right] of Object.entries(CORRECTIONS)) {
    const escaped = wrong.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp("\\b" + escaped + "\\b", "gi");
    const before = processed;
    const after = processed.replace(pattern, right);
    if (after !== before) substitutions.push({ from: wrong, to: right });
    processed = after;
  }

  // Encourage explicit veterinary terms if the transcript includes close
  // ambiguities: e.g., if user said 'other' or similar ambiguous word, we've
  // already mapped it; additionally, if the transcript contains many generic
  // terms but no vet terms, prefer the vet variants where a single-word swap
  // is safe. This loop is intentionally conservative.
  for (const vetWord of VET_PREFERRED) {
    const vetPattern = new RegExp("\\b" + vetWord + "\\b", "i");
    if (vetPattern.test(processed)) continue;
  }

  // Emit lightweight telemetry so we can tune corrections without leaking
  // user audio/text. This uses the existing debugEventBus.
  try {
    if (substitutions.length > 0) {
      // Emit names only; do not include full transcripts to avoid PII leakage.
      (debugEventBus as any).emitEvent?.('info', 'STT', 'Applied vet substitutions', { substitutions });
    }
  } catch {
    // ignore telemetry failures
  }

  return processed;
}

export const isSpeechRecognitionSupported = (): boolean => {
  if (typeof window === "undefined") return false;
  return !!(
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  );
};

export async function startListening(
  callback: (text: string, isFinal: boolean) => void,
  options?: StartListeningOptions
): Promise<boolean> {
  debugEventBus.emitEvent('info', 'STT', 'Starting speech recognition');
  // Respect global suppression flag (set when playing TTS) to avoid
  // starting the microphone while assistant audio is playing.
  // Explicit suppression or cooldown period prevents starting
  if (sttSuppressed || Date.now() < sttSuppressedUntil) {
    debugEventBus.emitEvent('info', 'STT', 'Start suppressed by global flag');
    return false;
  }
  // Stop any ongoing recognition to ensure a fresh instance
  stopListening();

  // Check browser support
  if (!isSpeechRecognitionSupported()) {
    console.warn("Speech recognition not supported in this browser");
    debugEventBus.emitEvent('warning', 'STT', 'Speech recognition not supported');
    return false;
  }

  const SpeechRecognition =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;

  // Create and configure recognition
  recognition = new (SpeechRecognition as any)();
  shouldRestart = true;

  // Try to add grammar list if supported
  const SpeechGrammarList = (window as any).SpeechGrammarList || (window as any).webkitSpeechGrammarList;
  if (SpeechGrammarList) {
    const speechRecognitionList = new SpeechGrammarList();
    const grammar = '#JSGF V1.0; grammar veterinary; public <term> = udder | teat | mastitis | bovine | ketones | creatinine | palpate | auscultate | borborygmi | borborygmus ;';
    speechRecognitionList.addFromString(grammar, 1);
    recognition.grammars = speechRecognitionList;
  }

  const normalizedDeviceId = (() => {
    const id = options?.deviceId?.trim();
    if (!id || id === "default" || id === "communications") {
      return undefined;
    }
    return id;
  })();

  if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
    try {
      // Apply noise suppression and echo cancellation constraints to help
      // filter out background noise and other people talking nearby.
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        ...(normalizedDeviceId ? { deviceId: { exact: normalizedDeviceId } } : {}),
      };
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      });
    } catch (err) {
      console.warn("Microphone access failed; falling back to default device", err);
      micStream = null;
    }
  }

  if (recognition) {
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      debugEventBus.emitEvent('success', 'STT', 'Speech recognition started');
      // reset restart attempts on successful start
      restartAttempts = 0;
    };

    recognition.onerror = (event: any) => {
      debugEventBus.emitEvent('error', 'STT', `Speech recognition error: ${event?.error}`, { error: event?.error });
      const errCode = String(event?.error || "").toLowerCase();

      // Notify the hook about the specific error
      if (globalOnError) {
        globalOnError(errCode);
      }

      // For some errors we should not attempt to automatically restart
      const fatalErrors = ["not-allowed", "service-not-allowed", "security", "microphone-disabled", "network"];
      try {
        if (fatalErrors.some((e) => errCode.includes(e))) {
          shouldRestart = false;
          debugEventBus.emitEvent('warning', 'STT', `Speech recognition fatal error, will not auto-restart: ${errCode}`);
        }
      } catch {
        // ignore
      }
    };

    // Handle results: aggregate interim and final transcripts
    recognition.onresult = (event: any) => {
      try {
        // DEAF MODE CHECK: If we're in deaf mode, completely ignore ALL results.
        // This is the bulletproof way to prevent mic from "hearing" TTS.
        if (Date.now() < deafUntil) {
          debugEventBus.emitEvent('info', 'STT', 'Ignoring STT result - in deaf mode (TTS playing or recently ended)');
          return;
        }
        
        let interim = "";
        let finalT = "";
        // event.results is a SpeechRecognitionResultList
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript =
            result[0] && result[0].transcript
              ? String(result[0].transcript)
              : "";
          if (result.isFinal) {
            finalT += transcript + " ";
          } else {
            interim += transcript + " ";
          }
        }

        if (interim.trim()) callback(postProcessTranscript(interim.trim()), false);
        if (finalT.trim()) callback(postProcessTranscript(finalT.trim()), true);
      } catch (e) {
        console.error("STT parse error", e);
      }
    };

    // Some browsers stop recognition unexpectedly; restart only when we
    // expect continuous listening (shouldRestart). Guard against calling
    // start while a start is already in progress.
    recognition.onend = () => {
      debugEventBus.emitEvent('info', 'STT', 'Speech recognition ended');
      try {
          if (!shouldRestart) return;
          // If suppression is active or we're in the cooldown window, do not auto-restart
          if (sttSuppressed || Date.now() < sttSuppressedUntil) return;
        if (starting) return;

        // Protect against tight restart loops: allow a bounded number of restarts
        if (restartAttempts >= MAX_RESTARTS) {
          shouldRestart = false;
          debugEventBus.emitEvent('warning', 'STT', `Max restart attempts reached (${MAX_RESTARTS}). Auto-restart disabled.`);
          return;
        }

        // Exponential backoff before restarting
        const delay = Math.min(1000 * Math.pow(2, restartAttempts), 10000);
        restartAttempts += 1;
        setTimeout(() => {
          try {
            starting = true;
            recognition.start();
          } catch (e) {
            debugEventBus.emitEvent('error', 'STT', 'Failed to restart speech recognition', { error: String(e) });
          } finally {
            starting = false;
          }
        }, delay);
      } catch (e) {
        // ignore
      }
    };
  }

  // Start listening
  try {
    if (recognition) {
      if (!starting) {
        starting = true;
        recognition.start();
        starting = false;
      }
      return true;
    }
  } catch (error) {
    console.error("Error starting speech recognition:", error);
    if (micStream) {
      try {
        micStream.getTracks().forEach((track) => track.stop());
      } catch {
        // ignore
      }
      micStream = null;
    }
    recognition = null;
  }
  return false;
}

/**
 * Stop listening for speech input
 */
export function stopListening(): void {
  // Prevent the onend handler from auto-restarting
  shouldRestart = false;
  starting = false;
  if (recognition) {
    try {
      recognition.stop();
    } catch (e) {
      // Ignore errors when stopping
    }
    recognition = null;
  }
  if (micStream) {
    try {
      micStream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      console.warn("Failed to stop microphone stream", err);
    }
    micStream = null;
  }
}

/**
 * Abort listening immediately (discards any buffered audio)
 */
export function abortListening(): void {
  shouldRestart = false;
  starting = false;
  if (recognition) {
    try {
      recognition.abort();
    } catch (e) {
      // Ignore errors
    }
    recognition = null;
  }
  if (micStream) {
    try {
      micStream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      console.warn("Failed to stop microphone stream", err);
    }
    micStream = null;
  }
}

/**
 * Temporarily suppress STT start/restart attempts (used while playing TTS).
 * When `true`, calls to `startListening` will no-op and auto-restart onend
 * will be prevented. When clearing suppression, callers may choose to
 * restart listening as appropriate.
 */
export function setSttSuppressed(val: boolean, skipCooldown = false) {
  sttSuppressed = Boolean(val);
  if (sttSuppressed) {
    // Ensure any active recognition is stopped immediately
    try {
      shouldRestart = false;
      if (recognition) {
        recognition.abort();
      }
    } catch {}
    // Don't extend cooldown here; it causes timing issues with resume
  }
  else {
    // When clearing suppression, also clear the timestamp-based cooldown.
    // If skipCooldown is true, clear immediately; otherwise add a short buffer.
    try {
      sttSuppressedUntil = skipCooldown ? 0 : (Date.now() + STT_SUPPRESSION_COOLDOWN_MS);
    } catch {}
  }
}

export function isSttSuppressed() {
  return Boolean(sttSuppressed);
}

/**
 * Enter "deaf mode" - all recognition results will be discarded until the window ends.
 * Call this when TTS starts playing to completely ignore any mic pickup.
 */
export function enterDeafMode(durationMs = 0) {
  // If durationMs is 0, we're starting TTS - set a far future timestamp
  // The actual end will be set when exitDeafMode is called
  deafUntil = durationMs > 0 ? Date.now() + durationMs : Number.MAX_SAFE_INTEGER;
  debugEventBus.emitEvent('info', 'STT', `Entered deaf mode until ${deafUntil}`);
}

/**
 * Exit deaf mode after TTS ends. Adds a buffer period to catch any trailing audio.
 */
export function exitDeafMode() {
  deafUntil = Date.now() + DEAF_WINDOW_AFTER_TTS_MS;
  debugEventBus.emitEvent('info', 'STT', `Exiting deaf mode, deaf until ${deafUntil} (${DEAF_WINDOW_AFTER_TTS_MS}ms buffer)`);
}

/**
 * Check if we're currently in deaf mode (should ignore all results)
 */
export function isInDeafMode(): boolean {
  return Date.now() < deafUntil;
}

/**
 * Set global pause state - prevents auto-restart on visibility changes
 */
export function setGlobalPaused(paused: boolean) {
  globalPaused = Boolean(paused);
  debugEventBus.emitEvent('info', 'STT', `Global pause set to ${globalPaused}`);
}

/**
 * Check if globally paused
 */
export function isGlobalPaused(): boolean {
  return globalPaused;
}
