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
import { AudioWaveform } from "./audio-waveform";
import type { LivePersonaDef, LivePersonaRoleKey } from "./live-controls";
import { LiveControls } from "./live-controls";
import { ProgressSidebar } from "@/features/chat/components/progress-sidebar";
import { LiveTranscript } from "./live-transcript";
import { TestResultsPanel, type RevealedFinding } from "./test-results-panel";
import { Notepad } from "@/features/chat/components/notepad";
import { emitStageEvaluation } from "@/features/chat/utils/stage-eval";
import {
  exportTranscriptToMarkdown,
  exportTranscriptToText,
  copyTranscriptToClipboard,
} from "../services/transcriptExport";
import { buildConversationContext } from "../utils/conversationContext";
import { Button } from "@/components/ui/button";
import { FileText, Download, Copy, Check } from "lucide-react";

type LiveSessionProps = {
  caseItem: Case;
  stages: Stage[];
  initialStageIndex?: number;
  personaDirectory: Record<string, PersonaEntry>;
  attemptId: string;
  initialMessages?: Message[];
  initialTimeSpentSeconds?: number;
  onSessionEnd?: (messages?: Message[]) => void;
};

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// First-person transition phrases matched against the NEXT stage's type.
// Deliberately requires an explicit action phrasing so mentions like
// "when would you do a physical exam?" do NOT trigger an advance.
const STAGE_INTENT_PATTERNS: Record<string, RegExp> = {
  history:
    /\b(?:let'?s|let us|we'?ll|we should|i'?d like to|i want to|i would like to|time to|move on to|proceed to|start|begin|go back to)\b[^.?!]*\b(?:history|anamnesis|background)\b/i,
  physical:
    /\b(?:let'?s|let us|we'?ll|we should|i'?d like to|i want to|i would like to|time to|move on to|proceed to|start|begin|perform|do)\b[^.?!]*\b(?:physical|exam|examination|auscultat|palpat)\b/i,
  diagnostic:
    /\b(?:let'?s|let us|we'?ll|we should|i'?d like to|i want to|i would like to|time to|move on to|proceed to|start|begin|work on|form)\b[^.?!]*\b(?:differential|diagnos|diagnostic|plan)\b/i,
  laboratory:
    /\b(?:let'?s|let us|we'?ll|we should|i'?d like to|i want to|i would like to|time to|move on to|proceed to|start|begin|run|order|send|do)\b[^.?!]*\b(?:lab|laboratory|blood ?work|bloods?\b|tests?|sampling|samples?)\b/i,
  treatment:
    /\b(?:let'?s|let us|we'?ll|we should|i'?d like to|i want to|i would like to|time to|move on to|proceed to|start|begin|formulate|do)\b[^.?!]*\b(?:treatment|therap|medicat|prescri|plan)\b/i,
  communication:
    /\b(?:let'?s|let us|we'?ll|we should|i'?d like to|i want to|i would like to|time to|move on to|proceed to|start|begin)\b[^.?!]*\b(?:client|owner|communicat|explaining|explain|discharge|conversation)\b/i,
};

export function LiveSession({
  caseItem,
  stages: initialStages,
  initialStageIndex = 0,
  personaDirectory,
  attemptId,
  initialMessages = [],
  initialTimeSpentSeconds = 0,
  onSessionEnd,
}: LiveSessionProps) {
  const [isMuted, setIsMuted] = useState(false);
  // Text mode (ported from live): the mic button toggles between speaking and
  // writing so students can switch input modality mid-interview.
  const [isTextMode, setIsTextMode] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [showNotepad, setShowNotepad] = useState(false);
  // Manual persona override (null = follow the current stage's persona).
  const [activePersonaRole, setActivePersonaRole] = useState<string | null>(null);

  // P3.4: Stage-advance confirmation
  const [showAdvanceConfirm, setShowAdvanceConfirm] = useState(false);

  // P3.5: Persona incoming visual
  const [personaJoining, setPersonaJoining] = useState<string | null>(null);

  // P3.6: Export state
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  // P3.7: Guided mode
  const [guidedMode, setGuidedMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("guided-mode") === "true";
    }
    return false;
  });

  const progress = useLiveProgress(initialStages, initialStageIndex);
  const persona = usePersonaSwitcher(
    caseItem,
    progress.stages,
    progress.currentStageIndex,
    personaDirectory,
    activePersonaRole
  );

  const live = useGeminiLive(progress.currentStageIndex, initialMessages);
  const mic = useMicrophone();
  const player = useAudioPlayer();
  const { saveProgress } = useSaveAttempt(attemptId);

  const userInitiatedDisconnectRef = useRef(false);
  // Startup failure (token fetch / connect) surfaced to the UI instead of
  // leaving the session silently stuck on "Disconnected".
  const [initError, setInitError] = useState<string | null>(null);
  const [initRetryNonce, setInitRetryNonce] = useState(0);
  const currentStage = progress.stages[progress.currentStageIndex];
  const nextStage =
    progress.currentStageIndex < progress.stages.length - 1
      ? progress.stages[progress.currentStageIndex + 1]
      : null;

  const hintShownForStageRef = useRef<number>(-1);
  const [showAdvanceHint, setShowAdvanceHint] = useState(false);

  // P3.8: Session timer
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeSpentRef = useRef(initialTimeSpentSeconds);
  const lastUserMessageTimeRef = useRef(Date.now());

  // Restores the accumulated time when resuming a session.
  const [elapsedDisplay, setElapsedDisplay] = useState(() =>
    formatElapsed(initialTimeSpentSeconds)
  );
  useEffect(() => {
    const timer = setInterval(() => {
      timeSpentRef.current += 1;
      setElapsedDisplay(formatElapsed(timeSpentRef.current));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // P3.7: Listen for guided mode changes from other tabs/components
  useEffect(() => {
    const handler = () => {
      setGuidedMode(localStorage.getItem("guided-mode") === "true");
    };
    window.addEventListener("guided-mode-change", handler);
    return () => window.removeEventListener("guided-mode-change", handler);
  }, []);

  // Track last user message time for idle detection
  useEffect(() => {
    const userMsgs = live.messages.filter((m) => m.role === "user");
    if (userMsgs.length > 0) {
      lastUserMessageTimeRef.current = Date.now();
    }
  }, [live.messages]);

  // Mirror of the assistant message count so delayed greeting nudges can
  // check whether the persona already started speaking on its own.
  const assistantCountRef = useRef(0);
  useEffect(() => {
    assistantCountRef.current = live.messages.filter((m) => m.role !== "user").length;
  }, [live.messages]);

  // Test results panel: whenever the user asks for an exam value or lab test,
  // the server reveals ONLY those values (on-demand) and they become available
  // as written text in the panel.
  const [revealedFindings, setRevealedFindings] = useState<RevealedFinding[]>([]);
  const findingsProcessedIdRef = useRef<string | null>(null);
  useEffect(() => {
    const userMsgs = live.messages.filter((m) => m.role === "user");
    const last = userMsgs[userMsgs.length - 1];
    if (!last || findingsProcessedIdRef.current === last.id) return;
    findingsProcessedIdRef.current = last.id;

    let cancelled = false;
    const userText = last.content;
    // Include what the persona just said so the server can reveal every
    // finding the persona verbalized (free speech → stored findings lines).
    const assistantMsgs = live.messages.filter((m) => m.role !== "user");
    const assistantText = assistantMsgs[assistantMsgs.length - 1]?.content ?? "";
    void (async () => {
      try {
        const accessToken = await getAccessToken().catch(() => null);
        const res = await fetch("/api/live/findings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({ caseId: caseItem.id, userText, assistantText }),
        });
        if (!res.ok) return;
        const data = await res.json();
        const items = Array.isArray(data.items) ? data.items : [];
        if (cancelled || items.length === 0) return;
        setRevealedFindings((prev) => {
          const known = new Set(prev.map((f) => f.key));
          const fresh = items
            .filter((it: RevealedFinding) => it?.key && !known.has(it.key))
            .map((it: RevealedFinding) => ({ ...it, revealedAt: Date.now() }));
          return fresh.length > 0 ? [...prev, ...fresh] : prev;
        });
      } catch {
        // non-critical: panel stays as-is
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [live.messages, caseItem.id]);

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

  // P2.6: Stage completion evaluation
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

  // Wire live audio output to player (streaming per chunk for low latency)
  useEffect(() => {
    live.setOnAudio((chunk) => {
      player.enqueue(chunk);
    });
  }, [live, player]);

  // Barge-in: when the model is interrupted, drop any audio still queued
  // locally so the cut-off turn stops sounding immediately.
  useEffect(() => {
    live.setOnInterrupted(() => {
      player.stop();
    });
  }, [live, player]);

  // Connect when persona becomes available
  const hasConnectedRef = useRef(false);
  const retryCountRef = useRef(0);
  useEffect(() => {
    if (!persona) return;
    // If a previous attempt was aborted (e.g. persona changed while the token
    // fetch was in flight) and the session never connected, allow a fresh one.
    if (hasConnectedRef.current && live.status === "idle") {
      hasConnectedRef.current = false;
    }
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

        await mic.start();

        // F2.1: If this is a resumed session, replay the persisted transcript
        // so the model keeps continuity instead of starting from zero; only
        // greet with the owner trigger on a truly fresh session.
        if (live.messages.length > 0) {
          live.sendContext(buildConversationContext(live.messages));
        } else if (persona.roleKey === "owner") {
          // The model often opens spontaneously; nudge with the trigger only
          // if it hasn't spoken after a grace period (prevents the double
          // greeting: spontaneous + triggered).
          const countAtConnect = assistantCountRef.current;
          setTimeout(() => {
            if (live.status === "connected" && assistantCountRef.current === countAtConnect) {
              live.sendText("[SYS_TRIGGER]");
            }
          }, 4500);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[Session] Init failed:", err);
          hasConnectedRef.current = false;
          setInitError(err instanceof Error ? err.message : "Failed to start the session. Please reload and try again.");
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      // No teardown here: persona changes (stage advance or manual switch) are
      // handled by switchPersona below, and the hooks tear down on unmount.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona, live.status, initRetryNonce]);

  // Stop auto-reconnect after unmount (end session / navigate away)
  useEffect(() => {
    return () => {
      userInitiatedDisconnectRef.current = true;
    };
  }, []);

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
        // F2.1: Restore continuity after an unexpected disconnect by replaying
        // the conversation so far; skip the greeting trigger (the session is
        // not starting over).
        if (live.messages.length > 0) {
          live.sendContext(buildConversationContext(live.messages));
        } else if (persona.roleKey === "owner") {
          live.sendText("[SYS_TRIGGER]");
        }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.status, persona]);

  // P3.5: Show persona joining visual on stage change (skip initial mount)
  const prevPersonaRoleRef = useRef<string | null>(null);
  const hasMountedPersonaRef = useRef(false);
  useEffect(() => {
    if (persona) {
      if (!hasMountedPersonaRef.current) {
        // First persona assignment — don't show joining banner
        hasMountedPersonaRef.current = true;
        prevPersonaRoleRef.current = persona.roleKey;
        return;
      }
      if (persona.roleKey !== prevPersonaRoleRef.current) {
        const newName = persona.displayName;
        setPersonaJoining(newName);
        prevPersonaRoleRef.current = persona.roleKey;
        const t = setTimeout(() => setPersonaJoining(null), 2500);
        return () => clearTimeout(t);
      }
    }
  }, [persona]);

  // Switch persona whenever the effective persona changes: on stage advance AND
  // on manual OWNER↔NURSE↔LAB switches (override is reset on stage change).
  const switchedPersonaRoleRef = useRef<string | null>(null);
  // Set when the stage index changes so the incoming persona (any role) opens
  // the conversation, not just when the owner joins.
  const stageAdvancePendingRef = useRef(false);
  const prevStageIndexRef = useRef(initialStageIndex);
  useEffect(() => {
    if (progress.currentStageIndex !== prevStageIndexRef.current) {
      prevStageIndexRef.current = progress.currentStageIndex;
      stageAdvancePendingRef.current = true;
    }
  }, [progress.currentStageIndex]);

  useEffect(() => {
    if (!persona) return;
    if (persona.roleKey === switchedPersonaRoleRef.current) return;

    if (live.status === "connected") {
      // Commit the switch only when it actually runs, so a switch requested
      // while reconnecting is retried once the status flips to connected.
      switchedPersonaRoleRef.current = persona.roleKey;
      live.switchPersona(persona);

      const shouldOpen = persona.roleKey === "owner" || stageAdvancePendingRef.current;
      stageAdvancePendingRef.current = false;
      if (shouldOpen) {
        // Same anti-double-greeting guard as the initial connect.
        const countAtSwitch = assistantCountRef.current;
        setTimeout(() => {
          if (live.status === "connected" && assistantCountRef.current === countAtSwitch) {
            live.sendText("[SYS_TRIGGER]");
          }
        }, 2500);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona, live.status]);

  // Reset the manual persona override when advancing to a new stage.
  useEffect(() => {
    setActivePersonaRole(null);
  }, [progress.currentStageIndex]);

  // P1.5 + F2.2: Turn count derived from the transcript. Only user messages
  // belonging to the CURRENT stage count, so resumed sessions don't unlock
  // "Next Stage" with historical turns from earlier stages.
  useEffect(() => {
    const stageTurns = live.messages.filter(
      (m) => m.role === "user" && m.stageIndex === progress.currentStageIndex
    ).length;
    progress.syncTurnCount(stageTurns);
  }, [live.messages, progress.currentStageIndex, progress]);

  // Show advance hint once per stage
  useEffect(() => {
    if (canAdvanceEval && progress.currentStageIndex !== hintShownForStageRef.current) {
      hintShownForStageRef.current = progress.currentStageIndex;
      setShowAdvanceHint(true);
    }
  }, [canAdvanceEval, progress.currentStageIndex]);

  // Ported from live: the mic button doubles as a speak/write mode toggle.
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

  // Ported from live: send typed messages through the live session.
  const handleSendText = useCallback(() => {
    const message = textInput.trim();
    if (!message || !isTextMode) return;

    live.sendText(message);
    setTextInput("");
  }, [isTextMode, live, textInput]);

  // P3.4: Stage advance with confirmation
  const handleAdvanceClick = useCallback(() => {
    if (nextStage) {
      setShowAdvanceConfirm(true);
    }
  }, [nextStage]);

  const handleConfirmAdvance = useCallback(() => {
    setShowAdvanceConfirm(false);
    saveProgress(progress.currentStageIndex, live.messages, timeSpentRef.current);
    progress.advanceStage();
  }, [progress, saveProgress, live.messages]);

  const handleCancelAdvance = useCallback(() => {
    setShowAdvanceConfirm(false);
  }, []);

  // Stage-intent auto-advance: when the student explicitly tells the persona
  // they want to move to the NEXT stage (e.g. "let's do the physical
  // examination"), advance immediately, bring the incoming persona into
  // focus, and let them open the conversation.
  const intentProcessedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!nextStage) return;
    const userMsgs = live.messages.filter((m) => m.role === "user");
    const last = userMsgs[userMsgs.length - 1];
    if (!last || intentProcessedIdRef.current === last.id) return;
    intentProcessedIdRef.current = last.id;

    const settings = nextStage.settings as Record<string, unknown> | undefined;
    const stageType = typeof settings?.stage_type === "string" ? settings.stage_type : "";
    const pattern = stageType ? STAGE_INTENT_PATTERNS[stageType] : undefined;
    if (pattern && pattern.test(last.content)) {
      console.log("[Session] Stage intent detected for:", stageType, "->", last.content);
      handleConfirmAdvance();
    }
  }, [live.messages, nextStage, handleConfirmAdvance]);

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
    const next = !isMuted;
    setIsMuted(next);
    player.setMuted(next);
  }, [isMuted, player]);

  // F5.2: Manual barge-in — cut the persona off and drop queued audio.
  const handleInterrupt = useCallback(() => {
    live.interrupt();
    player.stop();
  }, [live, player]);

  // P3.6: Export handlers + click-outside close
  const exportMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showExportMenu) return;
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showExportMenu]);
  const handleExportMarkdown = useCallback(() => {
    exportTranscriptToMarkdown(live.messages);
    setShowExportMenu(false);
  }, [live.messages]);

  const handleExportText = useCallback(() => {
    exportTranscriptToText(live.messages);
    setShowExportMenu(false);
  }, [live.messages]);

  const handleCopyTranscript = useCallback(async () => {
    await copyTranscriptToClipboard(live.messages);
    setCopied(true);
    setShowExportMenu(false);
    setTimeout(() => setCopied(false), 2000);
  }, [live.messages]);

  // Persona defs for the bottom switch area (old TTS/STT interface look)
  const personaDefs: LivePersonaDef[] = useMemo(() => {
    const active = persona?.roleKey;
    const def = (roleKey: LivePersonaRoleKey, label: string, fallbackText: string): LivePersonaDef => ({
      roleKey,
      label,
      portraitUrl: personaDirectory[roleKey]?.portraitUrl,
      fallbackText,
      isActive: active === roleKey,
    });
    return [
      def("owner", "OWNER", "OWN"),
      def("veterinary-nurse", "NURSE", "NUR"),
      def("lab-technician", "LAB", "LAB"),
    ];
  }, [persona?.roleKey, personaDirectory]);

  const handleSelectPersona = useCallback(
    (roleKey: LivePersonaRoleKey) => {
      if (roleKey === persona?.roleKey) return; // already active
      setActivePersonaRole(roleKey);
    },
    [persona?.roleKey]
  );

  const waveformMode = live.isSpeaking
    ? ("speaking" as const)
    : mic.isRecording
      ? ("listening" as const)
      : ("idle" as const);

  // P3.8: Idle detection (no user messages in 30s)
  const isIdle =
    live.status === "connected" &&
    Date.now() - lastUserMessageTimeRef.current > 30_000 &&
    live.messages.length > 0;
  return (
    <div className="flex h-full bg-background">
      {/* P2.5: Progress Sidebar */}
      <ProgressSidebar
        caseItem={caseItem}
        stages={progress.stages}
        currentStageIndex={progress.currentStageIndex}
        onStageSelect={(index) => {
          if (index <= progress.currentStageIndex) {
            progress.setStageIndex(index);
          }
        }}
        guidedMode={guidedMode}
      />

      {/* Main content area */}
      <div className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">
        {/* P3.5: Persona joining banner */}
        {personaJoining && (
          <div className="flex items-center justify-center gap-2 bg-blue-50 dark:bg-blue-950/30 px-4 py-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              {personaJoining} is joining…
            </span>
          </div>
        )}

        {/* Top: Persona header */}
        <div className="flex-shrink-0">
          <PersonaHeader
            persona={persona}
            stageTitle={currentStage?.title ?? ""}
            isSpeaking={live.isSpeaking}
          />
        </div>

        {/* P3.8: Idle indicator */}
        {isIdle && (
          <div className="mx-4 mb-1 rounded-md bg-amber-50 dark:bg-amber-950/20 px-3 py-1.5 text-xs text-amber-600 dark:text-amber-400 text-center animate-in fade-in duration-500">
            Still connected, waiting for you…
          </div>
        )}

        {/* Center: Flexible area */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Waveform */}
          <div className="flex-shrink-0 flex items-center justify-center px-4 py-2">
            <AudioWaveform
              isActive={live.status === "connected"}
              mode={waveformMode}
              className="h-24 w-full max-w-xs"
            />
          </div>

          {/* P2.2: Scrollable chat history */}
          <LiveTranscript
            messages={live.messages}
            isOpen={true}
            stages={progress.stages}
          />
        </div>

        {/* P3.4: Stage advance confirmation banner */}
        {showAdvanceConfirm && nextStage && (
          <div className="mx-4 mb-2 rounded-lg border border-yellow-400/50 bg-yellow-50 dark:bg-yellow-950/20 p-3 animate-in slide-in-from-bottom-2 duration-200">
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
              Did you finish the{" "}
              <strong>{currentStage?.title ?? "current stage"}</strong>?
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleConfirmAdvance}
                className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs"
              >
                Yes, advance to {nextStage.title}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancelAdvance}
                className="text-xs"
              >
                Stay
              </Button>
            </div>
          </div>
        )}

        {/* F5.2: Live caption of the student's in-flight words */}
        {live.pendingInput && (
          <div
            className="mx-4 mb-1 rounded-md bg-primary/5 px-3 py-1.5 text-center text-xs text-muted-foreground animate-in fade-in duration-200"
            aria-live="polite"
          >
            You: {live.pendingInput}
          </div>
        )}

        {/* Bottom: Controls */}
        <div className="relative flex-shrink-0">
          {/* Top-right action buttons */}
          <div className="absolute right-4 top-2 z-10 flex gap-1">
            {/* P3.6: Export button */}
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowExportMenu((prev) => !prev)}
                className="h-9 w-9 rounded-full"
                title="Export transcript"
                disabled={live.messages.length === 0}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </Button>
              {showExportMenu && (
                <div ref={exportMenuRef} className="absolute right-0 top-10 w-48 rounded-md border bg-popover shadow-md z-20 p-1 animate-in fade-in zoom-in-95 duration-150">
                  <button
                    onClick={handleExportMarkdown}
                    className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    Download .md
                  </button>
                  <button
                    onClick={handleExportText}
                    className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    Download .txt
                  </button>
                  <button
                    onClick={handleCopyTranscript}
                    className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <Copy className="mr-2 h-3 w-3" />
                    Copy to clipboard
                  </button>
                </div>
              )}
            </div>

            {/* Test results panel */}
            <TestResultsPanel findings={revealedFindings} />

            {/* P2.4: Notepad toggle */}
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
            isSpeaking={live.isSpeaking}
            isTextMode={isTextMode}
            textInput={textInput}
            canAdvance={canAdvanceEval}
            isMuted={isMuted}
            showAdvanceHint={showAdvanceHint}
            elapsedTime={elapsedDisplay}
            personas={personaDefs}
            onToggleMic={handleToggleMic}
            onSelectPersona={handleSelectPersona}
            onTextInputChange={setTextInput}
            onSendText={handleSendText}
            onAdvanceStage={handleAdvanceClick}
            onEndSession={handleEndSession}
            onToggleMute={handleToggleMute}
            onInterrupt={handleInterrupt}
          />
        </div>

        {/* Error / status display */}
        {initError && (
          <div className="mx-4 mb-4 rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-600 dark:text-red-400">
            {initError}
            <Button
              variant="outline"
              size="sm"
              className="ml-3 h-7"
              onClick={() => {
                setInitError(null);
                setInitRetryNonce((n) => n + 1);
              }}
            >
              Retry
            </Button>
          </div>
        )}
        {live.error && !initError && (
          <div className="mx-4 mb-4 rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-600 dark:text-red-400">
            {live.error}
          </div>
        )}
        {mic.error && !live.error && (
          <div className="mx-4 mb-4 rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-600 dark:text-red-400">
            Microphone error: {mic.error}
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
