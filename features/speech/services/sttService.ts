// Global recognition instance
type _ResultRow = Record<string, unknown>;
type _ResultList = { [index: number]: unknown };

// Use a loose typing for the browser SpeechRecognition instance
let recognition: any = null;
// Whether the service should attempt to automatically restart recognition
// when the underlying recognition instance ends. This prevents uncontrolled
// restarts when the app intentionally stops listening.
let shouldAutoRestart = false;

/**
 * Allow callers to enable/disable automatic restart behaviour.
 * When disabled, recognition.onend will not attempt to restart.
 */
export function setAutoRestart(enabled: boolean) {
  shouldAutoRestart = Boolean(enabled);
  try {
    console.debug("sttService.setAutoRestart:", shouldAutoRestart);
  } catch (e) {}
}

/**
 * Start speech recognition
 * @param callback Function to call with speech recognition results
 */
export function startListening(
  callback: (text: string, isFinal: boolean) => void
): void {
  // Stop any ongoing recognition (ensure previous instance won't auto-restart)
  stopListening();

  // Check browser support
  const SpeechRecognition =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.error("Speech recognition not supported");
    return;
  }

  // Create and configure recognition
  recognition = new (SpeechRecognition as any)();
  if (recognition) {
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    // Handle results: aggregate interim and final transcripts
    recognition.onresult = (event: any) => {
      try {
        // Debug: show number of result entries
        console.debug(
          "sttService.onresult: resultIndex=",
          event.resultIndex,
          "resultsLength=",
          event.results?.length
        );
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

    // Some browsers stop recognition unexpectedly; restart only when
    // we explicitly asked for auto-restart. This avoids restarting after
    // the app has called stopListening().
    recognition.onend = () => {
      try {
        console.debug(
          "sttService.onend: recognition ended; shouldAutoRestart=",
          shouldAutoRestart
        );
        if (shouldAutoRestart && recognition) {
          try {
            recognition.start();
            console.debug("sttService.onend: restarted recognition");
          } catch (e) {
            console.error("sttService.onend restart error", e);
          }
        }
      } catch (e) {
        console.error("sttService.onend error", e);
      }
    };
  }

  // Start listening
  try {
    if (recognition) {
      shouldAutoRestart = true;
      recognition.start();
      console.debug("sttService.startListening: recognition started");
    }
  } catch (error) {
    console.error("Error starting speech recognition:", error);
  }
}

/**
 * Stop listening for speech input
 */
export function stopListening(): void {
  // Prevent the onend handler from restarting the instance, then stop it.
  shouldAutoRestart = false;
  if (recognition) {
    try {
      recognition.stop();
      console.debug("sttService.stopListening: recognition.stop() called");
    } catch (e) {
      // Ignore errors when stopping
    }
    recognition = null;
  }
}
