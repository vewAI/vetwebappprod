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

export function useMicrophone(sampleRate = 16000): UseMicrophoneResult {
  const [isRecording, setIsRecording] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const handlerRef = useRef<((chunk: ArrayBuffer) => void) | null>(null);

  const stop = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
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

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      streamRef.current = stream;
      setHasPermission(true);
      setError(null);

      const ctx = new AudioContext({ sampleRate });
      contextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      // Use ScriptProcessor for broad compatibility; 4096 samples = 256ms at 16kHz
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const float32 = e.inputBuffer.getChannelData(0);
        const int16 = float32ToS16(float32);
        const chunk = int16.buffer as ArrayBuffer;
        if (handlerRef.current) {
          handlerRef.current(chunk);
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);

      setIsRecording(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Microphone access denied";
      setError(msg);
      setHasPermission(false);
    }
  }, [sampleRate]);

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
