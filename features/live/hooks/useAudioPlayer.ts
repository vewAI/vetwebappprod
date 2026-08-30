"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { LIVE_AUDIO_CONFIG } from "../types";

export type UseAudioPlayerResult = {
  isPlaying: boolean;
  play: (chunks: ArrayBuffer[]) => void;
  enqueue: (chunk: ArrayBuffer) => void;
  flush: () => void;
  stop: () => void;
  setMuted: (muted: boolean) => void;
  setOnPlayingChange: (cb: ((playing: boolean) => void) | null) => void;
};

function pcmToAudioBuffer(ctx: AudioContext, chunk: ArrayBuffer): AudioBuffer {
  const pcm = new Int16Array(chunk);
  const float32 = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) {
    float32[i] = pcm[i] / 32768;
  }
  const buffer = ctx.createBuffer(1, float32.length, LIVE_AUDIO_CONFIG.outputSampleRate);
  buffer.getChannelData(0).set(float32);
  return buffer;
}

export function useAudioPlayer(): UseAudioPlayerResult {
  const [isPlaying, setIsPlaying] = useState(false);
  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const queueRef = useRef<AudioBuffer[]>([]);
  const playingCbRef = useRef<((playing: boolean) => void) | null>(null);
  const stoppedRef = useRef(false);
  const mutedRef = useRef(false);
  const generationRef = useRef(0);
  const drainQueueRef = useRef<(() => void) | null>(null);

  const getContext = useCallback(() => {
    if (!contextRef.current || contextRef.current.state === "closed") {
      contextRef.current = new AudioContext({
        sampleRate: LIVE_AUDIO_CONFIG.outputSampleRate,
      });
    }
    return contextRef.current;
  }, []);

  const drainQueue = useCallback(() => {
    if (stoppedRef.current) return;
    if (queueRef.current.length === 0) {
      setIsPlaying(false);
      playingCbRef.current?.(false);
      return;
    }

    const gen = generationRef.current;
    const ctx = getContext();
    const buffer = queueRef.current.shift()!;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => {
      sourceRef.current = null;
      // Only continue draining if generation hasn't changed (stop wasn't called)
      if (gen === generationRef.current) {
        drainQueueRef.current?.();
      }
    };

    sourceRef.current = source;
    setIsPlaying(true);
    playingCbRef.current?.(true);
    source.start();
  }, [getContext]);

  useEffect(() => {
    drainQueueRef.current = drainQueue;
  }, [drainQueue]);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    generationRef.current++;
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch { /* */ }
      sourceRef.current = null;
    }
    queueRef.current = [];
    setIsPlaying(false);
    playingCbRef.current?.(false);
  }, []);

  const enqueue = useCallback((chunk: ArrayBuffer) => {
    // While muted, discard incoming chunks entirely so future model turns
    // stay silent until the user unmutes (stop() alone would be undone by
    // the next enqueue resetting stoppedRef).
    if (mutedRef.current) return;
    stoppedRef.current = false;
    const ctx = getContext();
    const buffer = pcmToAudioBuffer(ctx, chunk);
    queueRef.current.push(buffer);
    if (!sourceRef.current) {
      drainQueue();
    }
  }, [getContext, drainQueue]);

  const setMuted = useCallback(
    (muted: boolean) => {
      mutedRef.current = muted;
      if (muted) {
        stop();
      }
    },
    [stop]
  );

  const flush = useCallback(() => {
    stoppedRef.current = false;
    if (!sourceRef.current && queueRef.current.length > 0) {
      drainQueue();
    }
  }, [drainQueue]);

  const play = useCallback(
    (chunks: ArrayBuffer[]) => {
      if (chunks.length === 0) return;
      stop();
      stoppedRef.current = false;
      const ctx = getContext();
      for (const chunk of chunks) {
        queueRef.current.push(pcmToAudioBuffer(ctx, chunk));
      }
      drainQueue();
    },
    [getContext, stop, drainQueue]
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

  return { isPlaying, play, enqueue, flush, stop, setMuted, setOnPlayingChange };
}
