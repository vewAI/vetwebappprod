"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Case } from "@/features/case-selection/models/case";
import type { Stage } from "@/features/stages/types";
import type { PersonaEntry } from "@/features/chat/hooks/usePersonaDirectory";
import { usePersonaSwitcher } from "../hooks/usePersonaSwitcher";
import { useGeminiLive } from "../hooks/useGeminiLive";
import { useMicrophone } from "../hooks/useMicrophone";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { useLiveProgress } from "../hooks/useLiveProgress";
import { PersonaHeader } from "./persona-header";
import { AudioWaveform } from "./audio-waveform";
import { LiveControls } from "./live-controls";
import { LiveStageProgress } from "./live-stage-progress";
import { LiveTranscript } from "./live-transcript";

type LiveSessionProps = {
  caseItem: Case;
  stages: Stage[];
  initialStageIndex?: number;
  personaDirectory: Record<string, PersonaEntry>;
  attemptId: string;
  onSessionEnd?: () => void;
};

export function LiveSession({
  caseItem,
  stages: initialStages,
  initialStageIndex = 0,
  personaDirectory,
  attemptId,
  onSessionEnd,
}: LiveSessionProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  const progress = useLiveProgress(initialStages, initialStageIndex);
  const persona = usePersonaSwitcher(
    caseItem,
    progress.stages,
    progress.currentStageIndex,
    personaDirectory
  );

  const live = useGeminiLive();
  const mic = useMicrophone();
  const player = useAudioPlayer();

  const prevUserTurnCountRef = useRef(0);
  const currentStage = progress.stages[progress.currentStageIndex];

  // Wire mic audio to live session
  useEffect(() => {
    let chunkCount = 0;
    mic.onAudioData?.((chunk) => {
      chunkCount++;
      if (chunkCount <= 3) {
        console.log("[Session] Mic chunk sent:", chunk.byteLength, "bytes (#" + chunkCount + ")");
      }
      live.sendAudio(chunk);
    });
  }, [mic, live]);

  // Wire live audio output to player (streaming for low latency)
  useEffect(() => {
    live.setOnAudioStream((chunk) => {
      player.enqueue(chunk);
    });
    live.setOnAudioFlush(() => {
      player.flush();
    });
  }, [live, player]);

  // Connect when persona becomes available
  const hasConnectedRef = useRef(false);
  const retryCountRef = useRef(0);
  useEffect(() => {
    if (!persona) return;
    if (hasConnectedRef.current) return;

    let cancelled = false;
    hasConnectedRef.current = true;

    async function init() {
      try {
        if (!persona) return;
        const { getAccessToken } = await import("@/lib/auth-headers");
        const accessToken = await getAccessToken().catch(() => null);

        console.log("[Session] Fetching token for case:", caseItem.id);
        const tokenRes = await fetch("/api/live/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({ caseId: caseItem.id }),
        });

        if (!tokenRes.ok) {
          const err = await tokenRes.json().catch(() => ({ error: `HTTP ${tokenRes.status}` }));
          throw new Error(err.error ?? "Failed to get token");
        }

        const { token } = await tokenRes.json();
        if (cancelled) return;
        console.log("[Session] Got token, connecting with persona:", persona.displayName);
        await live.connect(token, persona);

        // Auto-start mic so the student can speak immediately
        await mic.start();

        // If owner persona, send a silent trigger to make them speak first
        if (persona.roleKey === "owner") {
          live.sendText("[SYS_TRIGGER]");
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[Session] Init failed:", err);
          hasConnectedRef.current = false;
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      live.disconnect();
      hasConnectedRef.current = false;
    };
  }, [persona]);

  // Auto-reconnect on unexpected disconnect
  useEffect(() => {
    if (live.status === "connected") {
      retryCountRef.current = 0;
      return;
    }
    if (live.status !== "disconnected" || !persona) return;
    if (retryCountRef.current >= 3) return;

    const delay = Math.min(2000 * Math.pow(2, retryCountRef.current), 10000);
    const attempt = retryCountRef.current + 1;
    retryCountRef.current = attempt;
    console.log(`[Session] Reconnecting in ${delay}ms (attempt ${attempt})`);

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled || !persona) return;
      hasConnectedRef.current = false;
      try {
        const { getAccessToken } = await import("@/lib/auth-headers");
        const accessToken = await getAccessToken().catch(() => null);
        const tokenRes = await fetch("/api/live/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({ caseId: caseItem.id }),
        });
        if (!tokenRes.ok) throw new Error(`Reconnect failed: HTTP ${tokenRes.status}`);
        const { token } = await tokenRes.json();
        if (cancelled) return;
        console.log("[Session] Reconnected with persona:", persona.displayName);
        await live.connect(token, persona);
        await mic.start();
        if (persona.roleKey === "owner") live.sendText("[SYS_TRIGGER]");
      } catch (err) {
        if (!cancelled) {
          console.error("[Session] Reconnect attempt failed:", err);
          // Reset so the next status change can trigger another attempt
          hasConnectedRef.current = false;
        }
      }
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [live.status, persona]);

  // Switch persona when stage changes + reset turn counter
  useEffect(() => {
    if (persona && live.status === "connected") {
      live.switchPersona(persona);

      // If switching TO owner persona, send trigger so they speak first
      // This ensures the owner initiates conversation in every owner stage,
      // not just on initial connection (e.g., History → Physical → Diagnostic)
      if (persona.roleKey === "owner") {
        // Small delay to ensure persona switch is processed first
        setTimeout(() => {
          if (live.status === "connected") {
            live.sendText("[SYS_TRIGGER]");
          }
        }, 500);
      }
    }
    prevUserTurnCountRef.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress.currentStageIndex]);

  // Record turns for stage progression — only on NEW user entries
  useEffect(() => {
    const userTurns = live.transcript.filter((e) => e.speaker === "user").length;
    const newTurns = userTurns - prevUserTurnCountRef.current;
    if (newTurns > 0) {
      for (let i = 0; i < newTurns; i++) {
        progress.recordTurn();
      }
    }
    prevUserTurnCountRef.current = userTurns;
  }, [live.transcript, progress]);

  // Auto-advance stage when enough turns completed and AI finishes speaking
  useEffect(() => {
    if (progress.canAdvance && !live.isSpeaking && live.status === "connected") {
      const timer = setTimeout(() => {
        if (progress.currentStageIndex < progress.stages.length - 1) {
          progress.advanceStage();
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [progress.canAdvance, live.isSpeaking, live.status, progress]);

  const handleToggleMic = useCallback(async () => {
    if (mic.isRecording) {
      mic.stop();
    } else {
      await mic.start();
    }
  }, [mic]);

  const handleAdvanceStage = useCallback(() => {
    progress.advanceStage();
  }, [progress]);

  const handleEndSession = useCallback(async () => {
    mic.stop();
    live.disconnect();

    try {
      const { getAccessToken } = await import("@/lib/auth-headers");
      const accessToken = await getAccessToken().catch(() => null);

      await fetch("/api/live/session", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          attemptId,
          currentStageIndex: progress.currentStageIndex,
          status: "completed",
        }),
      });
    } catch {
      // non-critical
    }

    onSessionEnd?.();
  }, [mic, live, attemptId, progress.currentStageIndex, onSessionEnd]);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
    if (!isMuted) {
      player.stop();
    }
  }, [isMuted, player]);

  const waveformMode = live.isSpeaking
    ? "speaking" as const
    : mic.isRecording
      ? "listening" as const
      : "idle" as const;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Top: Persona header */}
      <PersonaHeader
        persona={persona}
        stageTitle={currentStage?.title ?? ""}
        isSpeaking={live.isSpeaking}
      />

      {/* Stage progress pills */}
      <LiveStageProgress
        stages={progress.stages}
        currentIndex={progress.currentStageIndex}
      />

      {/* Center: Waveform visualization */}
      <div className="flex-1 flex items-center justify-center px-4">
        <AudioWaveform
          isActive={live.status === "connected"}
          mode={waveformMode}
          className="h-48 w-full max-w-sm"
        />
      </div>

      {/* Transcript */}
      <LiveTranscript
        entries={live.transcript}
        personaName={persona?.displayName ?? "AI"}
        isOpen={true}
      />

      {/* Bottom: Controls */}
      <LiveControls
        status={live.status}
        isRecording={mic.isRecording}
        canAdvance={progress.canAdvance}
        isMuted={isMuted}
        onToggleMic={handleToggleMic}
        onInterrupt={live.interrupt}
        onAdvanceStage={handleAdvanceStage}
        onEndSession={handleEndSession}
        onToggleMute={handleToggleMute}
      />

      {/* Error / status display */}
      {live.error && (
        <div className="mx-4 mb-4 rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-600 dark:text-red-400">
          {live.error}
        </div>
      )}
      {!live.error && live.status === "disconnected" && retryCountRef.current >= 3 && (
        <div className="mx-4 mb-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-600 dark:text-amber-400">
          Connection lost. Tap the mic to retry or end the session.
        </div>
      )}
    </div>
  );
}
