import { useState, useCallback, useEffect } from 'react';
import { startListening, stopListening } from '../services/sttService';

/**
 * Simple hook for speech-to-text functionality
 */
export function useSTT() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  
  // Handle speech recognition results
  const handleResult = useCallback((text: string, isFinal: boolean) => {
    if (isFinal) {
      setTranscript(prev => (prev + ' ' + text).trim());
      setInterimTranscript('');
    } else {
      setInterimTranscript(text);
    }
  }, []);
  
  // Start speech recognition
  const start = useCallback(() => {
    setIsListening(true);
    startListening(handleResult);
  }, [handleResult]);
  
  // Stop speech recognition
  const stop = useCallback(() => {
    stopListening();
    setIsListening(false);
    setInterimTranscript('');
  }, []);
  
  // Reset transcript
  const reset = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
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
    reset,
    transcript,
    interimTranscript,
    isListening
  };
}
