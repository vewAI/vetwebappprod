"use client";

import { useRef, useState, useCallback, useEffect } from "react";

export type UseMicrophoneResult = {
  isRecording: boolean;
  hasPermission: boolean | null;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  toggle: () => Promise<void>;
  onAudioData: ((handler: (chunk: ArrayBuffer) => void) => void) | null;
};

/**
 * P4.1 + P4.2: Uses AudioWorklet (not deprecated ScriptProcessor) with
 * built-in resampling from any device sample rate to 16 kHz PCM Int16.
 */
export function useMicrophone(targetSampleRate = 16000): UseMicrophoneResult {
  const [isRecording, setIsRecording] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const handlerRef = useRef<((chunk: ArrayBuffer) => void) | null>(null);
  const workletLoadedRef = useRef(false);

  const stop = useCallback(() => {
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (contextRef.current) {
      contextRef.current.close().catch(() => {});
      contextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const startWithScriptProcessor = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      setHasPermission(true);
      setError(null);

      const ctx = new AudioContext();
      contextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        const float32 = e.inputBuffer.getChannelData(0);
        const int16 = float32ToS16(float32);
        if (handlerRef.current) {
          handlerRef.current(int16.buffer as ArrayBuffer);
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);

      (workletNodeRef as any).current = {
        disconnect: () => {
          processor.disconnect();
        },
      };

      setIsRecording(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Microphone access denied";
      setError(msg);
      setHasPermission(false);
    }
  }, [stop]);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      streamRef.current = stream;
      setHasPermission(true);
      setError(null);

      const ctx = new AudioContext();
      contextRef.current = ctx;

      if (!workletLoadedRef.current) {
        await ctx.audioWorklet.addModule("/mic-processor.js");
        workletLoadedRef.current = true;
      }

      const source = ctx.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(ctx, "mic-processor");
      workletNodeRef.current = workletNode;

      workletNode.port.onmessage = (e: MessageEvent) => {
        if (handlerRef.current && e.data instanceof ArrayBuffer) {
          handlerRef.current(e.data);
        }
      };

      source.connect(workletNode);

      setIsRecording(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Microphone access denied";
      if (msg.includes("addModule") || msg.includes("AudioWorklet")) {
        console.warn("[Mic] AudioWorklet unavailable, falling back to ScriptProcessor");
        return startWithScriptProcessor();
      }
      setError(msg);
      setHasPermission(false);
    }
  }, [startWithScriptProcessor]);

  const toggle = useCallback(async () => {
    if (isRecording) {
      stop();
    } else {
      await start();
    }
  }, [isRecording, start, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  const setAudioHandler = useCallback((handler: (chunk: ArrayBuffer) => void) => {
    handlerRef.current = handler;
  }, []);

  return {
    isRecording,
    hasPermission,
    error,
    start,
    stop,
    toggle,
    onAudioData: setAudioHandler,
  };
}

function float32ToS16(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}
