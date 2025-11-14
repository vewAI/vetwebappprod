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
      // Notify listeners that TTS is about to start and STT should pause
      try {
        window.dispatchEvent(new CustomEvent("vw:tts-pause-stt"));
        window.dispatchEvent(
          new CustomEvent("vw:tts-start", { detail: { source: "webspeech" } })
        );
      } catch (e) {}
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.onend = () => {
        setIsSpeaking(false);
        try {
          window.dispatchEvent(
            new CustomEvent("vw:tts-end", { detail: { source: "webspeech" } })
          );
          window.dispatchEvent(new CustomEvent("vw:tts-resume-stt"));
        } catch (e) {}
      };
      u.onerror = () => {
        setIsSpeaking(false);
        try {
          window.dispatchEvent(
            new CustomEvent("vw:tts-end", {
              detail: { source: "webspeech", error: true },
            })
          );
          window.dispatchEvent(new CustomEvent("vw:tts-resume-stt"));
        } catch (e) {}
      };
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
        try {
          window.dispatchEvent(new CustomEvent("vw:tts-pause-stt"));
          window.dispatchEvent(
            new CustomEvent("vw:tts-start", { detail: { source: "webspeech" } })
          );
        } catch (e) {}
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang;
        u.onend = () => {
          setIsSpeaking(false);
          try {
            window.dispatchEvent(
              new CustomEvent("vw:tts-end", { detail: { source: "webspeech" } })
            );
            window.dispatchEvent(new CustomEvent("vw:tts-resume-stt"));
          } catch (e) {}
          resolve();
        };
        u.onerror = (e) => {
          setIsSpeaking(false);
          try {
            window.dispatchEvent(
              new CustomEvent("vw:tts-end", {
                detail: { source: "webspeech", error: true },
              })
            );
            window.dispatchEvent(new CustomEvent("vw:tts-resume-stt"));
          } catch (err) {}
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
      try {
        window.dispatchEvent(
          new CustomEvent("vw:tts-end", {
            detail: { source: "webspeech", cancelled: true },
          })
        );
        window.dispatchEvent(new CustomEvent("vw:tts-resume-stt"));
      } catch (e) {}
    } catch (e) {
      // ignore
    }
    setIsSpeaking(false);
    utterRef.current = null;
  };

  return { available, isSpeaking, speak, speakAsync, cancel } as const;
}
