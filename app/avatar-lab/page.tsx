"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import TtsOverlay from "@/features/speech/components/tts-overlay";
import {
  dispatchTtsEnd,
  dispatchTtsStart,
  type TtsEventDetail,
} from "@/features/speech/models/tts-events";
import { normalizeRoleKey } from "@/features/avatar/utils/role-utils";

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

const CASE_PRESETS = [
  "case-1",
  "case-2",
  "sandbox-demo",
  "acute-non-painful-crackly-swelling-under-the-skin-06dfada8",
];

const ROLE_PRESETS = [
  "Virtual Assistant",
  "Client (Horse Owner)",
  "Laboratory Technician",
  "Veterinarian",
];

const DEFAULT_SCRIPT =
  "Hi Doc, I'm here as your sandbox assistant. Use the controls to try different roles and cases.";

export default function AvatarLabPage() {
  const [caseId, setCaseId] = useState<string>(CASE_PRESETS[0]);
  const [roleLabel, setRoleLabel] = useState<string>(ROLE_PRESETS[0]);
  const [displayName, setDisplayName] = useState<string>("Virtual Assistant");
  const [script, setScript] = useState<string>(DEFAULT_SCRIPT);
  const [toneFrequency, setToneFrequency] = useState<number>(240);
  const [durationMs, setDurationMs] = useState<number>(2200);
  const [status, setStatus] = useState<"idle" | "speaking" | "cooldown">(
    "idle"
  );
  const [eventLog, setEventLog] = useState<
    Array<{ timestamp: number; type: "start" | "end"; summary: string }>
  >([]);

  const playbackTimeoutRef = useRef<number | null>(null);
  const cooldownTimeoutRef = useRef<number | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const lastDetailRef = useRef<TtsEventDetail | null>(null);

  useEffect(() => {
    return () => {
      if (playbackTimeoutRef.current) {
        window.clearTimeout(playbackTimeoutRef.current);
      }
      if (cooldownTimeoutRef.current) {
        window.clearTimeout(cooldownTimeoutRef.current);
      }
      cleanupRef.current?.();
      if (lastDetailRef.current) {
        dispatchTtsEnd(lastDetailRef.current);
      }
    };
  }, []);

  const statusLabel = useMemo(() => {
    switch (status) {
      case "speaking":
        return "Dispatching vw:tts-start";
      case "cooldown":
        return "Cooling down (avatar stays visible briefly)";
      default:
        return "Idle";
    }
  }, [status]);

  const logEvent = (type: "start" | "end", summary: string) => {
    setEventLog((prev) => [
      ...prev.slice(-4),
      { timestamp: Date.now(), type, summary },
    ]);
  };

  const handleTriggerSpeech = () => {
    if (typeof window === "undefined") return;

    stopPlayback();

    const handle = createSyntheticTone(durationMs, toneFrequency);
    if (!handle) {
      alert("Web Audio is not supported in this browser");
      return;
    }

    cleanupRef.current = handle.cleanup;

    const normalizedRoleKey =
      normalizeRoleKey(displayName || roleLabel || "assistant") ?? "assistant";

    const detail: TtsEventDetail = {
      audio: handle.audio ?? undefined,
      caseId,
      roleKey: normalizedRoleKey,
      role: roleLabel,
      displayRole: displayName || roleLabel,
      metadata: {
        source: "avatar-lab",
        script,
        frequency: toneFrequency,
        durationMs,
      },
    };

    lastDetailRef.current = detail;
    dispatchTtsStart(detail);
    setStatus("speaking");
    logEvent(
      "start",
      `${detail.displayRole ?? detail.role ?? "assistant"} • ${caseId}`
    );

    playbackTimeoutRef.current = window.setTimeout(() => {
      if (lastDetailRef.current) {
        dispatchTtsEnd(lastDetailRef.current);
        logEvent(
          "end",
          `${detail.displayRole ?? detail.role ?? "assistant"} • ${caseId}`
        );
        lastDetailRef.current = null;
      }
      cleanupRef.current?.();
      cleanupRef.current = null;
      playbackTimeoutRef.current = null;
      setStatus("cooldown");
      cooldownTimeoutRef.current = window.setTimeout(() => {
        setStatus("idle");
      }, 650);
    }, durationMs);
  };

  const stopPlayback = () => {
    if (playbackTimeoutRef.current) {
      window.clearTimeout(playbackTimeoutRef.current);
      playbackTimeoutRef.current = null;
    }
    if (cooldownTimeoutRef.current) {
      window.clearTimeout(cooldownTimeoutRef.current);
      cooldownTimeoutRef.current = null;
    }
    if (lastDetailRef.current) {
      dispatchTtsEnd(lastDetailRef.current);
      logEvent(
        "end",
        `${
          lastDetailRef.current.displayRole ??
          lastDetailRef.current.role ??
          "assistant"
        } • ${caseId}`
      );
      lastDetailRef.current = null;
    }
    cleanupRef.current?.();
    cleanupRef.current = null;
    setStatus("idle");
  };

  return (
    <div className="relative min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
        <header className="space-y-3">
          <p className="text-sm font-semibold tracking-wide text-slate-400">
            Avatar Lab
          </p>
          <h1 className="text-3xl font-bold">Talking avatar sandbox</h1>
          <p className="text-base text-slate-300">
            Use this page to simulate text-to-speech events without needing a
            full chat flow. Dispatch synthetic audio with case + role metadata
            to verify Supabase avatar profiles, presence context, and analyser
            behavior.
          </p>
        </header>

        <section className="grid gap-6 rounded-2xl bg-slate-900/70 p-6 md:grid-cols-2">
          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-300">
              Case ID
            </label>
            <select
              className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm"
              value={caseId}
              onChange={(e) => setCaseId(e.target.value)}
            >
              {CASE_PRESETS.map((preset) => (
                <option key={preset} value={preset}>
                  {preset}
                </option>
              ))}
            </select>
            <Input
              value={caseId}
              onChange={(e) => setCaseId(e.target.value)}
              className="border-slate-700 bg-slate-900/60"
              placeholder="custom-case-id"
            />
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-300">
              Role preset
            </label>
            <select
              className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm"
              value={roleLabel}
              onChange={(e) => {
                setRoleLabel(e.target.value);
                if (!displayName) {
                  setDisplayName(e.target.value);
                }
              }}
            >
              {ROLE_PRESETS.map((preset) => (
                <option key={preset} value={preset}>
                  {preset}
                </option>
              ))}
            </select>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="border-slate-700 bg-slate-900/60"
              placeholder="Display name"
            />
          </div>
        </section>

        <section className="grid gap-6 rounded-2xl bg-slate-900/70 p-6 md:grid-cols-2">
          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-300">
              Script / transcript preview
            </label>
            <Textarea
              rows={6}
              value={script}
              onChange={(e) => setScript(e.target.value)}
              className="border-slate-700 bg-slate-900/60"
            />
          </div>
          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-300">
              Audio synthesis
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs uppercase tracking-wider text-slate-500">
                  Duration (ms)
                </span>
                <Input
                  type="number"
                  min={500}
                  max={6000}
                  value={durationMs}
                  onChange={(e) => setDurationMs(Number(e.target.value) || 0)}
                  className="border-slate-700 bg-slate-900/60"
                />
              </div>
              <div>
                <span className="text-xs uppercase tracking-wider text-slate-500">
                  Frequency (Hz)
                </span>
                <Input
                  type="number"
                  min={120}
                  max={800}
                  value={toneFrequency}
                  onChange={(e) =>
                    setToneFrequency(Number(e.target.value) || 0)
                  }
                  className="border-slate-700 bg-slate-900/60"
                />
              </div>
            </div>
            <p className="text-xs text-slate-400">
              The oscillator feeds a hidden <code>HTMLAudioElement</code> so the
              analyser + avatar receive realistic amplitude data.
            </p>
          </div>
        </section>

        <section className="flex flex-wrap gap-4 rounded-2xl bg-slate-900/70 p-6">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-slate-300">Status</span>
            <span className="text-lg font-mono text-amber-300">
              {statusLabel}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handleTriggerSpeech} className="bg-emerald-500">
              Trigger synthetic speech
            </Button>
            <Button variant="secondary" onClick={stopPlayback}>
              Stop / reset
            </Button>
          </div>
        </section>

        <section className="rounded-2xl bg-slate-900/70 p-6">
          <h2 className="text-sm font-semibold text-slate-400">Event log</h2>
          {eventLog.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              No events yet. Trigger a synthetic phrase to populate this list.
            </p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              {eventLog
                .slice()
                .reverse()
                .map((entry) => (
                  <li key={entry.timestamp} className="flex justify-between">
                    <span>{entry.summary}</span>
                    <span
                      className={
                        entry.type === "start"
                          ? "text-emerald-400"
                          : "text-sky-400"
                      }
                    >
                      {entry.type}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </section>
      </div>

      <TtsOverlay />
    </div>
  );
}

function createSyntheticTone(durationMs: number, frequency: number) {
  if (typeof window === "undefined") return null;
  const AudioCtx =
    window.AudioContext || window.webkitAudioContext || undefined;
  if (!AudioCtx) return null;

  const ctx = new AudioCtx();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const mediaDest = ctx.createMediaStreamDestination();

  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  gain.gain.value = 0.35;

  oscillator.connect(gain);
  gain.connect(mediaDest);
  gain.connect(ctx.destination);

  oscillator.start();

  const audio = new Audio();
  audio.srcObject = mediaDest.stream;
  const playPromise = audio.play();
  if (playPromise && typeof playPromise.then === "function") {
    playPromise.catch(() => undefined);
  }

  const cleanup = () => {
    try {
      oscillator.stop();
    } catch {
      /* noop */
    }
    try {
      oscillator.disconnect();
      gain.disconnect();
    } catch {
      /* noop */
    }
    ctx.close().catch(() => undefined);
    try {
      audio.pause();
    } catch {
      /* noop */
    }
    audio.srcObject = null;
  };

  window.setTimeout(() => {
    cleanup();
    audio.dispatchEvent(new Event("ended"));
  }, durationMs + 25);

  return { audio, cleanup };
}
