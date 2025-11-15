"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { TtsEventDetail } from "@/features/speech/models/tts-events";

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

type TtsAnalyserContextValue = {
  amplitude: number;
};

const TtsAnalyserContext = createContext<TtsAnalyserContextValue>({
  amplitude: 0,
});

type TtsStartDetail = Pick<TtsEventDetail, "audio">;

export const TtsAnalyserProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [amplitude, setAmplitude] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const handleStart = (event: Event) => {
      const detail = (event as CustomEvent<TtsStartDetail>).detail;
      const audioEl = detail?.audio;
      if (!audioEl) return;

      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioCtx();
        }
        const audioCtx = audioCtxRef.current;
        if (!audioCtx) return;

        if (sourceRef.current) {
          sourceRef.current.disconnect();
          sourceRef.current = null;
        }
        if (analyserRef.current) {
          analyserRef.current.disconnect();
          analyserRef.current = null;
        }

        const sourceNode = audioCtx.createMediaElementSource(audioEl);
        const analyserNode = audioCtx.createAnalyser();
        analyserNode.fftSize = 2048;
        sourceNode.connect(analyserNode);
        analyserNode.connect(audioCtx.destination);

        sourceRef.current = sourceNode;
        analyserRef.current = analyserNode;

        const dataArray = new Uint8Array(analyserNode.frequencyBinCount);

        const tick = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          const avg =
            dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
          setAmplitude(avg / 255);
          rafRef.current = requestAnimationFrame(tick);
        };

        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(tick);

        const cleanup = () => {
          if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }
          setAmplitude(0);
        };

        audioEl.addEventListener("ended", cleanup, { once: true });
        audioEl.addEventListener("pause", cleanup, { once: true });
      } catch (error) {
        console.warn("Failed to initialise TTS analyser", error);
      }
    };

    window.addEventListener("vw:tts-start", handleStart as EventListener);

    return () => {
      window.removeEventListener("vw:tts-start", handleStart as EventListener);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      try {
        sourceRef.current?.disconnect();
        analyserRef.current?.disconnect();
      } catch (error) {
        console.warn("TTS analyser disconnect error", error);
      }
      sourceRef.current = null;
      analyserRef.current = null;
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => undefined);
        audioCtxRef.current = null;
      }
    };
  }, []);

  const value = useMemo<TtsAnalyserContextValue>(
    () => ({ amplitude }),
    [amplitude]
  );

  return (
    <TtsAnalyserContext.Provider value={value}>
      {children}
    </TtsAnalyserContext.Provider>
  );
};

export const useTtsAnalyser = () => {
  return useContext(TtsAnalyserContext);
};

export default useTtsAnalyser;
