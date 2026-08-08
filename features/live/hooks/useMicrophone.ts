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
 *
 * Robustness: if the AudioWorklet path fails for ANY reason (asset missing,
 * module parse error, unsupported browser, ...), we fall back to a
 * ScriptProcessor-based implementation instead of matching error messages.
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

  /**
   * Fallback capture path used when AudioWorklet is unavailable.
   * Uses the proven ScriptProcessor approach from before the FASE 4
   * refactor: a 16 kHz AudioContext (or native rate + JS resampling if
   * the browser rejects 16 kHz), converting Float32 to Int16 PCM.
   */
  const startWithScriptProcessor = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      setHasPermission(true);
      setError(null);

      // Prefer a 16 kHz context so chunks can be sent to Gemini as-is.
      let ctx: AudioContext;
      try {
        ctx = new AudioContext({ sampleRate: targetSampleRate });
      } catch {
        ctx = new AudioContext();
      }
      contextRef.current = ctx;
      // Safari starts contexts suspended; make sure the graph actually renders.
      if (ctx.state === "suspended") {
        void ctx.resume().catch(() => {});
      }

      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      const resampler =
        Math.abs(ctx.sampleRate - targetSampleRate) > 1
          ? new LinearResampler(ctx.sampleRate, targetSampleRate)
          : null;

      processor.onaudioprocess = (e) => {
        const float32 = e.inputBuffer.getChannelData(0);
        const int16 = resampler ? resampler.process(float32) : float32ToS16(float32);
        if (handlerRef.current) {
          handlerRef.current(int16.buffer as ArrayBuffer);
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);

      (workletNodeRef as unknown as { current: { disconnect: () => void } | null }).current = {
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
  }, [targetSampleRate]);

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
      // Safari starts contexts suspended; make sure the graph actually renders.
      if (ctx.state === "suspended") {
        void ctx.resume().catch(() => {});
      }

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
      // getUserMedia failed (permission denied / no device) — surface the error.
      if (!streamRef.current) {
        const msg = err instanceof Error ? err.message : "Microphone access denied";
        setError(msg);
        setHasPermission(false);
        return;
      }

      // Worklet setup failed for any reason (asset missing, module parse
      // error, unsupported browser, ...). Tear down the failed attempt so
      // the mic is released, then retry with ScriptProcessor.
      console.warn("[Mic] AudioWorklet unavailable, falling back to ScriptProcessor:", err);
      stop();
      await startWithScriptProcessor();
    }
  }, [startWithScriptProcessor, stop]);

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

/**
 * Minimal stateful linear-interpolation resampler, used by the
 * ScriptProcessor fallback when a 16 kHz AudioContext is not supported
 * (i.e. capture runs at the device's native rate).
 */
class LinearResampler {
  private readonly ratio: number;
  private prevSample = 0;
  // Fractional read position in input-sample units, relative to the start of
  // the current block. Always in [0, ratio) between blocks so interpolation
  // at block boundaries stays correct (no negative indexing, no sample drift).
  private pos = 0;

  constructor(inputRate: number, outputRate: number) {
    this.ratio = inputRate / outputRate;
  }

  process(input: Float32Array): Int16Array {
    const outLen = Math.max(1, Math.ceil((input.length - this.pos) / this.ratio));
    const out = new Int16Array(outLen);
    let written = 0;
    let pos = this.pos;

    while (pos < input.length && written < outLen) {
      const idx = Math.floor(pos);
      const frac = pos - idx;
      const a = idx > 0 ? input[idx - 1] : this.prevSample;
      const b = input[Math.min(idx, input.length - 1)];
      const s = Math.max(-1, Math.min(1, a * (1 - frac) + b * frac));
      out[written++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      pos += this.ratio;
    }

    this.pos = pos - input.length;
    this.prevSample = input[input.length - 1];
    return out.slice(0, written);
  }
}
