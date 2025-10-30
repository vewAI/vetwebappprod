import { useEffect, useRef, useState } from "react";

/**
 * useTTS — small wrapper around the Web Speech Synthesis API
 * Returns availability, speaking state, and speak/cancel helpers.
 */
export function useTTS() {
  const [available, setAvailable] = useState<boolean>(
    typeof window !== "undefined" && "speechSynthesis" in window
  );
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (!available) return;

    const onEnd = () => setIsSpeaking(false);
    const onError = () => setIsSpeaking(false);

    // Clean up on unmount
    return () => {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {
        // ignore
      }
      setIsSpeaking(false);
      utterRef.current = null;
    };
  }, [available]);

  const speak = (text: string, lang = "en-US") => {
    if (!available || !text) return;
    try {
      // Cancel any existing speech
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.onend = () => setIsSpeaking(false);
      u.onerror = () => setIsSpeaking(false);
      utterRef.current = u;
      setIsSpeaking(true);
      window.speechSynthesis.speak(u);
    } catch (e) {
      console.error("TTS speak failed:", e);
      setIsSpeaking(false);
    }
  };

  // speakAsync — returns a promise that resolves when speech ends (or rejects on error)
  const speakAsync = (text: string, lang = "en-US") => {
    if (!available || !text)
      return Promise.reject(new Error("TTS not available or empty text"));
    return new Promise<void>((resolve, reject) => {
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang;
        u.onend = () => {
          setIsSpeaking(false);
          resolve();
        };
        u.onerror = (e) => {
          setIsSpeaking(false);
          reject(e ?? new Error("TTS error"));
        };
        utterRef.current = u;
        setIsSpeaking(true);
        window.speechSynthesis.speak(u);
      } catch (e) {
        setIsSpeaking(false);
        reject(e);
      }
    });
  };

  const cancel = () => {
    if (!available) return;
    try {
      window.speechSynthesis.cancel();
    } catch (e) {
      // ignore
    }
    setIsSpeaking(false);
    utterRef.current = null;
  };

  return { available, isSpeaking, speak, speakAsync, cancel } as const;
}
