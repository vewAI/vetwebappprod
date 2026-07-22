"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getAccessToken } from "@/lib/auth-headers";
import type { Case } from "@/features/case-selection/models/case";
import type { Stage } from "@/features/stages/types";
import type { PersonaEntry } from "@/features/chat/hooks/usePersonaDirectory";
import type { Message } from "@/features/chat/models/chat";
import { usePersonaSwitcher } from "../hooks/usePersonaSwitcher";
import { useGeminiLive } from "../hooks/useGeminiLive";
import { useMicrophone } from "../hooks/useMicrophone";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { useLiveProgress } from "../hooks/useLiveProgress";
import { useSaveAttempt } from "@/features/attempts/hooks/useSaveAttempt";
import { PersonaHeader } from "./persona-header";
import { AudioWaveform } from "./audio-waveform";
import { LiveControls } from "./live-controls";
import { LiveStageProgress } from "./live-stage-progress";
import { LiveTranscript } from "./live-transcript";
import { StageAdvanceHint } from "./stage-advance-hint";

type LiveSessionProps = {
  caseItem: Case;
  stages: Stage[];
  initialStageIndex?: number;
  personaDirectory: Record<string, PersonaEntry>;
  attemptId: string;
  initialMessages?: Message[];
  onSessionEnd?: (messages?: Message[]) => void;
};

export function LiveSession({
  caseItem,
  stages: initialStages,
  initialStageIndex = 0,
  personaDirectory,
  attemptId,
  initialMessages = [],
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

  const live = useGeminiLive(progress.currentStageIndex, initialMessages);
  const mic = useMicrophone();
  const player = useAudioPlayer();
  const { saveProgress } = useSaveAttempt(attemptId);

  // Tracks whether the most recent disconnect was user-initiated (page
  // navigation, end-session button, persona change) so the auto-reconnect
  // effect can ignore true disconnects. Reset to false at the start of every
  // new connection attempt so genuine network drops still retry.
  // Note: stays at the cleanup-set value while persona is null (init()'s
  // `if (!persona) return;` short-circuits). This is intentional — we only
  // reset once we actually begin a new connection.
  const userInitiatedDisconnectRef = useRef(false);
  const countedMessageIdsRef = useRef<Set<string>>(new Set());
  const currentStage = progress.stages[progress.currentStageIndex];

  // Track whether the stage advance hint has been shown for the current stage
  const hintShownForStageRef = useRef<number>(-1);
  const [showAdvanceHint, setShowAdvanceHint] = useState(false);

  // P1.3: Debounced auto-save on every message change
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeSpentRef = useRef(0);

  // Increment elapsed time every second
  useEffect(() => {
    const timer = setInterval(() => {
      timeSpentRef.current += 1;
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-save messages debounced 2s after last change
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (live.messages.length > 0) {
        saveProgress(progress.currentStageIndex, live.messages, timeSpentRef.current);
      }
    }, 2000);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [live.messages, progress.currentStageIndex, saveProgress]);

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
        userInitiatedDisconnectRef.current = false;
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
      userInitiatedDisconnectRef.current = true;
      live.disconnect();
      hasConnectedRef.current = false;
    };
  }, [persona]);

  // Auto-reconnect on unexpected disconnect
  useEffect(() => {
    if (userInitiatedDisconnectRef.current) return;
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

  // Switch persona when stage changes
  useEffect(() => {
    if (persona && live.status === "connected") {
      live.switchPersona(persona);

      // If switching TO owner persona, send trigger so they speak first
      if (persona.roleKey === "owner") {
        setTimeout(() => {
          if (live.status === "connected") {
            live.sendText("[SYS_TRIGGER]");
          }
        }, 500);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress.currentStageIndex]);

  // P1.5: Record turns using Set<string> of already-counted entry IDs.
  // Only newly seen user messages increment the turn counter, regardless of
  // stage changes (which no longer reset the count).
  useEffect(() => {
    const userMessages = live.messages.filter((m) => m.role === "user");
    for (const msg of userMessages) {
      if (!countedMessageIdsRef.current.has(msg.id)) {
        countedMessageIdsRef.current.add(msg.id);
        progress.recordTurn();
      }
    }
  }, [live.messages, progress]);

  // Auto-advance removed: stages must be advanced explicitly by the user
  // via the advance button. This prevents premature stage jumps and ensures
  // the student has completed meaningful interactions before moving on.

  // Show a hint pointing to the Next Stage button when the student has
  // completed enough turns but hasn't advanced yet. Shows once per stage.
  useEffect(() => {
    if (progress.canAdvance && progress.currentStageIndex !== hintShownForStageRef.current) {
      hintShownForStageRef.current = progress.currentStageIndex;
      setShowAdvanceHint(true);
    }
  }, [progress.canAdvance, progress.currentStageIndex]);

  const handleToggleMic = useCallback(async () => {
    if (mic.isRecording) {
      mic.stop();
    } else {
      await mic.start();
    }
  }, [mic]);

  const handleAdvanceStage = useCallback(() => {
    // P1.3: Save progress on stage advance before switching stage
    saveProgress(progress.currentStageIndex, live.messages, timeSpentRef.current);
    progress.advanceStage();
  }, [progress, saveProgress, live.messages]);

  const handleEndSession = useCallback(async () => {
    // Mark the upcoming disconnect as user-initiated so the auto-reconnect
    // effect bails and we don't burn API quota retrying after End Session.
    userInitiatedDisconnectRef.current = true;
    // Capture messages before disconnect
    const finalMessages = [...live.messages];

    // P1.3+P1.4: Save final progress before disconnecting
    if (finalMessages.length > 0) {
      await saveProgress(progress.currentStageIndex, finalMessages, timeSpentRef.current);
    }

    mic.stop();
    live.disconnect();

    try {
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
          messages: finalMessages,
        }),
      });
    } catch {
      // non-critical
    }

    onSessionEnd?.(finalMessages);
  }, [mic, live, attemptId, progress.currentStageIndex, saveProgress, onSessionEnd]);

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
        messages={live.messages}
        personaName={persona?.displayName ?? "AI"}
        isOpen={true}
      />

      {/* Bottom: Controls */}
      <LiveControls
        status={live.status}
        isRecording={mic.isRecording}
        canAdvance={progress.canAdvance}
        isMuted={isMuted}
        showAdvanceHint={showAdvanceHint}
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
