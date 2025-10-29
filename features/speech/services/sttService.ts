// Global recognition instance
type _ResultRow = Record<string, unknown>;
type _ResultList = { [index: number]: unknown };

let recognition: {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  start: () => void;
  stop: () => void;
  onresult?: (e: { results: _ResultList; resultIndex: number }) => void;
} | null = null;

/**
 * Start speech recognition
 * @param callback Function to call with speech recognition results
 */
export function startListening(
  callback: (text: string, isFinal: boolean) => void
): void {
  // Stop any ongoing recognition
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

    // Handle results
    recognition.onresult = (event) => {
      const results = event.results as _ResultList;
      const idx = event.resultIndex ?? 0;
      const row = results[idx] as _ResultRow | undefined;
      const transcript = row
        ? String((row as Record<string, unknown>)["transcript"] ?? "")
        : "";
      const isFinal = Boolean(
        row ? (row as Record<string, unknown>)["isFinal"] : false
      );
      callback(transcript, isFinal);
    };
  }

  // Start listening
  try {
    if (recognition) recognition.start();
  } catch (error) {
    console.error("Error starting speech recognition:", error);
  }
}

/**
 * Stop listening for speech input
 */
export function stopListening(): void {
  if (recognition) {
    try {
      recognition.stop();
    } catch (e) {
      // Ignore errors when stopping
    }
    recognition = null;
  }
}
