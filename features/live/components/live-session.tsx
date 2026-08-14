"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Check, Copy, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Case } from "@/features/case-selection/models/case";
import type { Stage } from "@/features/stages/types";
import type { PersonaEntry } from "@/features/chat/hooks/usePersonaDirectory";
import { usePersonaSwitcher } from "../hooks/usePersonaSwitcher";
import { useGeminiLive } from "../hooks/useGeminiLive";
import { useMicrophone } from "../hooks/useMicrophone";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { useLiveProgress } from "../hooks/useLiveProgress";
import { PersonaHeader } from "./persona-header";
import { LiveControls } from "./live-controls";
import { LiveTranscript } from "./live-transcript";
import { LiveProgressSidebar } from "./live-progress-sidebar";
import { Notepad } from "@/features/chat/components/notepad";
import { useSaveAttempt } from "@/features/attempts/hooks/useSaveAttempt";
import {
  copyTranscriptToClipboard,
  exportTranscriptToMarkdown,
  exportTranscriptToText,
} from "../services/transcriptExport";
import type { LivePersonaDef, LivePersonaRoleKey } from "./live-controls";
import type { TranscriptEntry } from "../types";
import type { Message } from "@/features/chat/models/chat";

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remaining = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remaining}`;
}

function transcriptToMessages(entries: TranscriptEntry[], stageIndex: number, personaName?: string): Message[] {
  return entries.map((entry) => ({
    id: entry.id,
    role: entry.speaker === "user" ? "user" : "assistant",
    content: entry.text,
    timestamp: new Date(entry.timestamp).toISOString(),
    stageIndex,
    displayRole: entry.speaker === "user" ? "You" : personaName ?? "Persona",
    status: "sent" as const,
  }));
}

type LiveSessionProps = {
  caseItem: Case;
  stages: Stage[];
  initialStageIndex?: number;
  personaDirectory: Record<string, PersonaEntry>;
  attemptId: string;
  initialTranscript?: TranscriptEntry[];
  onSessionEnd?: (transcript?: TranscriptEntry[]) => void;
};

export function LiveSession({
  caseItem,
  stages: initialStages,
  initialStageIndex = 0,
  personaDirectory,
  attemptId,
  initialTranscript = [],
  onSessionEnd,
}: LiveSessionProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isTextMode, setIsTextMode] = useState(false);
  const [showNotepad, setShowNotepad] = useState(false);
  const [showAdvanceConfirm, setShowAdvanceConfirm] = useState(false);
  const [personaJoining, setPersonaJoining] = useState<string | null>(null);
  const [isIdle, setIsIdle] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [elapsedDisplay, setElapsedDisplay] = useState("00:00");
  const [guidedMode, setGuidedMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("guided-mode") === "true";
  });
  const timeSpentRef = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousPersonaRoleRef = useRef<string | null>(null);
  const personaMountedRef = useRef(false);
  const lastUserActivityRef = useRef(Date.now());
  const [activePersonaRole, setActivePersonaRole] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");

  const progress = useLiveProgress(initialStages, initialStageIndex);
  const persona = usePersonaSwitcher(
    caseItem,
    progress.stages,
    progress.currentStageIndex,
    personaDirectory,
    activePersonaRole,
  );

  const live = useGeminiLive(initialTranscript);
  const mic = useMicrophone();
  const player = useAudioPlayer();
  const { saveProgress } = useSaveAttempt(attemptId);
  const saveProgressRef = useRef(saveProgress);
  saveProgressRef.current = saveProgress;

  const prevUserTurnCountRef = useRef(0);
  const currentStage = progress.stages[progress.currentStageIndex];
  const nextStage = progress.stages[progress.currentStageIndex + 1] ?? null;

  // Track whether the stage advance hint has been shown for the current stage
  const hintShownForStageRef = useRef<number>(-1);
  const [showAdvanceHint, setShowAdvanceHint] = useState(false);

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

  // Audio is released only after the completed model turn passes the Live
  // response filter. This prevents unsafe disclaimer audio from being spoken.
  useEffect(() => {
    live.setOnAudio((chunks) => {
      player.play(chunks);
    });
  }, [live, player]);

  useEffect(() => {
    const timer = setInterval(() => {
      timeSpentRef.current += 1;
      setElapsedDisplay(formatElapsed(timeSpentRef.current));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!persona) return;
    if (!personaMountedRef.current) {
      personaMountedRef.current = true;
      previousPersonaRoleRef.current = persona.roleKey;
      return;
    }
    if (persona.roleKey === previousPersonaRoleRef.current) return;

    previousPersonaRoleRef.current = persona.roleKey;
    setPersonaJoining(persona.displayName);
    const timer = setTimeout(() => setPersonaJoining(null), 2500);
    return () => clearTimeout(timer);
  }, [persona]);

  useEffect(() => {
    if (live.transcript.some((entry) => entry.speaker === "user")) {
      lastUserActivityRef.current = Date.now();
    }
  }, [live.transcript.length]);

  useEffect(() => {
    const timer = setInterval(() => {
      setIsIdle(
        live.status === "connected" &&
          live.transcript.length > 0 &&
          Date.now() - lastUserActivityRef.current > 30_000,
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [live.status, live.transcript.length]);

  useEffect(() => {
    const handler = () => {
      setGuidedMode(window.localStorage.getItem("guided-mode") === "true");
    };
    window.addEventListener("guided-mode-change", handler);
    return () => window.removeEventListener("guided-mode-change", handler);
  }, []);

  // Persist the current transcript through the existing attempt_messages API.
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (live.transcript.length === 0) return;

    saveTimerRef.current = setTimeout(() => {
      const messages = transcriptToMessages(
        live.transcript,
        progress.currentStageIndex,
        persona?.displayName,
      );
      void saveProgressRef.current(progress.currentStageIndex, messages, timeSpentRef.current);
    }, 1500);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [live.transcript.length, progress.currentStageIndex, persona?.displayName]);

  // Connect when persona becomes available
  const hasConnectedRef = useRef(false);
  const retryCountRef = useRef(0);
  const switchedPersonaRoleRef = useRef<string | null>(null);
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
        switchedPersonaRoleRef.current = persona.roleKey;

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
      // Persona changes are handled by live.switchPersona below; do not tear
      // down the session or erase the transcript on every manual selection.
      cancelled = true;
    };
  }, [persona]);

  // Disconnect only when the Live component is actually unmounted.
  const liveRef = useRef(live);
  const micRef = useRef(mic);
  liveRef.current = live;
  micRef.current = mic;
  useEffect(() => {
    return () => {
      micRef.current.stop();
      liveRef.current.disconnect();
    };
  }, []);

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
        await live.connect(token, persona, { preserveTranscript: true });
        switchedPersonaRoleRef.current = persona.roleKey;
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

  // Switch persona on stage changes and manual avatar selections without
  // recreating the session or clearing the transcript.
  useEffect(() => {
    if (!persona || live.status !== "connected") return;
    if (persona.roleKey === switchedPersonaRoleRef.current) return;

    switchedPersonaRoleRef.current = persona.roleKey;
    live.switchPersona(persona);

    if (persona.roleKey === "owner") {
      setTimeout(() => {
        if (live.status === "connected") live.sendText("[SYS_TRIGGER]");
      }, 500);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona, live.status]);

  // Advancing a stage returns control to that stage's default persona.
  useEffect(() => {
    setActivePersonaRole(null);
    prevUserTurnCountRef.current = 0;
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

  const personaDefs: LivePersonaDef[] = useMemo(() => {
    const createPersona = (roleKey: LivePersonaRoleKey, label: string, fallbackText: string): LivePersonaDef => ({
      roleKey,
      label,
      portraitUrl: personaDirectory[roleKey]?.portraitUrl,
      fallbackText,
      isActive: persona?.roleKey === roleKey,
    });

    return [
      createPersona("owner", "OWNER", "OWN"),
      createPersona("veterinary-nurse", "NURSE", "NUR"),
      createPersona("lab-technician", "LAB", "LAB"),
    ];
  }, [persona?.roleKey, personaDirectory]);

  const handleSelectPersona = useCallback((roleKey: LivePersonaRoleKey) => {
    if (roleKey !== persona?.roleKey) setActivePersonaRole(roleKey);
  }, [persona?.roleKey]);

  const handleToggleMic = useCallback(async () => {
    if (isTextMode) {
      setIsTextMode(false);
      await mic.start();
      return;
    }

    if (mic.isRecording) {
      mic.stop();
      setIsTextMode(true);
      return;
    }

    await mic.start();
  }, [isTextMode, mic]);

  const handleSendText = useCallback(() => {
    const message = textInput.trim();
    if (!message || !isTextMode) return;

    live.sendText(message);
    setTextInput("");
  }, [isTextMode, live, textInput]);

  const handleAdvanceStage = useCallback(() => {
    if (nextStage && progress.canAdvance) {
      setShowAdvanceConfirm(true);
    }
  }, [nextStage, progress.canAdvance]);

  const handleConfirmAdvance = useCallback(() => {
    setShowAdvanceConfirm(false);
    const messages = transcriptToMessages(live.transcript, progress.currentStageIndex, persona?.displayName);
    void saveProgressRef.current(progress.currentStageIndex, messages, timeSpentRef.current);
    progress.advanceStage();
  }, [live.transcript, persona?.displayName, progress]);

  const handleEndSession = useCallback(async () => {
    // Capture transcript before disconnect (disconnect does NOT clear it,
    // but capture early for safety)
    const finalTranscript = [...live.transcript];
    const finalMessages = transcriptToMessages(finalTranscript, progress.currentStageIndex, persona?.displayName);
    if (finalMessages.length > 0) {
      await saveProgressRef.current(progress.currentStageIndex, finalMessages, timeSpentRef.current);
    }

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

    onSessionEnd?.(finalTranscript);
  }, [mic, live, attemptId, progress.currentStageIndex, persona?.displayName, onSessionEnd]);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
    if (!isMuted) {
      player.stop();
    }
  }, [isMuted, player]);

  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showExportMenu) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showExportMenu]);

  const handleExportMarkdown = useCallback(() => {
    exportTranscriptToMarkdown(live.transcript);
    setShowExportMenu(false);
  }, [live.transcript]);

  const handleExportText = useCallback(() => {
    exportTranscriptToText(live.transcript);
    setShowExportMenu(false);
  }, [live.transcript]);

  const handleCopyTranscript = useCallback(async () => {
    await copyTranscriptToClipboard(live.transcript);
    setCopied(true);
    setShowExportMenu(false);
    setTimeout(() => setCopied(false), 2000);
  }, [live.transcript]);

  const waveformMode = live.isSpeaking
    ? "speaking" as const
    : mic.isRecording
      ? "listening" as const
      : "idle" as const;

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-background">
      <div className="hidden h-full w-[240px] shrink-0 md:block lg:w-[250px]">
        <LiveProgressSidebar
          caseItem={caseItem}
          stages={progress.stages}
          currentStageIndex={progress.currentStageIndex}
          onStageSelect={(index) => progress.setStageIndex(index)}
          guidedMode={guidedMode}
        />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
        {personaJoining && (
          <div className="flex items-center justify-center bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
            {personaJoining} is joining...
          </div>
        )}

        {isIdle && (
          <div className="mx-3 mt-2 rounded-md bg-amber-50 px-3 py-1.5 text-center text-xs text-amber-700 dark:bg-amber-950/20 dark:text-amber-300 sm:mx-4">
            Still connected, waiting for you...
          </div>
        )}

        {/* Top: Persona header */}
        <div className="shrink-0">
          <PersonaHeader
            persona={persona}
            stageTitle={currentStage?.title ?? ""}
            isSpeaking={live.isSpeaking}
            waveformMode={waveformMode}
          />
        </div>

        {/* Session tools */}
        <div className="flex shrink-0 items-center justify-end gap-1 px-3 pb-1 sm:px-4">
          <div ref={exportMenuRef} className="relative">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowExportMenu((previous) => !previous)}
              disabled={live.transcript.length === 0}
              className="h-8 w-8 rounded-full"
              title="Export transcript"
              aria-label="Export transcript"
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Download className="h-4 w-4" />}
            </Button>
            {showExportMenu && (
              <div className="absolute right-0 top-9 z-20 w-44 rounded-md border bg-popover p-1 shadow-md">
                <button type="button" onClick={handleExportMarkdown} className="block w-full rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent">
                  Download Markdown
                </button>
                <button type="button" onClick={handleExportText} className="block w-full rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent">
                  Download text
                </button>
                <button type="button" onClick={handleCopyTranscript} className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent">
                  <Copy className="mr-2 h-3 w-3" /> Copy transcript
                </button>
              </div>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowNotepad((previous) => !previous)}
            className="h-8 w-8 rounded-full"
            title="Clinical notes"
            aria-label="Clinical notes"
          >
            <FileText className="h-4 w-4" />
          </Button>
        </div>

        {/* Transcript */}
        <LiveTranscript
          entries={live.transcript}
          personaName={persona?.displayName ?? "AI"}
          isOpen={true}
        />

        {/* Stage advance confirmation */}
        {showAdvanceConfirm && nextStage && (
          <div className="mx-3 mb-2 rounded-lg border border-yellow-400/50 bg-yellow-50 p-3 dark:bg-yellow-950/20 sm:mx-4">
            <p className="mb-2 text-sm text-yellow-800 dark:text-yellow-200">
              Are you ready to finish with <strong>{persona?.displayName ?? "this persona"}</strong> and advance to <strong>{nextStage.title}</strong>?
            </p>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={handleConfirmAdvance} className="bg-yellow-500 text-xs text-white hover:bg-yellow-600">
                Yes, advance
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowAdvanceConfirm(false)} className="text-xs">
                Stay
              </Button>
            </div>
          </div>
        )}

        {/* Bottom: Controls */}
      <div className="min-h-0 max-h-[42vh] shrink-0 overflow-y-auto">
      <LiveControls
        status={live.status}
        isRecording={mic.isRecording}
        isSpeaking={live.isSpeaking}
        isTextMode={isTextMode}
        textInput={textInput}
        canAdvance={progress.canAdvance}
        isMuted={isMuted}
        showAdvanceHint={showAdvanceHint}
        elapsedTime={elapsedDisplay}
        personas={personaDefs}
        onToggleMic={handleToggleMic}
        onSelectPersona={handleSelectPersona}
        onTextInputChange={setTextInput}
        onSendText={handleSendText}
        onAdvanceStage={handleAdvanceStage}
        onEndSession={handleEndSession}
        onToggleMute={handleToggleMute}
      />
      </div>

      {/* Error / status display */}
      {live.error && (
        <div className="mx-4 mb-2 shrink-0 rounded-lg bg-red-50 p-2 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
          {live.error}
        </div>
      )}
      {!live.error && live.status === "disconnected" && retryCountRef.current >= 3 && (
        <div className="mx-4 mb-2 shrink-0 rounded-lg bg-amber-50 p-2 text-sm text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
          Connection lost. Tap the mic to retry or end the session.
        </div>
      )}
        </div>

        <Notepad
          isOpen={showNotepad}
          onClose={() => setShowNotepad(false)}
          caseId={caseItem.id}
          attemptId={attemptId}
        />
    </div>
  );
}
