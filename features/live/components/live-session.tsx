"use client";

import { useState, useEffect, useCallback } from "react";
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

  const currentStage = progress.stages[progress.currentStageIndex];

  // Wire mic audio to live session
  useEffect(() => {
    mic.onAudioData?.((chunk) => {
      live.sendAudio(chunk);
    });
  }, [mic, live]);

  // Wire live audio output to player
  useEffect(() => {
    live.setOnAudio((chunks) => {
      player.play(chunks);
    });
  }, [live, player]);

  // Connect on mount
  useEffect(() => {
    async function init() {
      if (!persona) return;

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

        if (!tokenRes.ok) {
          const err = await tokenRes.json();
          throw new Error(err.error ?? "Failed to get token");
        }

        const { token } = await tokenRes.json();
        await live.connect(token, persona);
      } catch (err) {
        console.error("Live session init failed:", err);
      }
    }

    init();

    return () => {
      live.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch persona when stage changes
  useEffect(() => {
    if (persona && live.status === "connected") {
      live.switchPersona(persona);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress.currentStageIndex]);

  // Record turns for stage progression
  useEffect(() => {
    // Count user turns from transcript
    const userTurns = live.transcript.filter((e) => e.speaker === "user").length;
    // Simple turn counting
  }, [live.transcript]);

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

      {/* Transcript (toggleable) */}
      {showTranscript && (
        <LiveTranscript
          entries={live.transcript}
          personaName={persona?.displayName ?? "AI"}
          isOpen={showTranscript}
        />
      )}

      {/* Transcript toggle */}
      <div className="flex justify-center">
        <button
          onClick={() => setShowTranscript((prev) => !prev)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors px-4 py-1"
        >
          {showTranscript ? "Hide transcript" : "Show transcript"}
        </button>
      </div>

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

      {/* Error display */}
      {live.error && (
        <div className="mx-4 mb-4 rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-600 dark:text-red-400">
          {live.error}
        </div>
      )}
    </div>
  );
}
