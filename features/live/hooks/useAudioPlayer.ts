"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { LIVE_AUDIO_CONFIG } from "../types";

export type UseAudioPlayerResult = {
  isPlaying: boolean;
  play: (chunks: ArrayBuffer[]) => void;
  stop: () => void;
  setOnPlayingChange: (cb: ((playing: boolean) => void) | null) => void;
};

export function useAudioPlayer(): UseAudioPlayerResult {
  const [isPlaying, setIsPlaying] = useState(false);
  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const playingCbRef = useRef<((playing: boolean) => void) | null>(null);

  const getContext = useCallback(() => {
    if (!contextRef.current || contextRef.current.state === "closed") {
      contextRef.current = new AudioContext({
        sampleRate: LIVE_AUDIO_CONFIG.outputSampleRate,
      });
    }
    return contextRef.current;
  }, []);

  const stop = useCallback(() => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch {
        // already stopped
      }
      sourceRef.current = null;
    }
    setIsPlaying(false);
    playingCbRef.current?.(false);
  }, []);

  const play = useCallback(
    (chunks: ArrayBuffer[]) => {
      if (chunks.length === 0) return;

      stop();

      const ctx = getContext();
      const totalLength = chunks.reduce((sum, c) => sum + c.byteLength / 2, 0);
      const pcm = new Int16Array(totalLength);

      let offset = 0;
      for (const chunk of chunks) {
        const view = new Int16Array(chunk);
        pcm.set(view, offset);
        offset += view.length;
      }

      // Convert S16 to float32 for Web Audio
      const float32 = new Float32Array(pcm.length);
      for (let i = 0; i < pcm.length; i++) {
        float32[i] = pcm[i] / 32768;
      }

      const buffer = ctx.createBuffer(1, float32.length, LIVE_AUDIO_CONFIG.outputSampleRate);
      buffer.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => {
        setIsPlaying(false);
        playingCbRef.current?.(false);
        sourceRef.current = null;
      };

      sourceRef.current = source;
      setIsPlaying(true);
      playingCbRef.current?.(true);
      source.start();
    },
    [getContext, stop]
  );

  const setOnPlayingChange = useCallback((cb: ((playing: boolean) => void) | null) => {
    playingCbRef.current = cb;
  }, []);

  useEffect(() => {
    return () => {
      stop();
      contextRef.current?.close().catch(() => {});
    };
  }, [stop]);

  return { isPlaying, play, stop, setOnPlayingChange };
}
