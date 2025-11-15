// Global recognition instance
type _ResultRow = Record<string, unknown>;
type _ResultList = { [index: number]: unknown };

// Use a loose typing for the browser SpeechRecognition instance
let recognition: any = null;
// Whether we should auto-restart recognition when it ends (true while
// the app intends continuous listening). Cleared by stopListening().
let shouldRestart = false;
// Small guard to avoid re-entrant start calls
let starting = false;

/**
 * Start speech recognition
 * @param callback Function to call with speech recognition results
 */
export function startListening(
  callback: (text: string, isFinal: boolean) => void
): boolean {
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

  if (recognition) {
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

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

        if (interim.trim()) callback(interim.trim(), false);
        if (finalT.trim()) callback(finalT.trim(), true);
      } catch (e) {
        console.error("STT parse error", e);
      }
    };

    // Some browsers stop recognition unexpectedly; restart only when we
    // expect continuous listening (shouldRestart). Guard against calling
    // start while a start is already in progress.
    recognition.onend = () => {
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
}
