import { debugEventBus } from "@/lib/debug-events";

// Global recognition instance
type _ResultRow = Record<string, unknown>;
type _ResultList = { [index: number]: unknown };

// Use a loose typing for the browser SpeechRecognition instance
let recognition: any = null;
let micStream: MediaStream | null = null;
// Whether we should auto-restart recognition when it ends (true while
// the app intends continuous listening). Cleared by stopListening().
let shouldRestart = false;
// Small guard to avoid re-entrant start calls
let starting = false;

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
};

function postProcessTranscript(text: string): string {
  let processed = text;

  // Prefer veterinary sense for ambiguous tokens (e.g., 'other' -> 'udder').
  // Only do these replacements on whole-word boundaries to avoid accidental
  // mangling of unrelated words.
  processed = processed.replace(/\bother\b/gi, "udder");
  processed = processed.replace(/\b(the|my|her|cow's|left|right|front|rear)\s+other\b/gi, "$1 udder");
  processed = processed.replace(/\bother\s+(swelling|edema|pain|heat)\b/gi, "udder $1");

  // If the recognized text contains common-language tokens that map to
  // veterinary terms, apply those corrections.
  for (const [wrong, right] of Object.entries(CORRECTIONS)) {
    const escaped = wrong.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp("\\b" + escaped + "\\b", "gi");
    processed = processed.replace(pattern, right);
  }

  // Encourage explicit veterinary terms if the transcript includes close
  // ambiguities: e.g., if user said 'other' or similar ambiguous word, we've
  // already mapped it; additionally, if the transcript contains many generic
  // terms but no vet terms, prefer the vet variants where a single-word swap
  // is safe. This loop is intentionally conservative.
  for (const vetWord of VET_PREFERRED) {
    const vetPattern = new RegExp("\\b" + vetWord + "\\b", "i");
    // if transcript already contains the vet word, nothing to do
    if (vetPattern.test(processed)) continue;
    // handle a few known ambiguous mappings (lightweight):
    // 'other' was handled; add more patterns here as needed in future.
  }

  return processed;
}

export async function startListening(
  callback: (text: string, isFinal: boolean) => void,
  options?: StartListeningOptions
): Promise<boolean> {
  debugEventBus.emitEvent('info', 'STT', 'Starting speech recognition');
  // Stop any ongoing recognition to ensure a fresh instance
  stopListening();

  // Check browser support
  const SpeechRecognition =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.error("Speech recognition not supported");
    return false;
  }

  // Create and configure recognition
  recognition = new (SpeechRecognition as any)();
  shouldRestart = true;

  // Try to add grammar list if supported
  const SpeechGrammarList = (window as any).SpeechGrammarList || (window as any).webkitSpeechGrammarList;
  if (SpeechGrammarList) {
    const speechRecognitionList = new SpeechGrammarList();
    const grammar = '#JSGF V1.0; grammar veterinary; public <term> = udder | teat | mastitis | bovine | ketones | creatinine | palpate | auscultate ;';
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
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: normalizedDeviceId
          ? { deviceId: { exact: normalizedDeviceId } }
          : true,
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
    };

    recognition.onerror = (event: any) => {
      debugEventBus.emitEvent('error', 'STT', `Speech recognition error: ${event.error}`, { error: event.error });
    };

    // Handle results: aggregate interim and final transcripts
    recognition.onresult = (event: any) => {
      try {
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
        if (starting) return;
        try {
          starting = true;
          recognition.start();
        } catch (e) {
          // ignore restart errors
        } finally {
          starting = false;
        }
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
