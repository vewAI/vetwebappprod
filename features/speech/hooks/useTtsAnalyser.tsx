"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type TtsAnalyserContextValue = {
  amplitude: number;
};

const TtsAnalyserContext = createContext<TtsAnalyserContextValue>({
  amplitude: 0,
});

export const TtsAnalyserProvider: React.FC<React.PropsWithChildren<{}>> = ({
  children,
}) => {
  const [amplitude, setAmplitude] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    function onStart(e: Event) {
      try {
        const detail = (e as CustomEvent).detail as
          | { audio?: HTMLAudioElement }
          | undefined;
        const el = detail?.audio;
        if (!el) return;

        // Clean up old
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        try {
          if (sourceRef.current) {
            sourceRef.current.disconnect();
            sourceRef.current = null;
          }
        } catch (e) {}
        try {
          if (analyserRef.current) {
            analyserRef.current.disconnect();
            analyserRef.current = null;
          }
        } catch (e) {}

        const AudioCtx =
          window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaElementSource(el);
        sourceRef.current = source;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        analyserRef.current = analyser;
        source.connect(analyser);
        analyser.connect(ctx.destination);

        const data = new Float32Array(analyser.fftSize);

        const tick = () => {
          try {
            analyser.getFloatTimeDomainData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i++) {
              const v = data[i];
              sum += v * v;
            }
            const rms = Math.sqrt(sum / data.length);
            // Normalize RMS to 0..1 (typical human speech ~0.02-0.2)
            const norm = Math.min(1, rms * 10);
            setAmplitude((prev) => {
              // Smooth with simple lerp
              return prev * 0.85 + norm * 0.15;
            });
          } catch (e) {
            // ignore
          }
          rafRef.current = requestAnimationFrame(tick);
        };

        // Start animation loop
        rafRef.current = requestAnimationFrame(tick);

        // Stop when audio ends
        const onEnded = () => {
          setTimeout(() => setAmplitude(0), 50);
          if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }
          try {
            if (sourceRef.current) {
              sourceRef.current.disconnect();
              sourceRef.current = null;
            }
            if (analyserRef.current) {
              analyserRef.current.disconnect();
              analyserRef.current = null;
            }
          } catch (e) {}
          try {
            if (audioCtxRef.current) {
              audioCtxRef.current.close();
            }
          } catch (e) {}
          audioCtxRef.current = null;
        };

        el.addEventListener("ended", onEnded);
        el.addEventListener("pause", onEnded);
        // In case the element is already playing, ensure tick runs

        // Clean up listeners when audio element is removed or new starts
        const cleanupElement = () => {
          try {
            el.removeEventListener("ended", onEnded);
            el.removeEventListener("pause", onEnded);
          } catch (e) {}
        };

        // When the audio element is garbage collected / replaced we still
        // rely on the ended/pause handlers to stop the analyser.
        // Return nothing — global cleanup handled in outer cleanup.
      } catch (e) {
        // ignore
      }
    }

    window.addEventListener("vw:tts-start", onStart as EventListener);

    return () => {
      window.removeEventListener("vw:tts-start", onStart as EventListener);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      try {
        if (sourceRef.current) sourceRef.current.disconnect();
      } catch (e) {}
      try {
        if (analyserRef.current) analyserRef.current.disconnect();
      } catch (e) {}
      try {
        if (audioCtxRef.current) audioCtxRef.current.close();
      } catch (e) {}
    };
  }, []);

  return (
    <TtsAnalyserContext.Provider value={{ amplitude }}>
      {children}
    </TtsAnalyserContext.Provider>
  );
};

export const useTtsAnalyser = () => {
  return useContext(TtsAnalyserContext);
};

export default useTtsAnalyser;
