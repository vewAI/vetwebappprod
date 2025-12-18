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

// Common veterinary homophone corrections
const CORRECTIONS: Record<string, string> = {
  " other ": " udder ",
  " udder ": " udder ", // Keep correct
  "utter": "udder",
  "ketones": "ketones",
  "keytones": "ketones",
  "creatine": "creatinine",
  "creating": "creatinine",
};

function postProcessTranscript(text: string): string {
  let processed = text;
  
  // Context-aware replacements for "other" -> "udder"
  // If the text contains bovine-related terms, be more aggressive
  const isBovineContext = /cow|bovine|calf|milk|teat|mastitis|quarter/i.test(text);
  
  if (isBovineContext) {
    processed = processed.replace(/\bother\b/gi, "udder");
  } else {
    // Specific phrases where "other" is likely "udder"
    processed = processed.replace(/\b(the|my|her|cow's|left|right|front|rear)\s+other\b/gi, "$1 udder");
    processed = processed.replace(/\bother\s+(swelling|edema|pain|heat)\b/gi, "udder $1");
  }

  // General corrections
  for (const [wrong, right] of Object.entries(CORRECTIONS)) {
    if (wrong.trim() === "other") continue; // Handled above
    const pattern = new RegExp(`\\b${wrong}\\b`, "gi");
    processed = processed.replace(pattern, right);
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
