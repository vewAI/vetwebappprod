"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
import { PersonaTabs } from "@/features/chat/components/PersonaTabs";
import type { PersonaTabDef, LivePersonaKey } from "@/features/chat/components/PersonaTabs";
import { AudioWaveform } from "./audio-waveform";
import { LiveControls } from "./live-controls";
import { ProgressSidebar } from "@/features/chat/components/progress-sidebar";
import { LiveTranscript } from "./live-transcript";
import { Notepad } from "@/features/chat/components/notepad";
import { emitStageEvaluation } from "@/features/chat/utils/stage-eval";
import type { AllowedChatPersonaKey } from "@/features/chat/utils/persona-guardrails";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

type LiveSessionProps = {
  caseItem: Case;
  stages: Stage[];
  initialStageIndex?: number;
  personaDirectory: Record<string, PersonaEntry>;
  attemptId: string;
  initialMessages?: Message[];
  onSessionEnd?: (messages?: Message[]) => void;
};

const ALL_LIVE_PERSONA_KEYS: LivePersonaKey[] = [
  "owner",
  "veterinary-nurse",
  "lab-technician",
];

function getPersonaLabel(key: string): string {
  if (key === "owner") return "OWNER";
  if (key === "veterinary-nurse") return "NURSE";
  if (key === "lab-technician") return "LAB";
  return key.toUpperCase();
}

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
  const [showNotepad, setShowNotepad] = useState(false);
  const [filterPersona, setFilterPersona] = useState<string | null>(null);

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

  const userInitiatedDisconnectRef = useRef(false);
  const countedMessageIdsRef = useRef<Set<string>>(new Set());
  const currentStage = progress.stages[progress.currentStageIndex];

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

  // P2.6: Stage completion evaluation using shared STAGE_COMPLETION_RULES
  const stageEval = useMemo(() => {
    return emitStageEvaluation(caseItem.id, progress.currentStageIndex, live.messages);
  }, [caseItem.id, progress.currentStageIndex, live.messages]);

  const canAdvanceEval = stageEval?.status === "ready" || progress.canAdvance;

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
  useEffect(() => {
    const userMessages = live.messages.filter((m) => m.role === "user");
    for (const msg of userMessages) {
      if (!countedMessageIdsRef.current.has(msg.id)) {
        countedMessageIdsRef.current.add(msg.id);
        progress.recordTurn();
      }
    }
  }, [live.messages, progress]);

  // Show advance hint once per stage
  useEffect(() => {
    if (canAdvanceEval && progress.currentStageIndex !== hintShownForStageRef.current) {
      hintShownForStageRef.current = progress.currentStageIndex;
      setShowAdvanceHint(true);
    }
  }, [canAdvanceEval, progress.currentStageIndex]);

  const handleToggleMic = useCallback(async () => {
    if (mic.isRecording) {
      mic.stop();
    } else {
      await mic.start();
    }
  }, [mic]);

  const handleAdvanceStage = useCallback(() => {
    saveProgress(progress.currentStageIndex, live.messages, timeSpentRef.current);
    progress.advanceStage();
  }, [progress, saveProgress, live.messages]);

  const handleEndSession = useCallback(async () => {
    userInitiatedDisconnectRef.current = true;
    const finalMessages = [...live.messages];

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

  // P2.1: Build persona tabs for all three roles
  const activePersonaRole = persona?.roleKey ?? "owner";
  const personaTabs: PersonaTabDef[] = useMemo(() => {
    const currentStagePersonaRole = persona?.roleKey;
    return ALL_LIVE_PERSONA_KEYS.map((key) => ({
      key,
      label: getPersonaLabel(key),
      disabled: key !== currentStagePersonaRole,
      disabledReason:
        key !== currentStagePersonaRole
          ? `Switch to ${getPersonaLabel(key)} stage to address`
          : undefined,
      isSpeaking:
        live.isSpeaking &&
        live.currentPersona?.roleKey === key &&
        key !== currentStagePersonaRole,
    }));
  }, [persona?.roleKey, live.isSpeaking, live.currentPersona]);

  // P2.3: Handle persona tab change — update filterPersona for transcript filtering
  const handlePersonaTabChange = useCallback(
    (key: string) => {
      setFilterPersona((prev) => (prev === key ? null : key));
    },
    []
  );

  const waveformMode = live.isSpeaking
    ? ("speaking" as const)
    : mic.isRecording
      ? ("listening" as const)
      : ("idle" as const);

  return (
    <div className="flex h-full bg-background">
      {/* P2.5: Progress Sidebar (replaces LiveStageProgress pills) */}
      <ProgressSidebar
        caseItem={caseItem}
        stages={progress.stages}
        currentStageIndex={progress.currentStageIndex}
        onStageSelect={(index) => {
          // Only allow going back to completed stages
          if (index <= progress.currentStageIndex) {
            progress.setStageIndex(index);
          }
        }}
      />

      {/* Main content area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top: Persona header */}
        <PersonaHeader
          persona={persona}
          stageTitle={currentStage?.title ?? ""}
          isSpeaking={live.isSpeaking}
        />

        {/* P2.1: Persona Tabs */}
        <div className="px-4">
          <PersonaTabs
            activePersona={activePersonaRole as AllowedChatPersonaKey}
            onChange={handlePersonaTabChange}
            extendedTabs={personaTabs}
          />
        </div>

        {/* Center: Flexible area with waveform OR transcript */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Waveform visualization (compact when transcript expanded) */}
          <div className="flex-shrink-0 flex items-center justify-center px-4 py-2">
            <AudioWaveform
              isActive={live.status === "connected"}
              mode={waveformMode}
              className="h-24 w-full max-w-xs"
            />
          </div>

          {/* P2.2: Scrollable chat history with ChatMessage */}
          <LiveTranscript
            messages={live.messages}
            isOpen={true}
            stages={progress.stages}
            filterPersona={filterPersona}
          />
        </div>

        {/* Bottom: Controls */}
        <div className="relative">
          {/* P2.4: Notepad toggle button */}
          <div className="absolute right-4 top-2 z-10">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowNotepad((prev) => !prev)}
              className="h-9 w-9 rounded-full"
              title="Clinical Notes"
            >
              <FileText className="h-4 w-4" />
            </Button>
          </div>

          <LiveControls
            status={live.status}
            isRecording={mic.isRecording}
            canAdvance={canAdvanceEval}
            isMuted={isMuted}
            showAdvanceHint={showAdvanceHint}
            onToggleMic={handleToggleMic}
            onInterrupt={live.interrupt}
            onAdvanceStage={handleAdvanceStage}
            onEndSession={handleEndSession}
            onToggleMute={handleToggleMute}
          />
        </div>

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

      {/* P2.4: Notepad overlay */}
      <Notepad
        isOpen={showNotepad}
        onClose={() => setShowNotepad(false)}
        caseId={caseItem.id}
        attemptId={attemptId}
      />
    </div>
  );
}
