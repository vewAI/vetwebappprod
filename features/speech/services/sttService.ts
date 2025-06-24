// Global recognition instance
let recognition: any = null;

/**
 * Start speech recognition
 * @param callback Function to call with speech recognition results
 */
export function startListening(callback: (text: string, isFinal: boolean) => void): void {
  // Stop any ongoing recognition
  stopListening();
  
  // Check browser support
  const SpeechRecognition = (window as any).SpeechRecognition || 
                           (window as any).webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.error('Speech recognition not supported');
    return;
  }
  
  // Create and configure recognition
  recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.continuous = true;
  recognition.interimResults = true;
  
  // Handle results
  recognition.onresult = (event: any) => {
    const result = event.results[event.resultIndex];
    callback(result[0].transcript, result.isFinal);
  };
  
  // Start listening
  try {
    recognition.start();
  } catch (error) {
    console.error('Error starting speech recognition:', error);
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
