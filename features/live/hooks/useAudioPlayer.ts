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
  /** RMS level of the audio currently playing, in [0, 1]. */
  getOutputLevel: () => number;
  setOnPlayingChange: (cb: ((playing: boolean) => void) | null) => void;
};

function pcmToAudioBuffer(ctx: AudioContext, chunk: ArrayBuffer): AudioBuffer | null {
  const validByteLength = chunk.byteLength - (chunk.byteLength % 2);
  if (validByteLength <= 0) return null;
  const pcm = new Int16Array(chunk, 0, validByteLength / 2);
  const float32 = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) {
    const val = pcm[i];
    float32[i] = val < 0 ? val / 32768 : val / 32767;
  }
  const buffer = ctx.createBuffer(1, float32.length, LIVE_AUDIO_CONFIG.outputSampleRate);
  buffer.getChannelData(0).set(float32);
  return buffer;
}

export function useAudioPlayer(): UseAudioPlayerResult {
  const [isPlaying, setIsPlaying] = useState(false);
  const contextRef = useRef<AudioContext | null>(null);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef(0);
  const playingCbRef = useRef<((playing: boolean) => void) | null>(null);
  const stoppedRef = useRef(false);
  const mutedRef = useRef(false);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // RMS level of the audio currently playing, for the waveform.
  const getOutputLevel = useCallback((): number => {
    const analyser = analyserRef.current;
    if (!analyser) return 0;
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / data.length) * 2.5);
  }, []);

  const getContext = useCallback(() => {
    if (!contextRef.current || contextRef.current.state === "closed") {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      // Do NOT force sampleRate: 24000. Let AudioContext use the device's native hardware
      // rate (e.g. 48kHz / 44.1kHz). Web Audio automatically and cleanly resamples the
      // 24000Hz AudioBuffers without WASAPI buffer underruns or driver-level clicks.
      contextRef.current = new AudioCtx();
    }
    if (contextRef.current.state === "suspended") {
      contextRef.current.resume().catch(() => {});
    }
    return contextRef.current;
  }, []);

  const scheduleBuffer = useCallback((buffer: AudioBuffer) => {
    if (stoppedRef.current || mutedRef.current) return;
    const ctx = getContext();

    if (!analyserRef.current) {
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.connect(ctx.destination);
      analyserRef.current = analyser;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(analyserRef.current);

    const currentTime = ctx.currentTime;
    // Jitter buffer lead time:
    // If the playhead has run dry or is just starting a new turn, schedule with an initial
    // small lead time (e.g. 50ms) to absorb WebSocket packet jitter.
    // If audio is actively playing, schedule with zero gap right at nextStartTime.
    const isTimelineStale = nextStartTimeRef.current <= currentTime;
    const leadTime = isTimelineStale ? 0.05 : 0.0;
    const startTime = Math.max(currentTime + leadTime, nextStartTimeRef.current);

    source.start(startTime);
    nextStartTimeRef.current = startTime + buffer.duration;

    activeSourcesRef.current.add(source);
    setIsPlaying(true);
    playingCbRef.current?.(true);

    source.onended = () => {
      activeSourcesRef.current.delete(source);
      try {
        source.disconnect();
      } catch {
        /* ignore */
      }
      if (
        activeSourcesRef.current.size === 0 &&
        (!contextRef.current || nextStartTimeRef.current <= contextRef.current.currentTime + 0.02)
      ) {
        setIsPlaying(false);
        playingCbRef.current?.(false);
      }
    };
  }, [getContext]);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    nextStartTimeRef.current = 0;
    for (const source of activeSourcesRef.current) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        /* ignore */
      }
    }
    activeSourcesRef.current.clear();
    setIsPlaying(false);
    playingCbRef.current?.(false);
  }, []);

  const enqueue = useCallback(
    (chunk: ArrayBuffer) => {
      if (mutedRef.current) return;
      stoppedRef.current = false;
      const ctx = getContext();
      const buffer = pcmToAudioBuffer(ctx, chunk);
      if (buffer) {
        scheduleBuffer(buffer);
      }
    },
    [getContext, scheduleBuffer]
  );

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
    // With timeline scheduling, buffers are scheduled immediately on arrival.
  }, []);

  const play = useCallback(
    (chunks: ArrayBuffer[]) => {
      if (chunks.length === 0) return;
      stop();
      stoppedRef.current = false;
      const ctx = getContext();
      for (const chunk of chunks) {
        const buffer = pcmToAudioBuffer(ctx, chunk);
        if (buffer) {
          scheduleBuffer(buffer);
        }
      }
    },
    [getContext, stop, scheduleBuffer]
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

  return { isPlaying, play, enqueue, flush, stop, setMuted, getOutputLevel, setOnPlayingChange };
}
