"use client";

import type React from "react";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";

import { SendIcon, PenLine, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSTT } from "@/features/speech/hooks/useSTT";
import { useMicButton } from "@/features/speech/hooks/useMicButton";
import { useTTS } from "@/features/speech/hooks/useTTS";

// Nurse acknowledgement phrase used for immediate client-side ack
export const NURSE_ACK = "Let me check that Doc...";
export const NURSE_ACK_TEXT = NURSE_ACK; // Deprecated alias kept for tests backwards-compat

import {
  speakRemote,
  speakRemoteStream,
  stopActiveTtsPlayback,
} from "@/features/speech/services/ttsService";
import { setSttSuppressed, setSttSuppressedFor, isSttSuppressed, enterDeafMode, exitDeafMode, setGlobalPaused, isInDeafMode, canStartListening, scheduleClearSuppressionWhen } from "@/features/speech/services/sttService";
import { isSpeechRecognitionSupported } from "@/features/speech/services/sttService";
import { ChatMessage } from "@/features/chat/components/chat-message";
import { Notepad } from "@/features/chat/components/notepad";
import { useSaveAttempt } from "@/features/attempts/hooks/useSaveAttempt";
import type { Message } from "@/features/chat/models/chat";
import type { Stage } from "@/features/stages/types";
import { getStageTip } from "@/features/stages/services/stageService";
import { chatService } from "@/features/chat/services/chatService";
import {
  getOrAssignVoiceForRole,
  isSupportedVoice,
} from "@/features/speech/services/voiceMap";
import type { TtsEventDetail } from "@/features/speech/models/tts-events";
import {
  classifyChatPersonaLabel,
  isAllowedChatPersonaKey,
  resolveChatPersonaRoleKey,
} from "@/features/chat/utils/persona-guardrails";
import { chooseSafePersonaKey } from "@/features/chat/utils/persona-selection";
import type { AllowedChatPersonaKey } from "@/features/chat/utils/persona-guardrails";
import { useSpeechDevices } from "@/features/speech/context/audio-device-context";
import PersonaTabs from "@/features/chat/components/PersonaTabs";
import { estimateTtsDurationMs } from "@/features/chat/utils/ttsEstimate";
import VoiceModeControl from "@/features/chat/components/VoiceModeControl";
import { AudioDeviceSelector } from "@/features/speech/components/audio-device-selector";
import {
  detectStageIntentLegacy,
  detectStageIntentPhase3,
  type StageIntentContext,
} from "@/features/chat/utils/stage-intent-detector";
import { parseRequestedKeys } from "@/features/chat/services/physFinder";
import { coalesceMessages } from "@/features/chat/utils/messageBundling";
import { transformNurseAssistantMessage as transformNurseAssistantMessageUtil } from "@/features/chat/utils/nurseTransform";
import { endsWithIncompleteMarker } from "@/features/chat/utils/incomplete";
import { detectPersonaSwitch, looksLikeLabRequest, looksLikePhysicalRequest } from "@/features/chat/utils/persona-intent";
import { emitStageEvaluation } from "@/features/chat/utils/stage-eval";
import axios from "axios";
import {
  detectStageReadinessIntent,
  type StageReadinessContext,
  type StageReadinessDetection,
  type StageReadinessIntent,
} from "@/features/chat/utils/stage-readiness-intent";
import { dispatchStageIntentEvent } from "@/features/chat/models/stage-intent-events";
import { debugEventBus } from "@/lib/debug-events-fixed";
import { dispatchStageReadinessEvent } from "@/features/chat/models/stage-readiness-events";
import { useCaseTimepoints } from "@/features/cases/hooks/useCaseTimepoints";
import type { CaseTimepoint } from "@/features/cases/models/caseTimepoint";
import { useAuth } from "@/features/auth/services/authService";
import { HelpTip } from "@/components/ui/help-tip";
import { GuidedTour } from "@/components/ui/guided-tour";
import { FontSizeToggle } from "@/features/navigation/components/font-size-toggle";

import type { CaseMediaItem } from "@/features/cases/models/caseMedia";

const STAGE_KEYWORD_SYNONYMS: Record<string, string[]> = {
  examination: ["exam"],
  exam: ["examination", "assessment"],
  physical: ["exam", "examination", "assessment"],
  history: ["anamnesis", "intake"],
  diagnostic: ["diagnostics", "tests", "testing", "workup"],
  diagnostics: ["diagnostic", "tests", "testing", "workup"],
  laboratory: ["lab", "labwork", "results"],
  lab: ["laboratory", "labwork", "results"],
  owner: ["client", "caretaker", "producer"],
  client: ["owner", "producer"],
  producer: ["owner", "client"],
  communication: ["discussion", "counseling", "consult"],
  follow: ["follow-up", "followup"],
  plan: ["treatment", "management", "strategy"],
};

// Merge two text fragments by avoiding duplicated overlapping words at the
// junction. Returns a string that preserves spacing and avoids repeating
// tokens that appear at the end of `base` and the start of `add`.
function mergeStringsNoDup(base: string | undefined, add: string | undefined): string {
  const b = String(base || "").trim();
  const a = String(add || "").trim();
  if (!b) return a;
  if (!a) return b;
  // Tokenize on whitespace, keep case for display but compare lowercased
  const bWords = b.split(/\s+/);
  const aWords = a.split(/\s+/);
  const maxOverlap = Math.min(bWords.length, aWords.length);
  // Find largest k where last k words of b equal first k words of a (case-insensitive)
  for (let k = maxOverlap; k > 0; k--) {
    const bSlice = bWords.slice(bWords.length - k).join(" ").toLowerCase();
    const aSlice = aWords.slice(0, k).join(" ").toLowerCase();
    if (bSlice === aSlice) {
      const remainder = aWords.slice(k).join(" ");
      return remainder ? `${b} ${remainder}` : b;
    }
  }
  // No overlap found
  return `${b} ${a}`;
}

type StageCompletionRule = {
  minUserTurns?: number;
  minAssistantTurns?: number;
  assistantKeywords?: string[];
  minAssistantKeywordHits?: number;
};

type StageCompletionMetrics = {
  userTurns: number;
  assistantTurns: number;
  matchedAssistantKeywords: number;
};

type StageCompletionResult = {
  status: "ready" | "insufficient";
  metrics: StageCompletionMetrics;
  rule?: StageCompletionRule | null;
};

const PHYSICAL_EXAM_KEYWORDS: string[] = [
  "temperature",
  "temp",
  "pulse",
  "heart rate",
  "cardiovascular",
  "respiratory",
  "breathing",
  "respiration",
  "lung",
  "lungs",
  "auscultation",
  "mucous",
  "membranes",
  "crt",
  "capillary",
  "refill",
  "hydration",
  "lymph",
  "palpation",
  "abdomen",
  "pain",
  "limb",
  "gait",
  "weight",
  "temperature reading",
  "rectal",
  "rectal palpation",
  "rectal exam",
  "nasogastric",
  "nasogastric tube",
  "ng tube",
  "abdominocentesis",
  "abdominal centesis",
];

const STAGE_COMPLETION_RULES: Record<string, StageCompletionRule> = {
  "physical examination": {
    // Make detection more sensitive: single user/assistant turn + single keyword hit
    minUserTurns: 1,
    minAssistantTurns: 1,
    assistantKeywords: PHYSICAL_EXAM_KEYWORDS,
    minAssistantKeywordHits: 1,
  },
};

const ENABLE_PHASE_THREE_STAGE_INTENT =
  process.env.NEXT_PUBLIC_ENABLE_PHASE_THREE_STAGE_INTENT === "true";
const ENABLE_STAGE_READINESS_TELEMETRY =
  process.env.NEXT_PUBLIC_ENABLE_STAGE_READINESS_INTENT === "true";
const STAGE_STAY_BLOCK_WINDOW_MS = 45_000;

const normalizeVoiceId = (voice?: string | null) =>
  voice && isSupportedVoice(voice) ? voice : undefined;


type ChatInterfaceProps = {
  caseId: string;
  attemptId?: string;
  initialMessages?: Message[];
  currentStageIndex: number;
  stages: Stage[];
  onProceedToNextStage: (
    messages?: Message[],
    timeSpentSeconds?: number
  ) => void;
  initialTimeSpentSeconds?: number;
  caseMedia?: CaseMediaItem[];
  followupDay?: number;
};

type PersonaDirectoryEntry = {
  displayName?: string;
  portraitUrl?: string;
  voiceId?: string;
  sex?: string;
};

const resolveDirectoryPersonaKey = (
  raw: string | null | undefined
): string | null => {
  if (!raw) return null;
  if (isAllowedChatPersonaKey(raw)) return raw;
  return classifyChatPersonaLabel(raw);
};

export function ChatInterface({
  caseId,
  attemptId,
  initialMessages = [],
  currentStageIndex,
  stages,
  onProceedToNextStage,
  initialTimeSpentSeconds = 0,
  caseMedia = [],
  followupDay = 1,
}: ChatInterfaceProps) {
  // State for timepoint progression dialog
  const [showTimepointDialog, setShowTimepointDialog] = useState(false);
  const [pendingTimepoint, setPendingTimepoint] = useState<any>(null);
  const awaitingContinuationRef = useRef<{ partial: string; placeholderId: string } | null>(null);
  const [autoSendStt, setAutoSendStt] = useState<boolean>(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem("sttAutoSend") : null;
      if (raw === null) return true;
      return raw === "true";
    } catch {
      return true;
    }
  });
  const autoSendSttRef = useRef<boolean>(autoSendStt);
  useEffect(() => {
    autoSendSttRef.current = autoSendStt;
    try {
      localStorage.setItem("sttAutoSend", autoSendStt ? "true" : "false");
    } catch {
      // ignore
    }
  }, [autoSendStt]);

  // Handlers for dialog actions (implement as no-ops or TODOs for now)
  const handleSnoozeTimepoint = () => setShowTimepointDialog(false);
  const confirmTimepointUnlock = () => setShowTimepointDialog(false);
  const tourSteps = [
    { element: '#chat-messages', popover: { title: 'Conversation History', description: 'Read the dialogue between you and the virtual characters here.' } },
    { element: '#chat-input', popover: { title: 'Input Area', description: 'Type your questions or responses here. You can also use voice input.' } },
    { element: '#send-button', popover: { title: 'Send Message', description: 'Click to send your message to the virtual character.' } },
    { element: '#voice-controls', popover: { title: 'Voice Controls', description: 'Use the mic icon to switch between SPEAK (voice input) and WRITE (typing) modes, and click the speaker icon to toggle text-to-speech playback. The mic mode controls whether your voice is recorded or the composer is used for manual typing.' } },
    { element: '#persona-tabs', popover: { title: 'Persona (Owner / Nurse)', description: 'Switch who you are speaking AS: OWNER or NURSE. Use these buttons to change the character that will answer your next message. You can also change characters by voice — try saying: "May I talk to the nurse"' } },
    { element: '#notepad-toggle', popover: { title: 'Notepad', description: 'Open the notepad to jot down important findings or notes during the case.' } },
  ];

  // Toast for timepoint progression
  const [timepointToast, setTimepointToast] = useState<
    | { title: string; body: string }
    | null
  >(null);
  // Control visibility to allow animate-out before removing the toast
  const [toastVisible, setToastVisible] = useState(false);

  // Check browser speech support
  const [speechSupported, setSpeechSupported] = useState(false);
  useEffect(() => {
    setSpeechSupported(isSpeechRecognitionSupported());
  }, []);

  useEffect(() => {
    if (timepointToast) {
      // show immediately when toast is set
      setToastVisible(true);
    }
  }, [timepointToast]);

  const hideTimepointToastWithFade = (duration = 300) => {
    setToastVisible(false);
    // remove the toast after animation completes
    setTimeout(() => setTimepointToast(null), duration);
  };

  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [caseStageOverrides, setCaseStageOverrides] = useState<Record<string, any>>({});

  // Load case-specific stage overrides (editable via admin panel)
  useEffect(() => {
    if (!caseId) return;
    (async () => {
      try {
        const resp = await fetch(`/api/cases/${encodeURIComponent(caseId)}/stage-settings`);
        const payload = await resp.json().catch(() => ({}));
        const savedOverrides = payload?.stageOverrides || {};
        const coercedOverrides: Record<string, any> = {};
        Object.keys(savedOverrides).forEach((k) => {
          const inc = (savedOverrides as any)[k] || {};
          coercedOverrides[k] = {
            minUserTurns: inc.minUserTurns != null ? Number(inc.minUserTurns) : 1,
            minAssistantTurns: inc.minAssistantTurns != null ? Number(inc.minAssistantTurns) : 1,
            minAssistantKeywordHits: inc.minAssistantKeywordHits != null ? Number(inc.minAssistantKeywordHits) : 1,
            basePrompt: inc.basePrompt != null ? String(inc.basePrompt) : undefined,
            title: inc.title != null ? String(inc.title) : undefined,
            description: inc.description != null ? String(inc.description) : undefined,
          };
        });
        setCaseStageOverrides(coercedOverrides);
      } catch (e) {
        // ignore
      }
    })();
  }, [caseId]);
  // Active persona tab shown in the UI (owner | veterinary-nurse). Default to nurse to match prior UX.
  const [activePersona, setActivePersona] = useState<AllowedChatPersonaKey>("veterinary-nurse");
  // Per-persona draft persistence (in-memory + localStorage per attempt)
  const [personaDrafts, setPersonaDrafts] = useState<Record<AllowedChatPersonaKey, string>>({
    owner: "",
    "veterinary-nurse": "",
  });

  const draftLocalStorageKey = (persona: AllowedChatPersonaKey) => `chat-draft-${attemptId ?? 'noattempt'}-${persona}`;

  // Load persisted drafts when the attemptId changes
  useEffect(() => {
    try {
      const ownerDraft = attemptId ? window.localStorage.getItem(draftLocalStorageKey("owner")) : null;
      const nurseDraft = attemptId ? window.localStorage.getItem(draftLocalStorageKey("veterinary-nurse")) : null;
      setPersonaDrafts({ owner: ownerDraft ?? "", "veterinary-nurse": nurseDraft ?? "" });
    } catch (e) {
      // ignore localStorage failures
    }
  }, [attemptId]);
  // Helper to avoid appending duplicate assistant messages in the recent history
  const normalizeForDedupe = (s?: string | null) =>
    String(s ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  // In-memory set to avoid race-condition duplicates across concurrent append calls.
  const recentAssistantContentSetRef = useRef<Set<string>>(new Set());
  const appendAssistantMessage = (msg: Message) => {
    try {
      const isEphemeral = Boolean((msg as any).ephemeral === true);
      const norm = normalizeForDedupe(msg.content);
      // If this is a non-ephemeral message and we've recently appended the
      // same assistant content, skip to avoid races where multiple appenders
      // add the same message. Ephemeral placeholders should NOT block later
      // real assistant replies, so we don't register them in the recent set.
      if (!isEphemeral && recentAssistantContentSetRef.current.has(norm)) {
        return;
      }
      // Register and schedule removal after 10s to keep set bounded for real messages
      if (!isEphemeral) {
        recentAssistantContentSetRef.current.add(norm);
        window.setTimeout(() => {
          try { recentAssistantContentSetRef.current.delete(norm); } catch {}
        }, 10000);
      }
    } catch {}

    setMessages((prev) => {
      try {
        const recent = prev.slice(-6);
        const norm = normalizeForDedupe(msg.content);
        const role = msg.displayRole ?? msg.role ?? "assistant";
        const duplicate = recent.some((m) => {
          if (m.role !== "assistant") return false;
          const mRole = m.displayRole ?? m.role ?? "assistant";
          if (mRole !== role) return false;
          return normalizeForDedupe(m.content) === norm;
        });
        if (duplicate) return prev;

        // If the previous message is an assistant message from the same
        // persona (same displayRole) and same stage, merge their contents
        // instead of creating a separate message. This keeps consecutive
        // assistant utterances visually integrated. Also, if the previous
        // assistant message was an ephemeral UI placeholder (e.g. nurse ACK),
        // replace it with the real assistant message instead of merging.
        const last = prev.length > 0 ? prev[prev.length - 1] : null;
        if (
          last &&
          last.role === "assistant" &&
          (last.displayRole ?? last.role ?? "assistant") === role &&
          last.stageIndex === msg.stageIndex
        ) {
          try {
            const lastEphemeral = Boolean((last as any).ephemeral === true);
            // If last was ephemeral placeholder, replace it entirely with the
            // real message to ensure the assistant reply is visible.
            if (lastEphemeral) {
              const replaced: Message = {
                ...msg,
                // preserve ordering timestamp from the ephemeral placeholder
                timestamp: last.timestamp || msg.timestamp || new Date().toISOString(),
                status: msg.status === "sent" ? "sent" : last.status,
              } as Message;
              return [...prev.slice(0, -1), replaced];
            }
            const mergedContent = mergeStringsNoDup(last.content, msg.content);
            // merge any structured findings if present (msg shape may have extra fields)
            const lastSF = (last as any).structuredFindings || {};
            const msgSF = (msg as any).structuredFindings || {};
            const mergedSF = { ...lastSF, ...msgSF };
            const merged: Message = {
              ...last,
              content: mergedContent,
              // keep original id/timestamp of first message to preserve ordering
              timestamp: last.timestamp || msg.timestamp || new Date().toISOString(),
              // preserve status as sent (or prefer msg.status if it indicates final)
              status: msg.status === "sent" ? "sent" : last.status,
              // attach merged structured findings permissively
              ...(Object.keys(mergedSF).length ? { structuredFindings: mergedSF } : {}),
            } as Message & { structuredFindings?: any };
            return [...prev.slice(0, -1), merged];
          } catch (e) {
            // fall back to append if merge fails
            return [...prev, msg];
          }
        }
      } catch (e) {
        // ignore dedupe/merge errors
      }
      return [...prev, msg];
    });
  };

  // Initialize active persona from the current stage role when stages change
  useEffect(() => {
    const stage = stages?.[currentStageIndex];
    try {
      const normalized = resolveChatPersonaRoleKey(stage?.role, stage?.role ?? "");
      setActivePersona(normalized);
    } catch (e) {
      // ignore
    }
  }, [currentStageIndex, stages]);

  // Small wrapper to preserve the original signature and pass the live messages array
  const transformNurseAssistantMessage = (
    aiMessage: Message,
    stage: Stage | undefined,
    lastUserText?: string
  ): { message: Message; allowTts: boolean } => transformNurseAssistantMessageUtil(aiMessage, stage, lastUserText, messages);
  const { timepoints } = useCaseTimepoints(caseId);
  const latestInitialMessagesRef = useRef<Message[]>(initialMessages ?? []);
  const lastHydratedAttemptKeyRef = useRef<string | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [connectionNotice, setConnectionNotice] = useState<string | null>(null);
  // Notepad visibility tracked per persona so dialogs are independent per active persona
  const [showNotepadByPersona, setShowNotepadByPersona] = useState<Record<AllowedChatPersonaKey, boolean>>({ owner: false, "veterinary-nurse": false });
  const [timeSpentSeconds, setTimeSpentSeconds] = useState(initialTimeSpentSeconds);
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(
    () => Boolean(attemptId) || true
  );
  // When true, the assistant will speak first and the message text will only
  // appear after the voice playback completes. This helps focus attention on
  // the audio but may cause users to read ahead ��� make it optional.
  const [voiceFirst, setVoiceFirst] = useState<boolean>(
    () => Boolean(attemptId) || true
  );
  // Voice Mode (mic) should default ON when an attempt is open; otherwise off.
  const [voiceMode, setVoiceMode] = useState<boolean>(() => Boolean(attemptId));

  // Auto-save (throttled) — keeps the existing delete+insert server behavior
  const { saveProgress } = useSaveAttempt(attemptId);
  const lastSavedAtRef = useRef<number>(0);
  const lastSavedSnapshotRef = useRef<string>("");

  const [isPaused, setIsPaused] = useState(false);
  // Start overlay (SPEAK / WRITE / LEARN) should be visible by default in all environments.
  // Previously this was gated by NEXT_PUBLIC_SANDBOX_VOICE_UI; we enable it for production use.
  const [showStartSpeakingPrompt, setShowStartSpeakingPrompt] = useState<boolean>(true);

  const hideIntroToast = useCallback(() => {
    // Fade out intro toast then remove from DOM after transition
    try { setShowIntroToast(false); } catch (e) {}
    try { window.setTimeout(() => setIntroMounted(false), 800); } catch (e) {}
  }, []);

  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  // Lightweight toast for mic/noise status
  const [micToast, setMicToast] = useState<string | null>(null);
  const micToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showMicToast = useCallback((msg: string, durationMs = 2000) => {
    if (micToastTimeoutRef.current) clearTimeout(micToastTimeoutRef.current);
    setMicToast(msg);
    micToastTimeoutRef.current = setTimeout(() => setMicToast(null), durationMs);
  }, []);
  const { role } = useAuth();
  const [startSequenceActive, setStartSequenceActive] = useState(false);
  const [personaDirectory, setPersonaDirectory] = useState<
    Record<string, PersonaDirectoryEntry>
  >({});
  const personaDirectoryRef = useRef<Record<string, PersonaDirectoryEntry>>({});
  useEffect(() => {
    personaDirectoryRef.current = personaDirectory;
  }, [personaDirectory]);

  const voiceModeRef = useRef(voiceMode);
  
  // Noise detection state for ambient sound suppression
  const [noiseLevel, setNoiseLevel] = useState<number>(0);
  const [noiseSuppression, setNoiseSuppression] = useState<boolean>(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const noiseStreamRef = useRef<MediaStream | null>(null);
  const noiseCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Note: Noise detection effect is defined below after isListening is available from useSTT
  
  useEffect(() => {
    voiceModeRef.current = voiceMode;
  }, [voiceMode]);

  const ttsEnabledRef = useRef(ttsEnabled);
  useEffect(() => {
    ttsEnabledRef.current = ttsEnabled;
  }, [ttsEnabled]);

  const {
    inputDevices,
    selectedInputId,
    permissionError,
    isSupported: audioDevicesSupported,
  } = useSpeechDevices();
  const [audioNotice, setAudioNotice] = useState<string | null>(null);

  const personaDirectoryResolveRef = useRef<(() => void) | null>(null);
  const personaDirectoryReadyPromiseRef = useRef<Promise<void> | null>(null);

  const resetPersonaDirectoryReady = useCallback(() => {
    personaDirectoryReadyPromiseRef.current = new Promise<void>((resolve) => {
      personaDirectoryResolveRef.current = resolve;
    });
  }, []);

  const resolvePersonaDirectoryReady = useCallback(() => {
    if (personaDirectoryResolveRef.current) {
      personaDirectoryResolveRef.current();
      personaDirectoryResolveRef.current = null;
    }
  }, []);
  const [stageIndicator, setStageIndicator] = useState<
    { title: string; body: string } | null
  >(null);
  const [advanceGuard, setAdvanceGuard] = useState<
    { stageIndex: number; askedAt: number; metrics: StageCompletionMetrics } | null
  >(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`advanceGuard-${attemptId}`);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.warn("Failed to parse saved advanceGuard", e);
        }
      }
    }
    return null;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (advanceGuard) {
        localStorage.setItem(
          `advanceGuard-${attemptId}`,
          JSON.stringify(advanceGuard)
        );
      } else {
        localStorage.removeItem(`advanceGuard-${attemptId}`);
      }
    }
  }, [advanceGuard, attemptId]);

  // Paper search state
  const [paperSearchLoading, setPaperSearchLoading] = useState(false);
  const [paperSearchResults, setPaperSearchResults] = useState<any[] | null>(null);

  const runPaperSearch = async (q: string) => {
    if (!q || q.trim().length === 0) return;
    if (!caseId) return;
    setPaperSearchLoading(true);
    try {
      const resp = await axios.post(`/api/cases/${encodeURIComponent(caseId)}/papers/query`, { query: q });
      const respData = resp.data as any ?? {};
      setPaperSearchResults(respData.results ?? []);
      // if results have summaries, append as assistant message
      if (Array.isArray(respData.results) && respData.results.length > 0) {
        const best = respData.results[0];
        const assistantMsg: Message = {
          id: `paper-sum-${Date.now()}`,
          role: "assistant",
          content: best.summary ? `Reference summary: ${best.summary}` : `Found ${respData.results.length} paper(s).`,
          timestamp: new Date().toISOString(),
          stageIndex: currentStageIndex,
          displayRole: "Reference",
          status: "sent",
        };
        appendAssistantMessage(assistantMsg);
      }
    } catch (err) {
      console.error("Paper search failed", err);
    } finally {
      setPaperSearchLoading(false);
    }
  };
  const ensurePersonaMetadata = useCallback(
    async (roleKey: string | null | undefined) => {
      if (!roleKey) return undefined;
      const existing = personaDirectoryRef.current[roleKey];
      if (existing) return existing;
      if (personaDirectoryReadyPromiseRef.current) {
        try {
          await personaDirectoryReadyPromiseRef.current;
        } catch (e) {
          console.warn("Persona directory wait failed", e);
        }
      }
      return personaDirectoryRef.current[roleKey];
    },
    []
  );
  const stageKeywordSets = useMemo(() => {
    return stages.map((stage, index) => {
      const keywords = new Set<string>();

      const addLabel = (label?: string | null) => {
        if (!label) return;
        const normalized = label.toLowerCase().trim();
        if (!normalized) return;
        keywords.add(normalized);

        const tokens = normalized
          .split(/[^a-z0-9]+/)
          .filter((token) => token.length >= 3);

        tokens.forEach((token) => {
          keywords.add(token);
          const synonyms = STAGE_KEYWORD_SYNONYMS[token];
          if (synonyms) {
            synonyms.forEach((syn) => {
              if (syn) {
                keywords.add(syn.toLowerCase());
              }
            });
          }
        });

        for (let i = 0; i < tokens.length - 1; i++) {
          const pair = `${tokens[i]} ${tokens[i + 1]}`.trim();
          if (pair) {
            keywords.add(pair);
          }
        }

        // If this stage looks like a Physical Examination, add domain-specific
        // keywords that indicate exam findings (e.g., cardiovascular, auscultation)
        try {
          const physicalTriggers = ["physical", "exam", "examination", "physical examination"];
          const stageLabelLower = normalized;
          if (physicalTriggers.some((t) => stageLabelLower.includes(t))) {
            const PHYSICAL_TERMS = [
              "cardiovascular",
              "cardiac",
              "heart",
              "pulse",
              "heart rate",
              "respiratory",
              "respiration",
              "breathing",
              "auscultation",
              "auscultate",
              "mucous",
              "mucous membrane",
              "capillary",
              "capillary refill",
              "crt",
              "lungs",
              "gait",
              "percussion",
              "palpation",
              "temperature",
            ];
            PHYSICAL_TERMS.forEach((t) => keywords.add(t));
          }
        } catch {}
      };

      // Prefer per-case overridden title/description when available
      const overrideTitle = caseStageOverrides[String(index)]?.title;
      const overrideDescription = caseStageOverrides[String(index)]?.description;
      addLabel(overrideTitle ?? stage?.title);
      addLabel(overrideDescription ?? stage?.role);

      const stageNumber = index + 1;
      keywords.add(`stage ${stageNumber}`);
      keywords.add(`section ${stageNumber}`);
      keywords.add(`part ${stageNumber}`);

      return Array.from(keywords).filter(Boolean);
    });
  }, [stages]);

  useEffect(() => {
    if (!voiceMode || !audioDevicesSupported) {
      setAudioNotice(null);
      return;
    }

    if (permissionError) {
      setAudioNotice(
        "Microphone permission is needed for voice mode. Click Allow access above to continue."
      );
      return;
    }

    if (!inputDevices.length) {
      setAudioNotice("No microphone detected. Connect one and refresh the device list.");
      return;
    }

    setAudioNotice(null);
  }, [audioDevicesSupported, voiceMode, permissionError, inputDevices.length]);

  const evaluateStageCompletion = useCallback(
    (stageIndex: number, messageList: Message[]): StageCompletionResult => {
      const stage = stages[stageIndex];
      const metrics: StageCompletionMetrics = {
        userTurns: 0,
        assistantTurns: 0,
        matchedAssistantKeywords: 0,
      };

      if (!stage) {
        return { status: "ready", metrics };
      }

      const stageMessages = messageList.filter(
        (msg) => msg.stageIndex === stageIndex
      );
      metrics.userTurns = stageMessages.filter((msg) => msg.role === "user").length;
      const assistantMessages = stageMessages.filter(
        (msg) => msg.role === "assistant"
      );
      metrics.assistantTurns = assistantMessages.length;

      const ruleKey = stage.title?.toLowerCase().replace(/\s+/g, " ").trim();
      // base rule from static defaults
      const baseRule = ruleKey ? STAGE_COMPLETION_RULES[ruleKey] : undefined;

      // allow per-case overrides by stage index (admin UI stores overrides keyed by index)
      const stageIdx = stages.findIndex((s) => s.title === stage.title);
      const override = (stageIdx >= 0 && caseStageOverrides[String(stageIdx)]) || {};

      const rule: StageCompletionRule | undefined = (() => {
        if (!baseRule && !override) return undefined;
        const merged: StageCompletionRule = { ...(baseRule || {}) };
        if (override.minUserTurns != null) merged.minUserTurns = Number(override.minUserTurns);
        if (override.minAssistantTurns != null) merged.minAssistantTurns = Number(override.minAssistantTurns);
        if (override.minAssistantKeywordHits != null) merged.minAssistantKeywordHits = Number(override.minAssistantKeywordHits);
        if (override.assistantKeywords && Array.isArray(override.assistantKeywords)) merged.assistantKeywords = override.assistantKeywords;
        return merged;
      })();

      if (!rule) {
        return { status: "ready", metrics, rule: undefined };
      }

      if (rule.assistantKeywords && rule.assistantKeywords.length > 0) {
        const normalizedKeywords = rule.assistantKeywords
          .map((kw) => kw.toLowerCase().trim())
          .filter(Boolean);
        const keywordHits = new Set<string>();
        assistantMessages.forEach((msg) => {
          const content = msg.content?.toLowerCase() ?? "";
          if (!content) return;
          normalizedKeywords.forEach((keyword) => {
            if (keyword && content.includes(keyword)) {
              keywordHits.add(keyword);
            }
          });
        });
        metrics.matchedAssistantKeywords = keywordHits.size;
      }

      let ready = true;
      if (rule.minUserTurns && metrics.userTurns < rule.minUserTurns) {
        ready = false;
      }
      if (rule.minAssistantTurns && metrics.assistantTurns < rule.minAssistantTurns) {
        ready = false;
      }
      if (
        rule.minAssistantKeywordHits &&
        metrics.matchedAssistantKeywords < rule.minAssistantKeywordHits
      ) {
        ready = false;
      }

      // Special-case: for Physical Examination, allow the assistant's structured
      // findings / keyword-rich reply to trigger readiness even if the turn
      // counts (minUserTurns / minAssistantTurns) are not fully met. This
      // handles cases where the nurse quickly provides vitals (e.g., HR/Temp)
      // and should be sufficient to advance.
      try {
        if (ruleKey === "physical examination") {
          const assistantHasStructuredFindings = assistantMessages.some((m) => {
            return (m as any).structuredFindings && Object.keys((m as any).structuredFindings).length > 0;
          });
          // More sensitive trigger: a single keyword hit from the assistant is sufficient
          // to consider Physical Examination ready even if min turn counts are not fully met.
          if (
            assistantHasStructuredFindings ||
            (metrics.matchedAssistantKeywords && metrics.matchedAssistantKeywords >= 1)
          ) {
            ready = true;
          }
        }
      } catch (e) {
        // ignore if structure not present
      }
      
      if (ready) {
        return { status: "ready", metrics, rule };
      }
      return { status: "insufficient", metrics, rule };
  }, [stages]);

  const isAdvancingRef = useRef<boolean>(false);
  const isPlayingAudioRef = useRef<boolean>(false);
  // When true, temporarily ignore STT outputs to avoid self-capture
  const isSuppressingSttRef = useRef<boolean>(false);
  const lastTtsEndRef = useRef<number>(0);
  const nextStageIntentTimeoutRef = useRef<number | null>(null);
  const handleProceedRef = useRef<(() => Promise<void>) | null>(null);
  const scheduleAutoProceedRef = useRef<(() => void) | null>(null);
  const stayBlockedUntilRef = useRef<number>(0);
  const rollbackRequestedRef = useRef<boolean>(false);
  // Track whether the nurse acknowledgement (NURSE_ACK) has already been emitted
  // during this attempt so we don't repeat the same phrasing multiple times.
  const nurseAckGivenRef = useRef<boolean>(false);
  const isStageIntentLocked = () => {
    if (rollbackRequestedRef.current) {
      return true;
    }
    return stayBlockedUntilRef.current > Date.now();
  };
  const lockStageIntent = (intent: "stay" | "rollback") => {
    stayBlockedUntilRef.current = Date.now() + STAGE_STAY_BLOCK_WINDOW_MS;
    rollbackRequestedRef.current = intent === "rollback";
  };
  const clearStageIntentLocks = () => {
    stayBlockedUntilRef.current = 0;
    rollbackRequestedRef.current = false;
  };

  const upsertPersonaDirectory = useCallback(
    (roleKey: string | null | undefined, entry: PersonaDirectoryEntry) => {
      const normalized = resolveDirectoryPersonaKey(roleKey);
      if (!normalized) return;
      setPersonaDirectory((prev) => {
        const existing = prev[normalized] ?? {};
        const nextDir = {
          ...prev,
          [normalized]: {
            ...existing,
            ...entry,
          },
        };
        personaDirectoryRef.current = nextDir;
        return nextDir;
      });
    },
    []
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Keep a base input buffer (committed text from prior finals or manual typing)
  const baseInputRef = useRef<string>("");
  // Remember whether we've already started listening for this attempt to
  // avoid repeatedly calling `start()` due to hook identity changes.
  const startedListeningRef = useRef<boolean>(false);
  // Track the previous attemptId so initialization runs only once per
  // attempt change.
  const prevAttemptIdRef = useRef<string | null>(null);

  useEffect(() => {
    latestInitialMessagesRef.current = Array.isArray(initialMessages)
      ? initialMessages
      : [];
  }, [initialMessages]);

  // Speech-to-text functionality. Provide an onFinal handler to auto-send when
  // voiceMode is active.

  // Refs to manage auto-send timer and pending final text
  const autoSendTimerRef = useRef<number | null>(null);
  // A separate timer for finals that should not be cancelled by interims.
  // Some STT engines emit interims after a final; this final timer ensures
  // we always auto-send after a true final transcript arrives.
  const autoSendFinalTimerRef = useRef<number | null>(null);
  const autoSendPendingTextRef = useRef<string | null>(null);
  // Mic inactivity timer (used to stop mic after long silence). Only
  // applied during nurse-sensitive stages (Physical, Laboratory, Treatment).
  const micInactivityTimerRef = useRef<number | null>(null);
  // Track the last final transcript that onFinal handled so we don't
  // duplicate it when the `transcript` state also updates.
  const lastFinalHandledRef = useRef<string | null>(null);
  // Track which persona sent the last outgoing user message so we can
  // prefer that persona when the server doesn't explicitly direct otherwise.
  const lastSentPersonaRef = useRef<AllowedChatPersonaKey | null>(null);
  // Track the UI-selected persona at the moment a message was sent. This
  // helps avoid races where the server replies before the client has
  // fully attributed the outgoing message.
  const selectedPersonaAtSendRef = useRef<AllowedChatPersonaKey | null>(null);
  // Track last appended chunk and time to avoid rapid duplicate appends
  const lastAppendedTextRef = useRef<string | null>(null);
  const lastAppendTimeRef = useRef<number>(0);
  // Suppress immediate transcript re-population after a manual send
  const clearInputSuppressionRef = useRef<boolean>(false);

  // Pending stage-advance confirmation state (shows inline banner with YES/NO)
  const [pendingStageAdvance, setPendingStageAdvance] = useState<{ stageIndex: number; title: string; } | null>(null);
  // Timers for STT error toast fade and voice-mode restart
  const sttErrorToastTimerRef = useRef<number | null>(null);
  const sttErrorRestartTimerRef = useRef<number | null>(null);
  // Suppress immediate "Microphone Blocked" toasts triggered by the user clicking SPEAK.
  // When the user clicks SPEAK we set a short suppression window. If a "not-allowed"
  // error arrives during that window (browser permission prompt flow) we delay showing
  // the toast until the window ends so the permission prompt isn't immediately
  // overwhelmed by an error toast.
  const sttBlockedSuppressUntilRef = useRef<number | null>(null);
  const sttBlockedDelayedToastTimerRef = useRef<number | null>(null);
  const latestSttErrorRef = useRef<string | null>(null);
  // Timer for auto-sending when a '...' placeholder is left waiting
  const placeholderAutoSendTimerRef = useRef<number | null>(null);
  // Ref for noise suppression to avoid stale closures
  const noiseSuppressionRef = useRef(false);
  useEffect(() => {
    noiseSuppressionRef.current = noiseSuppression;
  }, [noiseSuppression]);

  const resetNextStageIntent = useCallback(() => {
    if (nextStageIntentTimeoutRef.current) {
      window.clearTimeout(nextStageIntentTimeoutRef.current);
      nextStageIntentTimeoutRef.current = null;
    }
  }, []);

  // Listen for global TTS lifecycle events so we can accurately track when
  // audio playback is active and when it ends. This helps avoid STT picking
  // up the assistant's own audio and treating it as user input.
  useEffect(() => {
    const handleStart = () => {
      isPlayingAudioRef.current = true;
    };
    const handleEnd = () => {
      isPlayingAudioRef.current = false;
      lastTtsEndRef.current = Date.now();
    };
    try {
      window.addEventListener("vw:tts-start", handleStart as EventListener);
      window.addEventListener("vw:tts-end", handleEnd as EventListener);
    } catch {
      // ignore
    }
    return () => {
      try {
        window.removeEventListener("vw:tts-start", handleStart as EventListener);
        window.removeEventListener("vw:tts-end", handleEnd as EventListener);
      } catch {
        // ignore
      }
    };
  }, []);

  // Collapse immediate repeated phrases in a final transcript. Some STT
  // engines occasionally emit duplicated chunks (the same phrase twice in a
  // row). This attempts a conservative de-dup: if the final transcript
  // contains an immediate repeat of the first k words (for k>=3), keep the
  // first occurrence only.
  const collapseImmediateRepeat = (s: string) => {
    if (!s) return s;
    const words = s.trim().split(/\s+/);
    const L = words.length;
    // Only attempt on reasonably long phrases
    if (L < 6) return s;
    for (let k = Math.floor(L / 2); k >= 3; k--) {
      // check if first k words repeat immediately
      let repeat = true;
      for (let i = 0; i < k; i++) {
        if (words[i] !== words[i + k]) {
          repeat = false;
          break;
        }
      }
      if (repeat) {
        // keep the first k words and append any remaining words beyond 2k
        const remainder = words.slice(2 * k);
        return [...words.slice(0, k), ...remainder].join(" ");
      }
    }
    // Also check for a repeated trailing segment (e.g., '... a b a b')
    for (let k = Math.floor(L / 2); k >= 3; k--) {
      let repeat = true;
      for (let i = 0; i < k; i++) {
        if (words[L - 1 - i] !== words[L - 1 - i - k]) {
          repeat = false;
          break;
        }
      }
      if (repeat) {
        return words.slice(0, L - k).join(" ");
      }
    }
    return s;
  };

  const { isListening, transcript, interimTranscript, start, stop, abort, reset, error: sttError, ambientLevel, setDebounceMs } =
    useSTT(
      (finalText: string) => {
        console.debug(
          "STT onFinal fired, voiceMode=",
          voiceMode,
          "finalText=",
          finalText
        );
        // DEAF MODE CHECK: If we're in deaf mode, completely ignore all results
        // This is a client-side backup in case the service-level check missed it
        if (isInDeafMode()) {
          console.debug("STT onFinal ignored - in deaf mode (TTS playing or recently ended)");
          lastFinalHandledRef.current = finalText;
          return;
        }
        
        // If we're suppressing STT (TTS playing or shortly after), ignore finals
        if (isSuppressingSttRef.current) {
          // mark handled to avoid re-appending via transcript effect
          lastFinalHandledRef.current = finalText;
          return;
        }
        
        // Also check isPlayingAudioRef directly - belt and suspenders
        if (isPlayingAudioRef.current) {
          console.debug("STT onFinal ignored - audio is playing");
          lastFinalHandledRef.current = finalText;
          return;
        }

        if (voiceMode && finalText && finalText.trim()) {
          // Trim and attempt to de-duplicate obvious repeats from STT finals
          const trimmed = collapseImmediateRepeat(finalText.trim());
          // If the final appears to repeat (or mostly repeat) the last assistant message
          // (likely because the mic picked up the TTS), ignore it and do not
          // send to the LLM. Keep listening open so the student can speak.
          try {
            const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
            if (lastAssistant && lastAssistant.content) {
              const normalize = (s: string) =>
                s
                  .toLowerCase()
                  .replace(/[^a-z0-9\s]/g, " ")
                  .replace(/\s+/g, " ")
                  .trim();
              const normFinal = normalize(trimmed);
              const normAssistant = normalize(String(lastAssistant.content));
              const recentTts = isPlayingAudioRef.current || Date.now() - (lastTtsEndRef.current || 0) < 2500;
              
              // Check for exact match
              if (normFinal && normAssistant && normFinal === normAssistant && recentTts) {
                console.debug("STT onFinal ignored - exact TTS echo detected");
                lastFinalHandledRef.current = trimmed;
                // helpful UX hint when auto-send would have been triggered but was suppressed by TTS echo
                try { debugEventBus.emitEvent?.('info','AutoSend','blocked_echo',{ text: trimmed }); } catch {}
                return;
              }
              
              // Check for fuzzy match (STT might mishear a few words)
              // If >80% of words match and it's recent TTS, likely an echo
              if (normFinal && normAssistant && recentTts && normFinal.length > 20) {
                const finalWords = normFinal.split(" ");
                const assistantWords = normAssistant.split(" ");
                // Only check if lengths are similar (within 20%)
                if (Math.abs(finalWords.length - assistantWords.length) <= Math.max(finalWords.length, assistantWords.length) * 0.2) {
                  let matchCount = 0;
                  for (const word of finalWords) {
                    if (assistantWords.includes(word)) matchCount++;
                  }
                  const matchRatio = matchCount / finalWords.length;
                  if (matchRatio > 0.8) {
                    console.debug("STT onFinal ignored - fuzzy TTS echo detected", { matchRatio });
                    lastFinalHandledRef.current = trimmed;
                    return;
                  }
                }
              }
            }
          } catch (e) {
            // ignore normalization errors
          }
          const now = Date.now();

          // Avoid duplicating identical final chunks that may be emitted
          // multiple times by the STT engine or overlap with recently
          // displayed interim text. If we've appended the same chunk within
          // the last 3s, skip it.
          if (
            lastAppendedTextRef.current === trimmed &&
            now - (lastAppendTimeRef.current || 0) < 3000
          ) {
            // Mark handled so transcript effect doesn't re-append
            lastFinalHandledRef.current = trimmed;
            return;
          }
          // Clear any previously scheduled short-timeout auto-send (non-final)
          if (autoSendTimerRef.current) {
            window.clearTimeout(autoSendTimerRef.current);
            autoSendTimerRef.current = null;
          }
          // Clear any existing final timer before scheduling a fresh one
          if (autoSendFinalTimerRef.current) {
            window.clearTimeout(autoSendFinalTimerRef.current);
            autoSendFinalTimerRef.current = null;
          }

          // Append the final trimmed text to the committed base input so
          // pauses do not erase earlier content. Maintain spacing. Also
          // guard against the base already ending with the same text.
            baseInputRef.current = mergeStringsNoDup(baseInputRef.current, trimmed);
          // Reflect in the visible textarea immediately
          setInput(baseInputRef.current);

          // Store pending final text and schedule an auto-send after a short
          // silence tolerance window. This lets brief pauses in user speech
          // (e.g., thinking pauses) not immediately trigger a send.
          autoSendPendingTextRef.current = trimmed;
          // Remember we've handled this final so the transcript effect can
          // ignore it and avoid double-appending.
          lastFinalHandledRef.current = trimmed;
          // Remember last appended chunk and time
          lastAppendedTextRef.current = trimmed;
          lastAppendTimeRef.current = now;
          // Schedule a final-only timer which should not be cancelled by
          // subsequent interim updates. Only schedule if auto-send is enabled.
          if (autoSendSttRef.current) {
            // Check if the phrase appears incomplete (ends with articles,
            // prepositions, conjunctions, etc.) - give more time to complete
            const textToCheck = baseInputRef.current?.trim() || "";
            const lastWord = textToCheck.split(/\s+/).pop()?.toLowerCase() || "";
            // Use shared helper to decide if trailing word suggests incomplete phrase
            const looksIncomplete = endsWithIncompleteMarker(textToCheck);

            
            // When noise suppression is active, use a longer delay to filter
            // out ambient chatter that might be picked up as speech.
            // When phrase looks incomplete, give extra time to finish
            let autoSendDelay = 500;
            if (noiseSuppressionRef.current) {
              autoSendDelay = 1500;
            } else if (looksIncomplete) {
              autoSendDelay = 1200; // Give 1.2s for incomplete phrases
            }
            
            autoSendFinalTimerRef.current = window.setTimeout(() => {
              autoSendFinalTimerRef.current = null;
              autoSendPendingTextRef.current = null;
              try {
                // GUARD: If we're in deaf mode (TTS playing or just ended), skip auto-send
                // This prevents the mic from "auto-sending" captured TTS audio
                if (isInDeafMode()) {
                  console.debug("Auto-send BLOCKED: in deaf mode (TTS playing or recently ended)", { source: 'final-auto' });
                  try { debugEventBus.emitEvent?.('info','AutoSend','blocked_deaf_mode',{ source: 'final-auto' }); } catch {};
                  return;
                }
                
                // Extra validation when noise suppression is on: require at
                // least 3 words to reduce accidental sends from ambient noise
                const textToSend = baseInputRef.current?.trim() || "";
                const wordCount = textToSend.split(/\s+/).filter(Boolean).length;
                // Allow single-word requests during nurse-sensitive stages.
                const stage = stages?.[currentStageIndex];
                const stageTitle = (stage?.title ?? "").toLowerCase();
                const isSensitiveStage = /physical|laboratory|lab|treatment/.test(stageTitle);
                // Minimum words required to auto-send during noise suppression.
                // Lowered to 2 to allow concise two-word queries (e.g., "respiratory exam").
                const minWordsWhenSuppressed = isSensitiveStage ? 1 : 2;
                if (noiseSuppressionRef.current && wordCount < minWordsWhenSuppressed) {
                  console.debug("Auto-send skipped: too short during noise suppression", { wordCount, minWordsWhenSuppressed, text: textToSend });
                  return;
                }
                
                // Re-check if message still looks incomplete - block auto-send entirely
                const finalLastWord = textToSend.split(/\s+/).pop()?.toLowerCase() || "";
                const incompleteBlockers = [
                  // Articles - strong signal of incomplete thought
                  "the", "a", "an",
                  // Prepositions often followed by object
                  "of", "at", "in", "on", "to", "for", "with", "by", "from", "about", "into",
                  // Common continuation patterns
                  "is", "are", "was", "were", "and", "or", "but", "that", "which",
                  "my", "your", "his", "her", "its", "our", "their", "this", "these", "those",
                ];
                if (incompleteBlockers.includes(finalLastWord)) {
                  console.debug("Auto-send BLOCKED: message ends with incomplete marker", { finalLastWord, text: textToSend, source: 'final-auto' });
                  try { debugEventBus.emitEvent?.('info','AutoSend','blocked_incomplete_marker',{ finalLastWord, text: textToSend, source: 'final-auto' }); } catch {};
                  // show a brief hint so users understand why auto-send didn't fire
                  try { setTimepointToast({ title: "Auto-send blocked", body: "Message looks incomplete — tap Send to send it anyway." }); setTimeout(() => hideTimepointToastWithFade(300), 2400); } catch {}
                  return;
                }
                
                console.debug(
                  "Auto-send (final) firing with text:",
                  baseInputRef.current
                );
                void triggerAutoSend(baseInputRef.current);
              } catch (e) {
                console.error("Failed to auto-send final transcript:", e);
              }
            }, autoSendDelay);
          }
        }
      },
      700,
      {
        inputDeviceId: selectedInputId,
      }
    );

  // Keep a reference to the latest error string for delayed checks
  useEffect(() => {
    latestSttErrorRef.current = sttError ?? null;
  }, [sttError]);

  // Helper to actually show the STT error toast and manage restart timers
  const emitSttErrorToast = (title: string, body: string) => {
    setTimepointToast({ title, body });

    // Stop listening momentarily (voice mode remains enabled)
    try {
      stop();
    } catch (e) {
      // ignore
    }

    if (sttErrorToastTimerRef.current) {
      window.clearTimeout(sttErrorToastTimerRef.current);
      sttErrorToastTimerRef.current = null;
    }
    if (sttErrorRestartTimerRef.current) {
      window.clearTimeout(sttErrorRestartTimerRef.current);
      sttErrorRestartTimerRef.current = null;
    }

    sttErrorToastTimerRef.current = window.setTimeout(() => {
      hideTimepointToastWithFade(300);
      sttErrorToastTimerRef.current = null;
      // restart voice mode 2s after fade completes
      sttErrorRestartTimerRef.current = window.setTimeout(() => {
        if (voiceModeRef.current && !isListening && !userToggledOffRef.current && !isPaused && !isPlayingAudioRef.current) {
          try {
            try {
              if (!canStartListening()) return;
            } catch (e) {}
            start();
          } catch (e) {
            console.warn("Failed to restart STT after error:", e);
          }
        }
        sttErrorRestartTimerRef.current = null;
      }, 2000);
    }, 1000);
  };

  // Handle STT Errors (e.g. network error on Chromium)
  useEffect(() => {
    if (sttError) {
      console.warn("ChatInterface received STT error:", sttError);

      // Only show toast for serious errors that require user attention
      // Ignore transient errors that are normal during voice mode operation:
      // - "no-speech": No speech detected (normal when user pauses)
      // - "aborted": Recognition was aborted (normal during TTS playback)
      // - "audio-capture": Brief audio capture issues (usually recovers)
      const transientErrors = ["no-speech", "aborted", "audio-capture"];
      const isTransient = transientErrors.some(e => sttError.toLowerCase().includes(e));

      if (isTransient) {
        console.debug("STT transient error (not showing toast):", sttError);
        // Still try to restart for transient errors, but silently
        if (sttErrorRestartTimerRef.current) {
          window.clearTimeout(sttErrorRestartTimerRef.current);
        }
        sttErrorRestartTimerRef.current = window.setTimeout(() => {
          if (voiceModeRef.current && !isListening && !userToggledOffRef.current && !isPaused && !isPlayingAudioRef.current) {
            try {
              try {
                if (!canStartListening()) return;
              } catch (e) {}
              start();
            } catch (e) {
              console.warn("Failed to restart STT after transient error:", e);
            }
          }
          sttErrorRestartTimerRef.current = null;
        }, 1000);
        return; // Don't show toast for transient errors
      }

      // If microphone permission was just requested by the user, suppress the
      // immediate blocked toast until the permission prompt resolves. If it
      // remains blocked after the suppression window, schedule the toast.
      const now = Date.now();
      if (sttError.includes("not-allowed")) {
        const suppressUntil = sttBlockedSuppressUntilRef.current;
        if (suppressUntil && now < suppressUntil) {
          console.debug("Suppressing immediate 'Microphone Blocked' toast until", suppressUntil);
          if (sttBlockedDelayedToastTimerRef.current) {
            window.clearTimeout(sttBlockedDelayedToastTimerRef.current);
            sttBlockedDelayedToastTimerRef.current = null;
          }
          sttBlockedDelayedToastTimerRef.current = window.setTimeout(() => {
            if (latestSttErrorRef.current && latestSttErrorRef.current.includes("not-allowed")) {
              emitSttErrorToast("Microphone Blocked", "Please allow microphone access in your browser settings.");
            }
            sttBlockedDelayedToastTimerRef.current = null;
          }, Math.max(0, suppressUntil - now));
          return;
        }
      }

      // Serious errors that warrant a toast
      let title = "Speech Recognition Error";
      let body = "An error occurred with the speech service.";

      if (sttError.includes("network")) {
        title = "Speech Service Unavailable";
        body = "Chromium browsers often lack Google Speech keys. Please use Google Chrome.";
      } else if (sttError.includes("not-allowed")) {
        title = "Microphone Blocked";
        body = "Please allow microphone access in your browser settings.";
      }

      emitSttErrorToast(title, body);
    }
  }, [sttError]);

  // Debug tracing: last LLM payload and response for admin debug window
  const [lastLlmPayload, setLastLlmPayload] = useState<any | null>(null);
  const [lastLlmResponse, setLastLlmResponse] = useState<any | null>(null);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  // Admin-only debug toast controls
  const [debugEnabled, setDebugEnabled] = useState<boolean>(() => {
    try {
      return typeof window !== "undefined" && window.localStorage.getItem("vw_debug") === "true";
    } catch (e) {
      return false;
    }
  });
  const [debugToastVisible, setDebugToastVisible] = useState(false);
  const [debugToastText, setDebugToastText] = useState<string | null>(null);
  const debugToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show a 10s debug toast when last LLM payload/response updates and
  // debug mode is enabled for an admin user.
  useEffect(() => {
    try {
      const isAdmin = role === "admin";
      if (!isAdmin || !debugEnabled) return;
      if (!lastLlmPayload && !lastLlmResponse) return;

      // Build a compact display string
      const prettyPayload = Array.isArray(lastLlmPayload)
        ? lastLlmPayload.map((p: any) => `${p.role}: ${String(p.content).slice(0, 240)}`).join(" \n")
        : String(JSON.stringify(lastLlmPayload || "")).slice(0, 800);
      const prettyResp = String(JSON.stringify(lastLlmResponse || "")).slice(0, 800);
      const text = `LLM Prompt:\n${prettyPayload}\n\nLLM Response:\n${prettyResp}`;
      setDebugToastText(text);
      setDebugToastVisible(true);

      // Clear any previous timer
      if (debugToastTimerRef.current) {
        window.clearTimeout(debugToastTimerRef.current);
        debugToastTimerRef.current = null;
      }
      debugToastTimerRef.current = setTimeout(() => {
        setDebugToastVisible(false);
        setDebugToastText(null);
        debugToastTimerRef.current = null;
      }, 10000);
    } catch (e) {
      // ignore
    }
  }, [lastLlmPayload, lastLlmResponse, debugEnabled, role]);
  

  // Noise detection effect - monitors ambient sound when voice mode is on
  // Placed after useSTT so that isListening is available
  useEffect(() => {
    // Don't run noise detection during TTS playback
    if (!voiceMode || !isListening || isPlayingAudioRef.current) {
      // Cleanup when voice mode or listening is off, or during TTS
      if (noiseCheckIntervalRef.current) {
        clearInterval(noiseCheckIntervalRef.current);
        noiseCheckIntervalRef.current = null;
      }
      if (noiseStreamRef.current) {
        noiseStreamRef.current.getTracks().forEach(t => t.stop());
        noiseStreamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      // Don't reset suppression if we're playing audio - keep it active
      if (!isPlayingAudioRef.current) {
        setNoiseSuppression(false);
      }
      return;
    }
    
    // Start noise monitoring
    const startNoiseMonitoring = async () => {
      try {
        // Reuse mic stream or get a new one
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        noiseStreamRef.current = stream;
        
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        analyserRef.current = analyser;
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        // Check noise level every 500ms
        noiseCheckIntervalRef.current = setInterval(() => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          
          // Calculate average volume (0-255)
          const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          const normalizedLevel = Math.min(100, Math.round((avg / 255) * 100));
          setNoiseLevel(normalizedLevel);
          
          // If noise is above threshold (ambient chatter), enable suppression
          const threshold = 25; // ~25% ambient noise triggers suppression
          if (normalizedLevel > threshold && !noiseSuppression) {
            setNoiseSuppression(true);
            showMicToast("🔇 Noise detected - sensitivity reduced", 2500);
          } else if (normalizedLevel <= threshold * 0.6 && noiseSuppression) {
            // Hysteresis: only disable suppression when noise drops significantly
            setNoiseSuppression(false);
            showMicToast("🎤 Normal listening resumed", 1500);
          }
        }, 500);
      } catch (err) {
        console.warn("Noise monitoring unavailable:", err);
      }
    };
    
    startNoiseMonitoring();
    
    return () => {
      if (noiseCheckIntervalRef.current) {
        clearInterval(noiseCheckIntervalRef.current);
        noiseCheckIntervalRef.current = null;
      }
      if (noiseStreamRef.current) {
        noiseStreamRef.current.getTracks().forEach(t => t.stop());
        noiseStreamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, [voiceMode, isListening, noiseSuppression, showMicToast]);

  // clear timers on unmount
  useEffect(() => {
    return () => {
      if (autoSendTimerRef.current) {
        window.clearTimeout(autoSendTimerRef.current);
        autoSendTimerRef.current = null;
      }
      if (autoSendFinalTimerRef.current) {
        window.clearTimeout(autoSendFinalTimerRef.current);
        autoSendFinalTimerRef.current = null;
      }
      if (sttErrorToastTimerRef.current) {
        window.clearTimeout(sttErrorToastTimerRef.current);
        sttErrorToastTimerRef.current = null;
      }
      if (sttErrorRestartTimerRef.current) {
        window.clearTimeout(sttErrorRestartTimerRef.current);
        sttErrorRestartTimerRef.current = null;
      }
      if (sttBlockedDelayedToastTimerRef.current) {
        window.clearTimeout(sttBlockedDelayedToastTimerRef.current);
        sttBlockedDelayedToastTimerRef.current = null;
      }
      if (personaToastTimerRef.current) {
        window.clearTimeout(personaToastTimerRef.current);
        personaToastTimerRef.current = null;
      }
      if (voiceModeToastTimerRef.current) {
        window.clearTimeout(voiceModeToastTimerRef.current);
        voiceModeToastTimerRef.current = null;
      }
      if (placeholderAutoSendTimerRef.current) {
        window.clearTimeout(placeholderAutoSendTimerRef.current);
        placeholderAutoSendTimerRef.current = null;
      }
      autoSendPendingTextRef.current = null;
      resetNextStageIntent();

      // Persist current persona draft on unmount
      try {
        window.localStorage.setItem(draftLocalStorageKey(activePersona), input || "");
      } catch (e) {
        // ignore
      }
    };
  }, [resetNextStageIntent]);

  useEffect(() => {
    let cancelled = false;
    setPersonaDirectory({});
    personaDirectoryRef.current = {};
    resetPersonaDirectoryReady();

    async function loadPersonaDirectory() {
      try {
        const token = await (async () => {
          try {
            const { getAccessToken } = await import("@/lib/auth-headers");
            return await getAccessToken();
          } catch (e) {
            return null;
          }
        })();

        const fetchOpts: RequestInit = token
          ? { headers: { Authorization: `Bearer ${token}` } }
          : {};

        let response = await fetch(
          `/api/personas?caseId=${encodeURIComponent(caseId)}`,
          fetchOpts
        );

        let personasToProcess: any[] | undefined;

        // If case-specific personas are unauthorized or otherwise fail, fall back to global personas
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            try {
              console.warn(`/api/personas returned ${response.status} — attempting /api/global-personas fallback`);
              const globalResp = await fetch(`/api/global-personas`, fetchOpts);
              if (globalResp.ok) {
                const globalPayload = await globalResp.json().catch(() => ({ personas: [] }));
                personasToProcess = Array.isArray(globalPayload?.personas)
                  ? globalPayload.personas
                  : [];
              } else {
                console.warn(`/api/global-personas also returned ${globalResp.status}; using empty directory`);
                personasToProcess = [];
              }
            } catch (globalErr) {
              console.warn("Fallback to global personas failed", globalErr);
              personasToProcess = [];
            }
          } else {
            throw new Error(`Failed to load personas: ${response.status}`);
          }
        }

        // If we didn't already set personasToProcess from global fallback, parse the case response
        if (typeof personasToProcess === "undefined") {
          const payload = await response.json().catch(() => ({ personas: [] }));
          personasToProcess = Array.isArray(payload?.personas) ? payload.personas : [];
        }
        const personas = personasToProcess || [];
        const next: Record<string, PersonaDirectoryEntry> = {};

        for (const row of personas) {
          const rawKey = typeof row?.role_key === "string" ? row.role_key : "";
          const normalizedKey = isAllowedChatPersonaKey(rawKey)
            ? rawKey
            : classifyChatPersonaLabel(rawKey);
          if (!normalizedKey) {
            continue;
          }
          const metadata =
            row && typeof row.metadata === "object" && row.metadata !== null
              ? (row.metadata as Record<string, unknown>)
              : {};
          const identity =
            metadata && typeof metadata.identity === "object"
              ? (metadata.identity as {
                fullName?: string;
                voiceId?: string;
                sex?: string;
              })
              : undefined;
          
          // Build candidate entry from this row
          const candidateDisplayName =
            typeof row?.display_name === "string"
              ? row.display_name
              : identity?.fullName;
          const candidatePortraitUrl =
            typeof row?.image_url === "string" ? row.image_url : undefined;
          const candidateVoiceId =
            typeof metadata?.voiceId === "string"
              ? (metadata.voiceId as string)
              : typeof identity?.voiceId === "string"
                ? identity.voiceId
                : undefined;
          const candidateSex =
            normalizeSex(typeof row?.sex === "string" ? row.sex : undefined) ??
            normalizeSex(typeof metadata?.sex === "string" ? (metadata.sex as string) : undefined) ??
            normalizeSex(typeof identity?.sex === "string" ? identity.sex : undefined);
          
          // Merge with existing entry - prefer values that exist (don't let nulls overwrite data)
          const existing = next[normalizedKey];
          next[normalizedKey] = {
            displayName: candidateDisplayName ?? existing?.displayName,
            portraitUrl: candidatePortraitUrl ?? existing?.portraitUrl,
            voiceId: candidateVoiceId ?? existing?.voiceId,
            sex: candidateSex ?? existing?.sex,
          };
          // lightweight diagnostic: log resolved persona sex and key
          try {
            console.debug("personaDirectory load", {
              key: normalizedKey,
              sex: next[normalizedKey].sex,
              displayName: next[normalizedKey].displayName,
            });
          } catch (e) {
            /* ignore logging errors */
          }
        }

        /*
        try {
          const globalResponse = await fetch("/api/global-personas");
          if (!globalResponse.ok) {
            throw new Error(`Failed to load shared personas: ${globalResponse.status}`);
          }
          const globalPayload = await globalResponse
            .json()
            .catch(() => ({ personas: [] }));
          const globalPersonas = Array.isArray(globalPayload?.personas)
            ? globalPayload.personas
            : [];
  
          for (const row of globalPersonas) {
            const rawKey = typeof row?.role_key === "string" ? row.role_key : "";
            const normalizedKey = isAllowedChatPersonaKey(rawKey)
              ? rawKey
              : classifyChatPersonaLabel(rawKey);
            if (!normalizedKey || next[normalizedKey]) {
              continue;
            }
            const metadata =
              row && typeof row.metadata === "object" && row.metadata !== null
                ? (row.metadata as Record<string, unknown>)
                : {};
            const identity =
              metadata && typeof metadata.identity === "object"
                ? (metadata.identity as {
                    fullName?: string;
                    voiceId?: string;
                    sex?: string;
                  })
                : undefined;
            next[normalizedKey] = {
              displayName:
                typeof row?.display_name === "string"
                  ? row.display_name
                  : identity?.fullName,
              portraitUrl:
                typeof row?.image_url === "string" ? row.image_url : undefined,
              voiceId:
                typeof metadata?.voiceId === "string"
                  ? (metadata.voiceId as string)
                  : typeof identity?.voiceId === "string"
                    ? identity.voiceId
                    : undefined,
              sex:
                typeof row?.sex === "string"
                  ? row.sex
                  : typeof metadata?.sex === "string"
                  ? (metadata.sex as string)
                  : typeof identity?.sex === "string"
                    ? identity.sex
                    : undefined,
            };
          }
        } catch (globalErr) {
          console.warn("Failed to load shared personas", globalErr);
        }
        */
        if (!cancelled) {
          setPersonaDirectory(next);
          personaDirectoryRef.current = next;
          resolvePersonaDirectoryReady();
        }
      } catch (err) {
        console.warn("Failed to load persona directory", err);
        if (!cancelled) {
          resolvePersonaDirectoryReady();
        }
      }
    }

    void loadPersonaDirectory();
    return () => {
      cancelled = true;
    };
  }, [caseId, resetPersonaDirectoryReady, resolvePersonaDirectoryReady]);

  // Text-to-speech
  const {
    available: ttsAvailable,
    isSpeaking,
    speak,
    speakAsync,
    cancel,
  } = useTTS();

  const cancelRef = useRef(cancel);
  useEffect(() => {
    cancelRef.current = cancel;
  }, [cancel]);

  const setTtsEnabledState = useCallback(
    (next: boolean) => {
      setTtsEnabled((current) => {
        if (current === next) {
          return current;
        }
        if (!next) {
          stopActiveTtsPlayback();
          try {
            cancel();
          } catch (e) {
            /* ignore */
          }
        }
        return next;
      });
    },
    [cancel]
  );

  const toggleTts = useCallback(() => {
    setTtsEnabledState(!ttsEnabledRef.current);
  }, [setTtsEnabledState]);

  // When TTS plays we may want to temporarily stop STT so the assistant voice
  // is not transcribed. Use a ref to remember whether we should resume.
  const resumeListeningRef = useRef<boolean>(false);
  const voiceTemporarilyDisabledRef = useRef<boolean>(false);
  const pendingFlushIntervalRef = useRef<number | null>(null);
  // Suppress automatic STT start attempts until a given timestamp (ms since epoch).
  // Used to avoid auto-listening when the UI switches focus (e.g., switching to Nurse tab).
  const suppressAutoStartUntilRef = useRef<number>(0);
  const suppressAutoStart = (ms: number) => {
    try { suppressAutoStartUntilRef.current = Date.now() + ms; } catch {}
  };

  const personaToastTimerRef = useRef<number | null>(null);
  const voiceModeToastTimerRef = useRef<number | null>(null);

  // Persist persona-specific input drafts to localStorage and show a brief
  // toast when the user switches persona.
  const handleSetActivePersona = useCallback((next: AllowedChatPersonaKey, opts?: { delayMs?: number; suppressAutoStartMs?: number }) => {
    if (next === activePersona) return;
    const delayMs = opts?.delayMs ?? 0;
    const suppressMs = opts?.suppressAutoStartMs ?? 1200;
    if (delayMs > 0) {
      // Delay the persona switch/UI focus to let the student see their own message first
      window.setTimeout(() => {
        try { suppressAutoStart(suppressMs); } catch {}
        // proceed with the normal immediate switch logic below by calling again without delay
        handleSetActivePersona(next);
      }, delayMs);
      return;
    }
    try {
      // save current draft
      window.localStorage.setItem(draftLocalStorageKey(activePersona), input || "");
    } catch (e) {
      // ignore
    }
    setPersonaDrafts(prev => ({ ...prev, [activePersona]: input || "" }));

    // Load next draft from in-memory cache or localStorage
    let nextDraft = personaDrafts[next] ?? "";
    try {
      if ((nextDraft ?? "") === "" && attemptId) {
        nextDraft = window.localStorage.getItem(draftLocalStorageKey(next)) ?? "";
      }
    } catch (e) {
      // ignore
    }

    setInput(nextDraft);
    baseInputRef.current = nextDraft;
    setActivePersona(next);

    // Scroll the message view to the most recent message when the user
    // switches persona so the focused persona's recent messages are visible.
    try {
      window.setTimeout(() => {
        try { messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); } catch (e) {}
      }, 50);
    } catch (e) {}

    // show a short toast to confirm persona switch
    const displayName = personaDirectoryRef.current?.[next]?.displayName ?? (next === "owner" ? "OWNER" : "NURSE");
    const toastTitle = next === "veterinary-nurse" ? "Hello Doc" : `Talking to ${displayName}`;
    setTimepointToast({ title: toastTitle, body: "" });
    // Hide after 2s (clear any prior timer first)
    if (personaToastTimerRef.current) {
      window.clearTimeout(personaToastTimerRef.current);
    }
    personaToastTimerRef.current = window.setTimeout(() => {
      hideTimepointToastWithFade(300);
      personaToastTimerRef.current = null;
    }, 2000);

    // Also append a short assistant greeting when switching to nurse via the UI
    try {
      if (next === "veterinary-nurse") {
        // Prevent repeated UI greetings
        // Suppress immediate auto-starts briefly to avoid accidental mic restarts when switching persona
        try { suppressAutoStart(1200); } catch {}

        // Attempt to auto-advance stages on a UI-based nurse activation (History->Physical, Diagnostic->Lab)
        try {
          const stage = stages?.[currentStageIndex];
          const stageTitle = (stage?.title ?? "").toLowerCase();
          // Emit event for QA tracing
          try { debugEventBus.emitEvent?.('info','StageIntent','persona-ui-switch',{ stageIndex: currentStageIndex, stageTitle }); } catch {}

          const attemptAdvanceTo = async (predicate: (label: string) => boolean) => {
            for (let i = 0; i < 6; i++) {
              const s = stages?.[currentStageIndex];
              const sTitle = (s?.title ?? "").toLowerCase();
              if (predicate(sTitle)) return true;
              try {
                onProceedToNextStage(messages, 0);
              } catch {}
              await new Promise((r) => setTimeout(r, 220));
            }
            return false;
          };

          if (/history/.test(stageTitle) || /history taking/.test(stageTitle)) {
            try { debugEventBus.emitEvent?.('info','StageIntent','persona-ui-trigger-advance',{ from: stageTitle, to: 'physical examination' }); } catch {}
            void attemptAdvanceTo((l) => /physical/.test(l));
          }

          if (/diagnostic/.test(stageTitle) || /diagnostic planning/.test(stageTitle)) {
            try { debugEventBus.emitEvent?.('info','StageIntent','persona-ui-trigger-advance',{ from: stageTitle, to: 'laboratory' }); } catch {}
            void attemptAdvanceTo((l) => /laboratory|lab|tests/.test(l));
          }
        } catch (e) {
          // ignore
        }

        if (!nurseGreetingSentRef.current) {
          // If the user has recently sent a message as the Nurse, suppress the
          // UI greeting because it would be redundant (user is already talking to Nurse).
          try {
            if (lastSentPersonaRef.current === "veterinary-nurse") {
              nurseGreetingSentRef.current = true;
              return;
            }
            // Also check the last few messages for a user message attributed to the Nurse
            const recent = messages.slice(-4);
            if (recent.some((m) => m.role === "user" && ((m as any).personaRoleKey === "veterinary-nurse" || (m.displayRole ?? "").toLowerCase().includes("nurse")))) {
              nurseGreetingSentRef.current = true;
              return;
            }
          } catch (e) {
            // ignore checks
          }

          nurseGreetingSentRef.current = true;
          (async () => {
            try {
              // Defer to shared helper so we can unit test the UI-driven greeting behavior
              try {
                await (await import("@/features/chat/utils/sendPersonaGreeting")).sendPersonaGreeting("veterinary-nurse", {
                  ensurePersonaMetadata,
                  appendAssistantMessage,
                  playTtsAndPauseStt,
                  ttsEnabled,
                  currentStageIndex,
                  caseId,
                  isListening: isListening,
                });
              } catch (e) {
                // ignore helper failures
              }
            } catch (e) {
              // ignore
            }
          })();
        }
      }
    } catch (e) {
      // non-blocking
    }
  }, [activePersona, input, personaDrafts, attemptId, setInput, setActivePersona]);

  // Persist current draft whenever input changes
  useEffect(() => {
    try {
      window.localStorage.setItem(draftLocalStorageKey(activePersona), input || "");
    } catch (e) {
      // ignore
    }
    setPersonaDrafts(prev => ({ ...prev, [activePersona]: input || "" }));
  }, [input, activePersona, attemptId]);

  // Save current draft on unmount
  useEffect(() => {
    return () => {
      try {
        window.localStorage.setItem(draftLocalStorageKey(activePersona), input || "");
      } catch (e) {
        // ignore
      }
    };
  }, []);

  // Helper to play TTS while ensuring STT is paused during playback so the
  // assistant's voice isn't captured. Resumes listening if it was active
  // before playback.
  // Sanitize text for TTS playback: remove symbol characters that should not
  // be pronounced (e.g. '*' or '#') while preserving normal punctuation.
  const sanitizeForTts = (s: string) => {
    if (!s) return s;
    try {
      // Remove symbols but keep letters, numbers, common punctuation and whitespace.
      // Use Unicode property escapes to include accented letters where available.
      // Fallback: if the runtime doesn't support \p escapes, fall back to a
      // conservative ASCII-safe removal.
      try {
        // Conservative removal of common symbol characters that should not be
        // spoken. Keep letters, numbers, punctuation like . , ? ! : ; and
        // common grouping characters but strip symbols like *, #, @, etc.
        const cleaned = s.replace(/[@#\$%\^&\*\[\]\{\}<>\|`~\\\/+=]/g, "");
        return cleaned.replace(/\s+/g, " ").trim();
      } catch (e) {
        return s;
      }
    } catch (e) {
      return s;
    }
  };

  // Normalize sex/sex-like labels coming from persona rows (e.g. 'Gelding')
  const normalizeSex = (raw?: string | null): "male" | "female" | "neutral" | undefined => {
    if (!raw) return undefined;
    const s = String(raw).toLowerCase().trim();
    if (!s) return undefined;
    if (s.includes("gelding") || s.includes("stallion") || s.includes("colt") || s.includes("male")) return "male";
    if (s.includes("mare") || s.includes("filly") || s.includes("cow") || s.includes("female")) return "female";
    if (s.includes("neutral") || s.includes("unknown") || s.includes("other")) return "neutral";
    return undefined;
  };

  // Attempt to start STT with a few retries if the engine doesn't immediately begin.
  // This makes resume-after-TTS more robust across browsers and STT implementations.
  const attemptStartListening = useCallback((initialDelay = 0) => {
    // schedule the initial attempt after the given delay
    window.setTimeout(() => {
      console.debug("attemptStartListening scheduled", { initialDelay });
      // If STT is currently suppressed (e.g., we're about to play TTS),
      // do not attempt to start listening. This avoids races where the
      // mic is restarted while assistant audio is playing and picked up.
      if (isSuppressingSttRef.current) {
        console.debug("attemptStartListening aborted: STT is suppressed (TTS active)");
        return;
      }
      // If voice mode is temporarily disabled for an assistant intro or
      // other forced TTS playback, do not start listening until that
      // temporary disable is cleared. This is a stronger guard than the
      // STT suppression flag and prevents retries from re-enabling the mic
      // while we are guaranteeing the mic stays off for TTS.
      if (tempVoiceDisabledRef.current) {
        console.debug("attemptStartListening aborted: temp voice disable active (waiting for TTS)");
        return;
      }
      if (userToggledOffRef.current) {
        console.debug("attemptStartListening aborted: user toggled mic off");
        return;
      }
      if (!voiceModeRef.current) {
        console.debug("attemptStartListening aborted: voiceMode disabled");
        return;
      }

      let attempts = 0;
      const maxAttempts = 3;
      const tryOnce = () => {
        // Respect a global suppression window to avoid automatically starting
        // STT immediately after UI interactions like persona switch.
        if (Date.now() < suppressAutoStartUntilRef.current) {
          console.debug("attemptStartListening suppressed due to recent UI interaction", { until: suppressAutoStartUntilRef.current, now: Date.now() });
          return;
        }
        if (userToggledOffRef.current || !voiceModeRef.current) {
          console.debug("attemptStartListening stopping retries", { attempts });
          return;
        }
        // Central check: ask service whether we can start now
        try {
          if (!canStartListening()) {
            console.debug("attemptStartListening aborted: service-level suppression or deaf mode active");
            return;
          }
        } catch (e) {
          // If helper fails for any reason, fall back to old guards
          if (isSttSuppressed() || isInDeafMode()) {
            console.debug("attemptStartListening aborted: fallback suppression/deaf mode guard");
            return;
          }
        }
        try {
          console.debug("attemptStartListening try", { attempt: attempts + 1 });
          start();
        } catch (e) {
          console.debug("attemptStartListening start() threw", e);
        }
        attempts += 1;
        if (attempts < maxAttempts) {
          window.setTimeout(() => {
            if (!isListening && !userToggledOffRef.current && voiceModeRef.current) tryOnce();
            else console.debug("attemptStartListening stopping further retries: isListening or toggled off", { isListening: !!isListening });
          }, 700);
        } else {
          console.debug("attemptStartListening reached max attempts", { attempts });
        }
      };
      tryOnce();
    }, initialDelay);
  }, [start, isListening]);

  const stopRef = useRef(stop);
  const resetRef = useRef(reset);
  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);
  useEffect(() => {
    resetRef.current = reset;
  }, [reset]);

  type TtsPlaybackMeta = Omit<TtsEventDetail, "audio"> | undefined;

  const playTtsAndPauseStt = async (
    text: string,
    voice?: string,
    meta?: TtsPlaybackMeta,
    gender?: "male" | "female",
    skipResume?: boolean
  ) => {
    // Small helper to robustly ensure STT remains suppressed while audio is being prepared/played
    const ensureSttSuppressedDuringPlayback = () => {
      try {
        setSttSuppressed(true);
        isSuppressingSttRef.current = true;
      } catch {}
    };
    ensureSttSuppressedDuringPlayback();
    try { debugEventBus.emitEvent?.('info', 'TTS', 'play_start', { snippet: (text || "").slice(0,80), forced: (meta as any)?.forceResume === true, ts: Date.now() }); } catch {}
    if (!text) return;
    stopActiveTtsPlayback();
    isPlayingAudioRef.current = true;
    
    // CRITICAL: Clear any pending auto-send timers FIRST to prevent race conditions
    // where a timer fires and sends a message while TTS is starting
    if (autoSendFinalTimerRef.current) {
      window.clearTimeout(autoSendFinalTimerRef.current);
      autoSendFinalTimerRef.current = null;
    }
    autoSendPendingTextRef.current = null;
    
    // NUCLEAR OPTION: Enter deaf mode IMMEDIATELY before doing anything else.
    // This ensures ALL STT results are discarded during TTS playback.
    // Even if the mic somehow stays active, results will be ignored.
    try {
      enterDeafMode(); // Sets deafUntil to MAX_SAFE_INTEGER until TTS ends
    } catch {}
    
    // ALWAYS stop STT before playing TTS to prevent mic from picking up audio
    // Set suppression FIRST to prevent any auto-restart
    try {
      setSttSuppressed(true, false, 'tts');
    } catch {}
    isSuppressingSttRef.current = true;
    
    // Track whether the mic was actively listening *before* we started TTS
    // so we can deterministically restore it when playback finishes. We consider
    // a mic 'paused for TTS' only if it was actively listening and the user
    // hadn't explicitly toggled it off.
    // Consider mic-start-in-flight or an explicit forceResume marker in meta
    const forced = (meta as any)?.forceResume === true;
    wasMicPausedForTtsRef.current = Boolean((isListening || forced) && !userToggledOffRef.current);
    // Only mark for resume if we actually paused the mic due to TTS.
    // This avoids accidental restarts when voice-mode is enabled but mic
    // wasn't actively listening (edge conditions, paused state, etc.).
    resumeListeningRef.current = Boolean(wasMicPausedForTtsRef.current);

    // Local helpers to coordinate resume once TTS finishes. We may have two
    // triggers for TTS completion: the actual audio 'ended' event and our
    // estimated duration timer. Only run resume logic once.
    const ttsResumeExecuted = { current: false } as { current: boolean };
    const clearTtsEstimatedTimer = (timerRef: { current: number | null }) => {
      try {
        if (timerRef.current) {
          window.clearTimeout(timerRef.current as number);
          timerRef.current = null;
        }
      } catch {}
    };

    const RESUME_DELAY_AFTER_TTS_MS = 50; // small buffer after TTS end (use estimate-driven timing)

    const doTtsResume = (skipResumeLocal = false) => {
      // Don't resume until audio playback has actually finished. If this was
      // triggered by the estimate timer but audio is still playing, poll
      // until playback ends so we do not clear suppression prematurely.
      const tryResumeWhenSafe = () => {
        try {
          if (ttsResumeExecuted.current) return;
          if (isPlayingAudioRef.current) {
            // Try again shortly; keep suppression in place
            window.setTimeout(tryResumeWhenSafe, 200);
            return;
          }

          // Safe to resume now
          ttsResumeExecuted.current = true;
          isSuppressingSttRef.current = false;
          try { debugEventBus.emitEvent?.('info','TTS','resuming',{ skipResumeLocal, wasMicPausedForTts: wasMicPausedForTtsRef.current, resumeListening: resumeListeningRef.current, ts: Date.now() }); } catch {}
          try {
            exitDeafMode();
          } catch {}

          try {
            // Clear suppression and skip cooldown so startListening can proceed immediately
            setSttSuppressed(false, true);
          } catch {}

          // Use a small deaf buffer upon resumption to avoid trailing echo but keep it
          // minimal (only a few ms) because we're relying on the estimate to time the resume.
          const RESUME_DEAF_BUFFER_MS = 50;
          try {
            exitDeafMode(RESUME_DEAF_BUFFER_MS);
          } catch {}

          if (skipResumeLocal || skipResume) return;

          const shouldResumeDueToTts = wasMicPausedForTtsRef.current && !userToggledOffRef.current;

          if (shouldResumeDueToTts) {
            wasMicPausedForTtsRef.current = false;
            resumeListeningRef.current = false;
            try {
              console.debug("playTtsAndPauseStt: resuming STT due to TTS-paused mic", { delay: RESUME_DELAY_AFTER_TTS_MS });
            } catch (e) {}
            attemptStartListening(RESUME_DELAY_AFTER_TTS_MS);
            // Safety: if start doesn't take after a short grace period, try one more time
            try {
              window.setTimeout(() => {
                try {
                  if (voiceModeRef.current && !isListening && !userToggledOffRef.current) {
                    console.debug("playTtsAndPauseStt: retrying STT start after resume attempt");
                    try {
                      if (!canStartListening()) return;
                    } catch (e) {}
                    start();
                  }
                } catch (e) {
                  // ignore retry failures
                }
              }, 800);
            } catch (e) {}
          } else if (resumeListeningRef.current) {
            // Fallback: only resume if we explicitly marked resumeListen before
            resumeListeningRef.current = false;
            try {
              console.debug("playTtsAndPauseStt: resuming STT (fallback)", { delay: RESUME_DELAY_AFTER_TTS_MS });
            } catch (e) {}
            attemptStartListening(RESUME_DELAY_AFTER_TTS_MS);
            try {
              window.setTimeout(() => {
                try {
                  if (voiceModeRef.current && !isListening && !userToggledOffRef.current) {
                    console.debug("playTtsAndPauseStt: retrying STT start after fallback resume attempt");
                    try {
                      if (!canStartListening()) return;
                    } catch (e) {}
                    start();
                  }
                } catch (e) {
                  // ignore retry failures
                }
              }, 800);
            } catch (e) {}
          } else {
            // Do not auto-start merely because voiceMode is enabled if the mic was idle at TTS start.
            try {
              console.debug("playTtsAndPauseStt: not resuming STT because mic was idle before TTS and no resume marker set");
            } catch (e) {}
          }
        } catch (e) {
          console.error("Error while attempting safe resume after TTS:", e);
        }
      };

      tryResumeWhenSafe();
    };

    // Timer used when we estimate TTS length based on text so we can resume
    // STT even if the audio 'ended' event is delayed or missing.
    const ttsEstimatedEndTimerRef: { current: number | null } = { current: null };

    // Use abort() for immediate stop - stop() may allow some processing to continue
    try {
      abort();
    } catch {}
    // Also call stop() as backup
    try {
      stop();
    } catch {}
    
    // Reset the STT transcript to clear any buffered audio that might have been captured
    try {
      reset();
    } catch {}

    // Also clear the visible input box so TTS playback doesn't leave
    // partial user text in the textbox while the assistant speaks.
    try {
      baseInputRef.current = "";
      setInput("");
    } catch (e) {}
    
    // Wait for mic hardware to fully release before playing audio
    // This is critical to prevent self-capture
    // Increased from 500ms to 700ms (+40%) for better separation and robustness
    await new Promise((resolve) => setTimeout(resolve, 700));

    // Estimate TTS playback duration so we can schedule a resume using the estimate
    // (we will rely ONLY on this estimate to resume STT per user request).
    // Use the shared estimator from utils so it can be tested in isolation.
    const estimatedMs = estimateTtsDurationMs(text);
    try {
      // Clear any prior timers first
      clearTtsEstimatedTimer(ttsEstimatedEndTimerRef);
      const ESTIMATE_RESUME_BUFFER_MS = 50; // small buffer after estimate before resuming
      const TTS_ESTIMATE_MULTIPLIER = 1.35; // increase estimate by 35% before resuming
      const resumeDelay = Math.round(estimatedMs * TTS_ESTIMATE_MULTIPLIER) + ESTIMATE_RESUME_BUFFER_MS;
      try {
        debugEventBus.emitEvent?.('info', 'TTS', 'estimated_resume_scheduled', { estimatedMs, resumeDelay, multiplier: TTS_ESTIMATE_MULTIPLIER });
      } catch {}
      // Schedule resume using only the estimate (do not resume on audio ended)
      ttsEstimatedEndTimerRef.current = window.setTimeout(() => {
        try {
          debugEventBus.emitEvent?.('info', 'TTS', 'estimated_resume_fired', { estimatedMs, resumeDelay, multiplier: TTS_ESTIMATE_MULTIPLIER });
        } catch {}
        doTtsResume();
      }, resumeDelay);

      // Ensure global STT suppression lasts at least for the estimated TTS duration
      // plus a small safety buffer to avoid races where other components may
      // attempt to start listening concurrently with audio playback ending.
      try {
        const SAFETY_BUFFER_MS = 500;
        setSttSuppressedFor(resumeDelay + SAFETY_BUFFER_MS, 'tts');
      } catch (e) {
        // ignore failures to set suppression
      }
    } catch (e) {
      // ignore timer scheduling errors
    }

    try {
      // Try streaming first for low latency, fall back to buffered playback
      // and finally to browser TTS if needed.
      // Use a sanitized version for TTS so the speech engine does not try
      // to pronounce raw symbols; keep the original text for the message
      // content shown in the chat.
      const ttsText = sanitizeForTts(text);
      try {
        await speakRemoteStream(ttsText, voice, meta);
      } catch (streamErr) {
        try {
          await speakRemote(ttsText, voice, meta);
        } catch (bufErr) {
          try {
            // Show fallback notice to all users so they know why the voice changed
            setFallbackNotice("High-quality voice unavailable. Using browser fallback.");
            setTimeout(() => setFallbackNotice(null), 4000);

            if (ttsAvailable && speakAsync) {
              await speakAsync(ttsText, "en-US", gender);
            } else if (ttsAvailable) {
              speak(ttsText, "en-US", gender);
            }
          } catch (e) {
            console.error("TTS playback failed:", e);
          }
        }
      }
    } finally {
      isPlayingAudioRef.current = false;
      // Record the tts end time.
      lastTtsEndRef.current = Date.now();
      // Keep the estimate timer in place; if playback fails critically, we
      // will still fall back to the estimate. Do not clear the estimated timer
      // here so the single source of truth (the estimate) controls resumption when appropriate.
      try {
        debugEventBus.emitEvent?.('info', 'TTS', 'playback_finished', { estimatedMs });
      } catch {}
      // Ensure we attempt resume now that audio actually ended; the resume
      // helper will check safety and only resume when appropriate.
      try {
        doTtsResume();
      } catch (e) {
        console.warn('Error triggering TTS resume after playback finished', e);
      }
    }
  };

  const [showProceedHint, setShowProceedHint] = useState(false);

  const emitStageReadinessPrompt = useCallback(
    async (stageIndex: number, result: StageCompletionResult) => {
      const stage = stages[stageIndex];
      if (!stage) return;

      const stageTitle = stage.title ?? "this stage";
      const ruleKey = stage.title?.toLowerCase().replace(/\s+/g, " ").trim();
      const specializedPrompt = ruleKey === "physical examination";
      const cautionText = specializedPrompt
        ? "Are you sure you have gathered enough physical exam findings before moving on, Doctor?"
        : `Are you sure you have enough information before leaving ${stageTitle.toLowerCase()}?`;

      // Show the hint when this prompt is triggered
      setShowProceedHint(true);

      const roleName = stage.role ?? "Virtual Assistant";
      const normalizedRoleKey = resolveChatPersonaRoleKey(stage.role, roleName);
      const personaMeta = await ensurePersonaMetadata(normalizedRoleKey);
      try {
        console.debug("emitStageReadinessPrompt personaMeta", { normalizedRoleKey, personaMeta });
      } catch (e) {}

      let voiceSex: "male" | "female" | "neutral" =
        personaMeta?.sex === "male" ||
          personaMeta?.sex === "female" ||
          personaMeta?.sex === "neutral"
          ? (personaMeta.sex as "male" | "female" | "neutral")
          : "neutral";

      const voiceForRole = getOrAssignVoiceForRole(normalizedRoleKey, attemptId, {
        preferredVoice: personaMeta?.voiceId,
        sex: voiceSex,
      });

      const assistantMsg = chatService.createAssistantMessage(
        cautionText,
        stageIndex,
        personaMeta?.displayName ?? roleName,
        personaMeta?.portraitUrl,
        voiceForRole,
        voiceSex,
        normalizedRoleKey
      );

      upsertPersonaDirectory(normalizedRoleKey, {
        displayName: personaMeta?.displayName ?? roleName,
        portraitUrl: personaMeta?.portraitUrl,
        voiceId: voiceForRole,
        sex: personaMeta?.sex,
      });

      // Do not append the same readiness prompt more than once in this conversation
      const alreadyShown = messages.some(
        (m) => m.role === "assistant" && m.content === cautionText
      );
      if (!alreadyShown) {
        appendAssistantMessage(assistantMsg);
      }

      if (!alreadyShown && ttsEnabled && cautionText) {
        try {
          const guardMeta: TtsPlaybackMeta = {
            roleKey: normalizedRoleKey,
            displayRole: assistantMsg.displayRole,
            role: roleName,
            caseId,
            metadata: {
              stageId: stage.id,
              stageGuard: true,
              metrics: result.metrics,
            },
          };
          await playTtsAndPauseStt(cautionText, voiceForRole, guardMeta);
        } catch (ttsErr) {
          console.error("Stage readiness prompt TTS failed", ttsErr);
        }
      }
    },
    [
      attemptId,
      caseId,
      personaDirectory,
      ensurePersonaMetadata,
      playTtsAndPauseStt,
      setMessages,
      stages,
      ttsEnabled,
      upsertPersonaDirectory,
    ]
  );

  // Microphone button handlers
  const { handleStart, handleStop, handleCancel } = useMicButton(
    textareaRef,
    isListening,
    start,
    stop,
    reset,
    setInput
  );

  // Helper: stop listening and (when voiceMode is active) send the current
  // transcript automatically. Uses a short delay to allow STT final event to
  // flush into `transcript` state when necessary.
  const stopAndMaybeSend = () => {
    try {
      stop();
    } catch (e) {
      // ignore
    }
    // Allow a slightly longer pause here as well so that manual stops
    // tolerate short thinking pauses before auto-sending.
    setTimeout(() => {
      try {
        // Cancel any final-timer since we're forcing a send after manual stop
        if (autoSendFinalTimerRef.current) {
          window.clearTimeout(autoSendFinalTimerRef.current);
          autoSendFinalTimerRef.current = null;
        }
        const t = transcript?.trim();
        const toSend =
          baseInputRef.current && baseInputRef.current.trim().length > 0
            ? baseInputRef.current
            : t;
        if (voiceMode && toSend) {
          // Use the trigger wrapper so the send button flashes when auto-sent
          void triggerAutoSend(toSend);
        }
      } catch (e) {
        console.error("Error auto-sending after stop:", e);
      }
    }, 600);
  };

  const lastSubmissionRef = useRef<{ content: string; timestamp: number } | null>(null);
  // Track message ids currently being sent to avoid duplicate send requests
  const sendingMessageIdsRef = useRef<Set<string> | null>(new Set());

  // sendUserMessage helper (used by manual submit and auto-send)
  const sendUserMessage = async (text: string, existingMessageId?: string, options?: { source?: 'auto' | 'manual' | 'retry' }) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Detect explicit persona-switch requests (e.g., "can I talk with the owner")
    try {
      const personaSwitch = detectPersonaSwitch(trimmed);
      if (personaSwitch) {
        // Only switch if different
        if (personaSwitch !== activePersona) {
          // Append the user's original message immediately so it appears in the conversation
          try {
            const userMsg = chatService.createUserMessage(trimmed, currentStageIndex);
              // Ensure this locally-appended message is attributed to the current UI persona
              try { (userMsg as any).personaRoleKey = activePersona; } catch {}
              setMessages((prev) => [...prev, userMsg]);
          } catch (e) {
            console.warn("Failed to append local user message for persona switch", e);
          }

          // Clear the input since we've committed the spoken text to the conversation
          try {
            setInput("");
            baseInputRef.current = "";
          } catch (e) {}

          // Switch persona after a short delay so the student sees their spoken text first
          // Wait 3 seconds so the student's message is visible in the current persona
          // conversation stream before switching focus to the requested persona.
          handleSetActivePersona(personaSwitch, { delayMs: 3000, suppressAutoStartMs: 3000 });
        }
        return;
      }
    } catch (e) {
      // non-blocking
    }

    // If the user asks the nurse for lab/tests before the Laboratory stage has started,
    // have the nurse acknowledge the request rather than forwarding to the server.
    try {
      const stage = stages?.[currentStageIndex];
      const stageKey = stage?.title?.toLowerCase().trim() ?? "";
      const isLabStage = /laboratory|lab|tests/.test(stageKey);
      // If it's a lab request and we're a nurse before the lab stage, acknowledge locally.
      // Previously this ignored explicit manual sends; treat manual sends the same and provide
      // a clear acknowledgement so the student knows the request will be actioned in the Lab stage.
      if (!isLabStage && activePersona === "veterinary-nurse" && looksLikeLabRequest(trimmed)) {
        // Append the user's original request to the chat so it doesn't appear to disappear
        try {
          const userMsg = chatService.createUserMessage(trimmed, currentStageIndex);
          setMessages((prev) => [...prev, userMsg]);
        } catch (e) {
          console.warn("Failed to append local user message for lab request", e);
        }

        const personaMeta = await ensurePersonaMetadata("veterinary-nurse");
        const ack = "We'll request those tests; the results will be available in the Lab stage.";
        const assistantMsg = chatService.createAssistantMessage(
          ack,
          currentStageIndex,
          personaMeta?.displayName ?? "Nurse",
          personaMeta?.portraitUrl,
          personaMeta?.voiceId,
          personaMeta?.sex as any,
          "veterinary-nurse"
        );
        appendAssistantMessage(assistantMsg);
        if (ttsEnabled) {
          try {
            await playTtsAndPauseStt(ack, personaMeta?.voiceId, { roleKey: "veterinary-nurse", displayRole: assistantMsg.displayRole, role: "veterinary-nurse", caseId } as any, personaMeta?.sex as any);
          } catch (e) {}
        }
        // do not forward this request to the server
        baseInputRef.current = "";
        setInput("");
        return;
      }
    } catch (e) {
      // ignore
    }

    // Robust duplication check using ref (ignores slow state updates)
    // If the exact same content is submitted within 2.5 seconds, block it.
    const now = Date.now();
    if (
      lastSubmissionRef.current &&
      lastSubmissionRef.current.content === trimmed &&
      now - lastSubmissionRef.current.timestamp < 2500
    ) {
      console.warn("Duplicate submission blocked by ref-check:", { text: trimmed, source: options?.source ?? 'unknown' });
      try { debugEventBus.emitEvent?.('info','AutoSend','blocked_duplicate_ref',{ text: trimmed, source: options?.source ?? 'unknown' }); } catch {};
      // If this was an auto-send, show a small hint to the user explaining why it was blocked
      if (options?.source === 'auto') {
        try { setTimepointToast({ title: "Auto-send blocked", body: "Message was detected as a duplicate — tap Send to force it." }); setTimeout(() => hideTimepointToastWithFade(300), 2400); } catch {}
        return;
      }
      // manual sends should bypass this guard (user intent to force-send)
    }
    
    // Record the UI-selected persona at the moment of send to avoid race
    // conditions where the server reply might be attributed to another role.
    selectedPersonaAtSendRef.current = activePersona;
    try { console.debug("sendUserMessage: selectedPersonaAtSend", { selectedPersonaAtSend: selectedPersonaAtSendRef.current, activePersona }); } catch (e) {}

    // Update submission tracker immediately
    lastSubmissionRef.current = { content: trimmed, timestamp: now };

    // Run a lightweight stage evaluation every time the user sends a message
    try {
      const stageEval = emitStageEvaluation(caseId, currentStageIndex, messages.concat([{ role: "user", content: trimmed, stageIndex: currentStageIndex } as any]));
      console.debug("Stage evaluation on sendUserMessage", stageEval);
    } catch (e) {
      // non-blocking
    }

    try {
      // Also check against React state for slightly older duplicates
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      if (lastUser && lastUser.content) {
        const normalize = (s: string) =>
          String(s)
            .toLowerCase()
            .replace(/[^a-z0-9\s]/gi, "")
            .replace(/\s+/g, " ")
            .trim();
        const normLast = normalize(lastUser.content);
        const normTrim = normalize(trimmed);
        const lastTs = lastUser.timestamp ? Date.parse(lastUser.timestamp) : NaN;
        const recent = Number.isFinite(lastTs) ? Date.now() - lastTs < 3000 : false;
        if (normLast && normTrim && normLast === normTrim && recent) {
          // duplicate detected; do not re-send
          console.debug("Duplicate detected against last user message - skipping send", { text: trimmed, source: options?.source ?? 'unknown' });
          if (options?.source === 'auto') {
            try { setTimepointToast({ title: "Auto-send blocked", body: "Duplicate of your previous message — tap Send to force it." }); setTimeout(() => hideTimepointToastWithFade(300), 2400); } catch {}
            return;
          }
          // manual submission should proceed despite duplicate detection
        }
      }
    } catch (e) {
      // ignore normalization errors and proceed
    }

    // If we're in the Physical Examination stage and the user is asking
    // about lab tests/results, reply very briefly client-side and do not
    // forward the query to the server. This keeps the UX tight and avoids
    // the assistant inventing diagnostic data during the physical exam.
    try {
      const stage = stages?.[currentStageIndex];
      const stageKey = stage?.title?.toLowerCase().trim() ?? "";
      const physicalStage = stageKey === "physical examination" || stageKey === "physical";
      const labRegex = /\b(lab|labs|bloodwork|bloods|blood|cbc|chemistry|biochemistry|hematology|urine|urinalysis|radiograph|x-?ray|xray|imaging|ultrasound|test|tests|results|culture|pcr|serology)\b/i;
      if (physicalStage && labRegex.test(trimmed)) {
        const roleLabel = stage?.role
          ? (stage.role === "owner" ? "Owner" : stage.role.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
          : "Assistant";

        const normalizedRoleKey = resolveChatPersonaRoleKey(stage?.role, roleLabel);
        const personaMeta = await ensurePersonaMetadata(normalizedRoleKey);
        const voiceSex: "male" | "female" | "neutral" =
          personaMeta?.sex === "male" ||
          personaMeta?.sex === "female" ||
          personaMeta?.sex === "neutral"
            ? (personaMeta.sex as "male" | "female" | "neutral")
            : "neutral";
        try {
          console.debug("physical-stage personaMeta", { normalizedRoleKey, personaMeta, voiceSex });
        } catch (e) {}
        try {
          console.debug("physical-stage personaMeta", { normalizedRoleKey, personaMeta });
        } catch (e) {}
        const voiceForRole = getOrAssignVoiceForRole(normalizedRoleKey, attemptId, {
          preferredVoice: personaMeta?.voiceId,
          sex: personaMeta?.sex as any,
        });

        const brief = "We'll request that and we'll get the results in the Lab stage";
        const assistantMsg = chatService.createAssistantMessage(
          brief,
          currentStageIndex,
          personaMeta?.displayName ?? roleLabel,
          personaMeta?.portraitUrl,
          voiceForRole,
          voiceSex,
          normalizedRoleKey
        );
        appendAssistantMessage(assistantMsg);
        // If the mic is currently listening, mark it so the TTS helper knows
        // to resume it when playback finishes. This is a defensive set in case
        // the helper runs slightly later.
        try {
          wasMicPausedForTtsRef.current = !!isListening && !userToggledOffRef.current;
          console.debug("physical-stage: wasMicPausedForTts set", { wasListening: isListening, marker: wasMicPausedForTtsRef.current });
        } catch (e) {}

        if (ttsEnabled && brief) {
          try {
            await playTtsAndPauseStt(brief, voiceForRole, { roleKey: normalizedRoleKey, displayRole: assistantMsg.displayRole, role: stage?.role ?? roleLabel, caseId } as any, personaMeta?.sex as any);
          } catch (e) {
            /* ignore TTS errors for this brief prompt */
          }
        }

        // Ensure voice-mode is re-enabled after this brief assistant message
        // unless the user explicitly toggled voice off. We schedule a short
        // delayed check so it doesn't race with playTtsAndPauseStt's resume.
        try {
          if (!userToggledOffRef.current) {
            setTimeout(() => {
              try {
                if (!userToggledOffRef.current && !isListening && voiceModeRef.current) {
                  console.debug("physical-stage: forcing voice mode enable after brief assistant message");
                  setVoiceModeEnabled(true);
                }
              } catch (e) {
                console.warn("Failed to force voice mode enable after assistant brief", e);
              }
            }, 800);
          }
        } catch (e) {
          // ignore
        }

        // Mark base input empty and return without sending to server
        baseInputRef.current = "";
        setInput("");
        reset();
        return;
      }
    } catch (e) {
      // If detection or TTS fails, fall back to normal send behavior
      console.warn("Physical-stage lab-query handler failed", e);
    }

      // Simplified behavior: instead of a general LLM-based completeness check,
      // only treat very short (<=2 words) voice fragments as potentially
      // incomplete and wait for continuation. This avoids false positives.
      // ALSO: check if the phrase ends with an incomplete marker (article, preposition, etc.)
      if (voiceMode && !awaitingContinuationRef.current) {
        const tokenCount = String(trimmed).split(/\s+/).filter(Boolean).length;
        const lastWord = String(trimmed).split(/\s+/).pop()?.toLowerCase() || "";
        const incompleteMarkers = [
          // Articles - strong signal of incomplete thought
          "the", "a", "an",
          // Prepositions often followed by object
          "of", "at", "in", "on", "to", "for", "with", "by", "from", "about", "into",
          // Common continuation patterns
          "is", "are", "was", "were", "and", "or", "but", "that", "which",
          "my", "your", "his", "her", "its", "our", "their", "this", "these", "those",
        ];
        const endsIncomplete = endsWithIncompleteMarker(baseInputRef.current || "");
        
        if (tokenCount <= 2 || endsIncomplete) {
          // Insert assistant placeholder '...' and keep listening for continuation
          const stage = stages?.[currentStageIndex];
          const roleLabel = stage?.role
            ? (stage.role === "owner" ? "Owner" : stage.role.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()))
            : "Assistant";
          const placeholder = chatService.createAssistantMessage(
            "...",
            currentStageIndex,
            roleLabel,
            undefined,
            undefined,
            undefined,
            undefined
          );
          setMessages((prev) => [...prev, placeholder]);
          awaitingContinuationRef.current = { partial: trimmed, placeholderId: placeholder.id };
          // reflect in input but do not send to server yet
          baseInputRef.current = trimmed;
          setInput(trimmed);
          console.debug("Waiting for continuation - incomplete phrase detected", { tokenCount, lastWord, endsWithIncompleteMarker, trimmed });
          // schedule an auto-send if no continuation arrives within 6s
          if (autoSendSttRef.current) {
            if (placeholderAutoSendTimerRef.current) {
              window.clearTimeout(placeholderAutoSendTimerRef.current);
              placeholderAutoSendTimerRef.current = null;
            }
            placeholderAutoSendTimerRef.current = window.setTimeout(() => {
              if (awaitingContinuationRef.current) {
                // Re-check if still incomplete before sending
                const currentText = baseInputRef.current?.trim() || "";
                const currentLastWord = currentText.split(/\s+/).pop()?.toLowerCase() || "";
                if (incompleteMarkers.includes(currentLastWord)) {
                  console.debug("Still incomplete after wait, keeping placeholder", { currentLastWord });
                  // Extend the wait - don't send yet
                  placeholderAutoSendTimerRef.current = window.setTimeout(() => {
                    if (awaitingContinuationRef.current) {
                      const pid = awaitingContinuationRef.current.placeholderId;
                      setMessages((prev) => prev.filter((m) => m.id !== pid));
                      awaitingContinuationRef.current = null;
                      // Give up and send anyway after extended wait
                      try {
                        void triggerAutoSend(baseInputRef.current || "");
                      } catch (e) {
                        console.warn("Auto-send of placeholder fragment failed", e);
                      }
                    }
                    placeholderAutoSendTimerRef.current = null;
                  }, 4000); // Another 4s wait
                  return;
                }
                
                const pid = awaitingContinuationRef.current.placeholderId;
                setMessages((prev) => prev.filter((m) => m.id !== pid));
                awaitingContinuationRef.current = null;
                // trigger send of the current base input
                try {
                  void triggerAutoSend(baseInputRef.current || "");
                } catch (e) {
                  console.warn("Auto-send of placeholder fragment failed", e);
                }
              }
              placeholderAutoSendTimerRef.current = null;
            }, 4000); // Wait 4s (reduced from 6s) before auto-sending incomplete fragments
          }
          // do not proceed with sending
          return;
        }
      }

    if (!existingMessageId && voiceMode && ttsEnabled) {
      const normalize = (value: string) =>
        value
          .toLowerCase()
          .replace(/[^a-z0-9\s]/gi, "")
          .replace(/\s+/g, " ")
          .trim();
      const normalizedInput = normalize(trimmed);
      if (normalizedInput) {
        const lastAssistant = [...messages]
          .slice()
          .reverse()
          .find((message) =>
            message.role === "assistant" && message.content?.trim()
          );
        if (lastAssistant) {
          const normalizedAssistant = normalize(lastAssistant.content ?? "");
          const assistantTimestamp = lastAssistant.timestamp
            ? Date.parse(lastAssistant.timestamp)
            : NaN;
          const assistantIsRecent = Number.isFinite(assistantTimestamp)
            ? Math.abs(Date.now() - assistantTimestamp) < 8000
            : true;
          if (
            normalizedAssistant &&
            normalizedAssistant === normalizedInput &&
            assistantIsRecent
          ) {
            console.debug(
              "Skipping auto-send: detected echo of assistant speech",
              trimmed
            );
            baseInputRef.current = "";
            setInput("");
            reset();
            return;
          }
        }
      }
    }

    let userMessage = null as Message | null;
    let snapshot: Message[] = [];

    // Guard: attempt to coalesce recent consecutive user messages from the same persona
    // into a single pending message to avoid duplicate or fragmented sends.
    const lastMsg = messages[messages.length - 1];
    if (!existingMessageId && lastMsg && lastMsg.role === "user") {
      try {
        // First, try bundling/coalescing when appropriate
        try {
          const { messages: coalesced, mergedMessage } = coalesceMessages(messages, trimmed, activePersona);
          if (mergedMessage) {
            // Use the coalesced messages snapshot and proceed using mergedMessage
            setMessages(coalesced);
            userMessage = mergedMessage as Message;
            snapshot = coalesced;
          }
        } catch (e) {}

        // Existing duplicate guard (uses a normalization heuristic)
        const normalize = (s: string) =>
          String(s)
            .toLowerCase()
            .replace(/[^a-z0-9\s]/gi, "")
            .replace(/\s+/g, " ")
            .trim();
        const normLast = normalize(lastMsg.content ?? "");
        const normTrim = normalize(trimmed);
        const lastTs = lastMsg.timestamp ? Date.parse(lastMsg.timestamp) : NaN;
        const recent = Number.isFinite(lastTs) ? Date.now() - lastTs < 5000 : false;

        // Only suppress if texts match exactly (normalized) and the previous
        // message was recent to avoid blocking legitimately new consecutive messages.
        if (normLast && normTrim && normLast === normTrim && recent) {
          console.warn("Suppressed consecutive duplicate user message to avoid duplicates", { lastId: lastMsg.id, newText: trimmed, source: options?.source ?? 'unknown' });
          try { debugEventBus.emitEvent?.('info','AutoSend','blocked_consecutive_user',{ lastId: lastMsg.id, text: trimmed, source: options?.source ?? 'unknown' }); } catch {};
          if (options?.source === 'auto') {
            try { setTimepointToast({ title: "Auto-send blocked", body: "A recent message was already sent — tap Send to force it." }); setTimeout(() => hideTimepointToastWithFade(300), 2400); } catch {}
            return;
          }
        }
      } catch (e) {}
      // Manual sends override this guard and will proceed
    }

    // Record the UI-selected persona at the moment of send to avoid race
    // conditions where the server reply might be attributed to another role.
    selectedPersonaAtSendRef.current = activePersona;

    // If the current active persona is the nurse and the user is sending a message,
    // emit a brief nurse acknowledgement message immediately so the user sees a
    // responsive acknowledgement from the chosen persona before the server reply.
    // However, avoid sending the pre-lab acknowledgement when the user's message
    // is clearly a physical-exam request (e.g., "results of cardiovascular exam").
    if (!existingMessageId && activePersona === "veterinary-nurse" && !looksLikePhysicalRequest(trimmed)) {
      (async () => {
        try {
          // Do not repeat the same nurse acknowledgement phrase more than once per attempt
          if (nurseAckGivenRef.current) return;
          const personaMeta = await ensurePersonaMetadata("veterinary-nurse");
          const ackText = NURSE_ACK;
          const ackMsg = chatService.createAssistantMessage(
            ackText,
            currentStageIndex,
            personaMeta?.displayName ?? "Nurse",
            personaMeta?.portraitUrl,
            personaMeta?.voiceId,
            personaMeta?.sex as any,
            "veterinary-nurse"
          );
          // Mark as ephemeral placeholder so it doesn't block or dedupe
          // the real assistant response that will arrive from the server.
          try { (ackMsg as any).ephemeral = true; } catch {}
          appendAssistantMessage(ackMsg);
          nurseAckGivenRef.current = true;
          if (ttsEnabled) {
            try {
              await playTtsAndPauseStt(ackText, personaMeta?.voiceId, { roleKey: "veterinary-nurse", displayRole: personaMeta?.displayName ?? "Nurse", role: "veterinary-nurse", caseId } as any, personaMeta?.sex as any);
            } catch (e) {
              /* ignore TTS errors for ack */
            }
          }
        } catch (e) {
          // ignore: non-blocking ack
        }
      })();
    }

    if (existingMessageId) {
      // Mark existing message as pending and reuse it
      snapshot = messages.map((m) =>
        m.id === existingMessageId ? { ...m, status: "pending" } : m
      );
      setMessages(snapshot);
      userMessage = snapshot.find((m) => m.id === existingMessageId) ?? null;
    } else {
      userMessage = chatService.createUserMessage(trimmed, currentStageIndex);
      // Associate the outgoing user message with the currently active persona tab
      try { (userMessage as any).personaRoleKey = activePersona; } catch (e) {}
      // Remember which persona was used for this outbound message so the
      // assistant reply can be aligned with the user's chosen persona.
      lastSentPersonaRef.current = activePersona;
      snapshot = [...messages, userMessage];
      setMessages(snapshot);
    }
    setInput("");
    baseInputRef.current = "";
    // Clear hint on send
    setShowProceedHint(false);
    if (voiceMode) {
      reset();
    }

    const stageResult = evaluateStageCompletion(currentStageIndex, snapshot);
    const hasNextStage = currentStageIndex < stages.length - 1;
    let shouldAutoAdvance = false;

    const lastMessage = messages[messages.length - 1];
    // Check the last 3 messages for the guard prompt to be robust against
    // intervening system messages or UI artifacts.
    const recentMessages = messages.slice(-3).reverse();
    const isRecentMessageGuard = recentMessages.some(
      (msg) =>
        msg.role === "assistant" &&
        (msg.content?.includes(
          "Are you sure you have gathered enough physical exam findings"
        ) ||
          msg.content?.includes(
            "Are you sure you have enough information before leaving"
          ))
    );

    const guardActive =
      (advanceGuard && advanceGuard.stageIndex === currentStageIndex) ||
      isRecentMessageGuard;
    if (guardActive) {
      const guardResponse = detectAdvanceGuardResponse(trimmed);
      if (guardResponse === "confirm" && hasNextStage) {
        setAdvanceGuard(null);
        clearStageIntentLocks();
        shouldAutoAdvance = true;
      } else if (guardResponse === "decline") {
        setAdvanceGuard(null);
        lockStageIntent("stay");
        shouldAutoAdvance = false;
      }
    }

    let readinessSignal: StageReadinessDetection | null = null;
    if (hasNextStage) {
      readinessSignal = classifyStageReadinessIntent(trimmed);
      if (readinessSignal.intent === "stay") {
        lockStageIntent("stay");
      } else if (readinessSignal.intent === "rollback") {
        lockStageIntent("rollback");
      }
    }

    const stageLocked = isStageIntentLocked();

    if (!shouldAutoAdvance && hasNextStage && readinessSignal?.intent === "advance") {
      if (stageResult.status === "ready" && !stageLocked) {
        shouldAutoAdvance = true;
        // Offer the user a visible confirmation before advancing (YES/NO banner)
        const nextIndex = Math.min(currentStageIndex + 1, stages.length - 1);
        const nextTitle = stages[nextIndex]?.title ?? `Stage ${nextIndex + 1}`;
        setPendingStageAdvance({ stageIndex: nextIndex, title: nextTitle });
        try {
          debugEventBus.emitEvent?.("info", "StageIntent", "pendingAdvance", {
            nextStageIndex: nextIndex,
            nextStageTitle: nextTitle,
            heuristics: readinessSignal?.heuristics,
          });
        } catch (e) {}
      } else if (stageResult.status !== "ready") {
        // Allow a high-confidence user request to move into Physical Examination
        // even if assistant findings are not yet present. This supports students
        // explicitly asking to start the exam (e.g., "college basketball" → cardiovascular).
        try {
          const nextTitleText = stages[currentStageIndex + 1]?.title ?? "";
          if (
            readinessSignal?.confidence === "high" &&
            nextTitleText.toLowerCase().includes("physical") &&
            !stageLocked
          ) {
            shouldAutoAdvance = true;
            const nextIndex = Math.min(currentStageIndex + 1, stages.length - 1);
            const nextTitle = stages[nextIndex]?.title ?? `Stage ${nextIndex + 1}`;
            setPendingStageAdvance({ stageIndex: nextIndex, title: nextTitle });
            try {
              debugEventBus.emitEvent?.("info", "StageIntent", "forcedAdvance", {
                nextStageIndex: nextIndex,
                nextStageTitle: nextTitle,
                heuristics: readinessSignal?.heuristics,
                reason: "user-high-confidence-physical",
              });
            } catch (e) {}
            reset();
            baseInputRef.current = "";
            return;
          }
        } catch (e) {
          // ignore detection errors
        }

        // If we have already warned the user for this stage (guardActive), allow them to proceed
        // if they persist (intent === "advance").
        if (guardActive) {
          shouldAutoAdvance = true;
        } else {
          if (userMessage) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === userMessage!.id ? { ...m, status: "sent" } : m
              )
            );
          }
          setAdvanceGuard({
            stageIndex: currentStageIndex,
            askedAt: Date.now(),
            metrics: stageResult.metrics,
          });
          await emitStageReadinessPrompt(currentStageIndex, stageResult);
          reset();
          baseInputRef.current = "";
          return;
        }
      }
    } else if (
      !shouldAutoAdvance &&
      hasNextStage &&
      stageResult.status === "ready" &&
      guardActive &&
      !stageLocked
    ) {
      setAdvanceGuard(null);
    }

    if (shouldAutoAdvance) {
      clearStageIntentLocks();
      if (userMessage) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === userMessage!.id ? { ...m, status: "sent" } : m
          )
        );
      }
      reset();
      baseInputRef.current = "";
      scheduleAutoProceedRef.current?.();
      return;
    }

    // Prevent double-sends for the same message id when multiple triggers fire simultaneously
    if (!sendingMessageIdsRef.current) sendingMessageIdsRef.current = new Set<string>();
    if (userMessage && sendingMessageIdsRef.current.has(userMessage.id)) {
      console.debug("sendUserMessage: send already in progress for this message id, skipping duplicate send", { id: userMessage.id });
      try { debugEventBus.emitEvent?.('info','UI','send_skipped_duplicate_inflight',{ messageId: userMessage.id }); } catch {}
      return;
    }

    setIsLoading(true);
    try { debugEventBus.emitEvent?.('info','UI','send_started',{ stageIndex: currentStageIndex, activePersona, ts: Date.now() }); } catch {}

    try {
      // If we previously inserted a '...' placeholder waiting for continuation,
      // remove it now that we're sending the stitched message to the server.
      if (awaitingContinuationRef.current) {
        const pid = awaitingContinuationRef.current.placeholderId;
        setMessages((prev) => prev.filter((m) => m.id !== pid));
        awaitingContinuationRef.current = null;
        if (placeholderAutoSendTimerRef.current) {
          window.clearTimeout(placeholderAutoSendTimerRef.current);
          placeholderAutoSendTimerRef.current = null;
        }
      }

      // Capture payload for debug tracing (admin panel)
      try { setLastLlmPayload(snapshot.map(m => ({ role: m.role, content: m.content }))); } catch {}
      // Mark message as 'in-flight' to prevent duplicate sends
      try {
        if (userMessage && sendingMessageIdsRef.current) sendingMessageIdsRef.current.add(userMessage.id);
      } catch (e) {}

      const response = await chatService.sendMessage(
        snapshot,
        currentStageIndex,
        caseId,
        { attemptId }
      );
      try { setLastLlmResponse(response); } catch {}

      // Mark user message as sent immediately upon server receipt
      if (userMessage) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === userMessage!.id ? { ...m, status: "sent" } : m
          )
        );
      }

      // If server indicates this response should be suppressed (e.g. canned
      // physical-stage warning), do not append or play TTS for it.
      if ((response as any)?.suppress) {
        return;
      }
        // If server returned structuredFindings but no content, ensure lastLlmResponse still set
        try { if (!lastLlmResponse) setLastLlmResponse(response); } catch {}
      const stage = stages[currentStageIndex] ?? stages[0];
      const roleName = response.displayRole ?? stage?.role ?? "assistant";
      // Prefer the persona that sent the user message (if present) so an explicit
      // user-selected persona is honored over server defaults. Otherwise fall back
      // to server-specified persona or the current active persona.
      const userPersonaKey = userMessage && (userMessage as any).personaRoleKey && isAllowedChatPersonaKey((userMessage as any).personaRoleKey)
        ? (userMessage as any).personaRoleKey
        : null;

      // Choose persona in a robust order that prefers:
      // 1. persona used on the user message
      // 2. persona explicitly selected in the UI at send time
      // 3. persona used by lastSentPersonaRef
      // 4. server-provided persona
      // 5. active UI persona / stage-derived fallback

      let safePersonaRoleKey = chooseSafePersonaKey({
        userPersonaKey,
        selectedPersonaAtSend: selectedPersonaAtSendRef.current,
        lastSentPersona: lastSentPersonaRef.current,
        responsePersonaKey: response.personaRoleKey ?? null,
        activePersona: activePersona ?? null,
        stageRole: stage?.role ?? null,
        roleName: roleName ?? null,
      });

      // clear last sent persona marker when used
      lastSentPersonaRef.current = null;
      // clear the transient selected-at-send marker
      selectedPersonaAtSendRef.current = null;
      const normalizedPersonaKey = safePersonaRoleKey;
      // If we forced a persona (e.g., active persona or last-sent), prefer the persona directory
      // metadata (displayName, portrait, voice) for visual consistency.
      const personaEntry = normalizedPersonaKey ? personaDirectoryRef.current?.[normalizedPersonaKey] : undefined;

      const portraitUrl = response.portraitUrl;
      const serverVoiceId = normalizeVoiceId(response.voiceId);
      // Prefer patientSex (if provided by server) for pronoun/voice
      // selection; fall back to personaSex when patientSex is absent.
      const resolvedResponseSex =
        response.patientSex === "male" ||
        response.patientSex === "female" ||
        response.patientSex === "neutral"
          ? response.patientSex
          : response.personaSex;

      let responseVoiceSex: "male" | "female" | "neutral" =
        resolvedResponseSex === "male" ||
        resolvedResponseSex === "female" ||
        resolvedResponseSex === "neutral"
          ? resolvedResponseSex
          : "neutral";

      // If personaEntry provides a preferred sex/voice, prefer it for TTS selection
      if (personaEntry?.sex) responseVoiceSex = (personaEntry.sex as "male" | "female" | "neutral") ?? responseVoiceSex;
      const resolvedVoiceForRole = getOrAssignVoiceForRole(
        normalizedPersonaKey,
        attemptId,
        {
          preferredVoice: personaEntry?.voiceId ?? serverVoiceId,
          sex: responseVoiceSex,
        }
      );
      const assistantVoiceId = personaEntry?.voiceId ?? serverVoiceId ?? resolvedVoiceForRole;

      // Use the specific persona name and portrait if available in the directory, otherwise fall back
      // to server-provided or role name to guarantee the assistant appears as the selected persona.
      const existingPersona = normalizedPersonaKey ? personaDirectoryRef.current[normalizedPersonaKey] : undefined;
      // Prefer persona directory displayName when available. If not available,
      // avoid using a server-provided displayName that belongs to a different
      // persona (e.g., owner name shown when nurse was selected). Instead
      // fallback to a generic persona label derived from the normalized persona key.
      const finalDisplayName = existingPersona?.displayName ?? (normalizedPersonaKey ? (normalizedPersonaKey === "owner" ? "Owner" : "Nurse") : roleName);
      const finalPortraitUrl = existingPersona?.portraitUrl ?? portraitUrl;

      // Prefer structuredFindings from the server if present (authoritative)
      const structured = (response as any)?.structuredFindings as Record<string, string | null> | undefined;
      const displayNames: Record<string,string> = {
        heart_rate: 'Heart rate',
        respiratory_rate: 'Respiratory rate',
        temperature: 'Temperature',
        blood_pressure: 'Blood pressure',
      };
      let finalContent = response.content;
      if (structured && Object.keys(structured).length > 0) {
        const parts: string[] = [];
        for (const k of Object.keys(structured)) {
          const val = structured[k];
          const name = displayNames[k] ?? k;
          parts.push(`${name}: ${val ?? 'not documented'}`);
        }
        finalContent = parts.join(', ');
      }

      let aiMessage = chatService.createAssistantMessage(
        finalContent,
        currentStageIndex,
        finalDisplayName,
        finalPortraitUrl,
        assistantVoiceId,
        // pass the resolved sex (prefer patientSex)
        responseVoiceSex,
        safePersonaRoleKey,
        response.media
      );
      // Client-side guard: suppress long nurse findings dumps unless user requested specific params
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      const transformed = transformNurseAssistantMessage(aiMessage, stage, lastUser?.content);
      aiMessage = transformed.message;
      // Respect server-side skipTts flag for stage-entry greetings.
      const serverSkipTts = Boolean((response as any)?.skipTts);
      const allowTtsForThisMessage = transformed.allowTts && !serverSkipTts;
      const finalAssistantContent = aiMessage.content;
      upsertPersonaDirectory(normalizedPersonaKey, {
        displayName: aiMessage.displayRole,
        portraitUrl,
        voiceId: assistantVoiceId,
        sex: resolvedResponseSex,
      });

      // Speak the assistant response when TTS is enabled. We support a
      // "voice-first" mode where the spoken audio plays first and the
      // message text is appended after playback completes.
      if (ttsEnabled && response.content) {
        try {
          // Use refs for voice status to avoid stale closures in this async flow
          const shouldResume = isListening || voiceMode || voiceModeRef.current;
          if (shouldResume) {
            // Remember to resume after TTS finishes.
            resumeListeningRef.current = true;
            // Note: mic stopping is now handled entirely by playTtsAndPauseStt
            // to avoid race conditions from multiple stop/start calls
          }

          const preferredVoice = normalizeVoiceId(aiMessage.voiceId);
          const voiceSex = responseVoiceSex;
          const finalVoiceForRole = preferredVoice ?? resolvedVoiceForRole;

          const normalizedRoleKey = normalizedPersonaKey;
          const ttsMeta = {
            roleKey: normalizedRoleKey,
            displayRole: roleName ?? stage?.role,
            role: stage?.role ?? roleName,
            caseId,
            messageId: aiMessage.id,
            metadata: {
              stageId: stage?.id,
              attemptId: attemptId ?? undefined,
            },
          } satisfies Omit<TtsEventDetail, "audio">;

          if (voiceFirst) {
            // Placeholder logic:
            // We want to show a loading-like message OR an empty message bubble while audio preloads.
            // But we must NOT use empty content if the UI discards empty messages.
            const placeholderMessage: Message = {
              ...aiMessage,
              content: "...", // Use ellipsis instead of empty string to ensure visibility
              status: "pending" // Add visual indicator if UI supports it
            };
            setMessages((prev) => [...prev, placeholderMessage]);
            
            // Give React a frame to render the placeholder
            await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

            let playbackError: unknown = null;
            let ttsCompleted = false;
            try {
              // Wait for TTS to actually complete playing before showing text
              // No timeout race - we want to wait for the full audio
              if (allowTtsForThisMessage) {
                await playTtsAndPauseStt(
                  aiMessage.content,
                  finalVoiceForRole,
                  ttsMeta,
                  responseVoiceSex === "male" || responseVoiceSex === "female" ? responseVoiceSex : undefined,
                  false // Let playTtsAndPauseStt handle mic resume when audio actually ends
                );
              } else {
                console.debug("Skipping TTS for suppressed nurse message (voice-first)");
              }
              ttsCompleted = true;
            } catch (streamErr) {
              playbackError = streamErr;
              console.warn("Voice-first TTS playback encountered an error:", streamErr);
            } finally {
              // Only replace placeholder with real content AFTER TTS completes or errors
              // This ensures text appears after audio finishes
              console.debug("Voice-first: replacing placeholder with content", { ttsCompleted, playbackError: !!playbackError });
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === placeholderMessage.id
                    ? {
                        ...m,
                        content: finalAssistantContent,
                        media: aiMessage.media,
                        status: "sent" // TS requires "sent", "failed", "pending" or undefined
                      }
                    : m
                )
              );
              
              if (playbackError) {
                // If audio failed, ensure text is visible anyway (handled by setMessages detailed above)
                console.error("TTS playback failed after voice-first attempt:", playbackError);
              }
            }
          } else {
            // Default behavior: show the text immediately, then play audio
            appendAssistantMessage(aiMessage);
            try {
              if (allowTtsForThisMessage) {
                await playTtsAndPauseStt(
                  aiMessage.content,
                  finalVoiceForRole,
                  ttsMeta,
                  responseVoiceSex === "male" || responseVoiceSex === "female" ? responseVoiceSex : undefined,
                  true // skip internal resume; let sendUserMessage handle it
                );
              } else {
                console.debug("Skipping TTS for suppressed nurse message (default)");
              }
            } catch (err) {
              console.error("TTS failed:", err);
            }
          }

          // After TTS completes, resume listening if we previously stopped and
          // voiceMode is still active.
          // CRITICAL: Only resume if TTS is actually finished playing!
          // If the timeout fired but audio is still playing, do NOT resume yet.
          if (resumeListeningRef.current && !isPlayingAudioRef.current) {
            resumeListeningRef.current = false;
            // Explicitly clear suppression now (TTS is done), then start listening.
            // The 500ms setTimeout in playTtsAndPauseStt may not have fired yet,
            // so we clear it here to ensure the mic can restart.
            isSuppressingSttRef.current = false;
            try {
              setSttSuppressed(false, true, 'tts-clear');
            } catch {}
            // Exit deaf mode immediately since we're manually resuming
            try {
              exitDeafMode();
            } catch {}
            // Use the robust start helper with minimal delay since we just cleared suppression
            attemptStartListening(100);
          } else if (resumeListeningRef.current && isPlayingAudioRef.current) {
            // Audio still playing (timeout fired early), don't clear the flag
            // The playTtsAndPauseStt finally block will handle resumption when audio actually ends
            console.debug("TTS timeout fired but audio still playing, deferring mic resume");
          }
          // Mark the user message as sent (clear pending)
          if (userMessage) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === userMessage!.id ? { ...m, status: "sent" } : m
              )
            );
          }
        } catch (e) {
          console.error("Error during TTS handling:", e);
          // If anything falls through, ensure message is visible
          appendAssistantMessage(aiMessage);
        }
      } else {
        // TTS disabled ��� just show the message
        appendAssistantMessage(aiMessage);
        // Mark user message as sent
        if (userMessage) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === userMessage!.id ? { ...m, status: "sent" } : m
            )
          );
        }
      }
    } catch (error) {
      console.error("Error getting chat response (auto-send):", error);
      // If the error looks like network/unavailable, enqueue for background retry
      const maybeNetwork =
        (error &&
          (error as any).message &&
          String((error as any).message)
            .toLowerCase()
            .includes("network")) ||
        (typeof navigator !== "undefined" && !navigator.onLine) ||
        (error &&
          (error as any).response &&
          (error as any).response.status >= 500);

      if (userMessage) {
        // mark failed locally
        setMessages((prev) =>
          prev.map((m) =>
            m.id === userMessage!.id ? { ...m, status: "failed" } : m
          )
        );
        if (maybeNetwork) {
          enqueuePendingMessage(userMessage, currentStageIndex, caseId);
          setConnectionNotice(
            "Connection interrupted. We'll save your message and retry automatically."
          );
        }
      }

      const errorMessage = chatService.createErrorMessage(
        error,
        currentStageIndex
      );
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      // Remove the message id from the in-flight set when done
      try {
        if (userMessage && sendingMessageIdsRef.current) sendingMessageIdsRef.current.delete(userMessage.id);
      } catch (e) {}

      setIsLoading(false);
      try { debugEventBus.emitEvent?.('info','UI','send_finished',{ stageIndex: currentStageIndex, activePersona, ts: Date.now() }); } catch {}
      // Reset interim transcripts after a send
      reset();
      // Clear base input buffer after a send so future dictation starts
      // from an empty buffer.
      baseInputRef.current = "";
      // Ensure visible input is cleared after the send completes
      setInput("");
      // Suppress immediate transcript re-population for a short grace window
      try {
        clearInputSuppressionRef.current = true;
        window.setTimeout(() => {
          clearInputSuppressionRef.current = false;
        }, 400);
      } catch (e) {}
    }
  };

  const retryUserMessage = async (messageId: string) => {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;
    await sendUserMessage(msg.content, messageId);
  };

  const classifyStageReadinessIntent = useCallback(
    (content: string): StageReadinessDetection => {
      const nextIndex = Math.min(currentStageIndex + 1, stages.length - 1);
      const nextStage = stages[nextIndex];
      const trimmed = content?.trim();
      if (!nextStage || !trimmed) {
        return { matched: false, intent: "none", confidence: "low", heuristics: [] };
      }

      const context: StageReadinessContext = {
        currentStageTitle: stages[currentStageIndex]?.title,
        nextStageTitle: nextStage.title,
        nextStageNumber: nextIndex + 1,
        keywordSet: stageKeywordSets[nextIndex] ?? [],
        stageIndex: currentStageIndex,
      };

      // Manual override for owner handoff phrasing (include various verbs)
      const lower = trimmed.toLowerCase();
      const nextRole = nextStage.role?.toLowerCase() || "";
      const ownerPhrases = [
        "talk to the owner",
        "speak to the owner",
        "talk to owner",
        "inform the owner",
        "notify the owner",
        "tell the owner",
        "call the owner",
        "contact the owner",
      ];
      if (nextRole.includes("owner") || nextRole.includes("client")) {
        for (const p of ownerPhrases) {
          if (lower.includes(p)) {
            return {
              matched: true,
              intent: "advance",
              confidence: "high",
              heuristics: ["manual-owner-override"],
              reason: `User explicitly asked to ${p}`,
            };
          }
        }
      }

      const detection = detectStageReadinessIntent(trimmed, context, {
        enablePhaseThree: ENABLE_PHASE_THREE_STAGE_INTENT,
      });

      if (detection.matched && detection.intent === "advance") {
        dispatchStageIntentEvent({
          attemptId,
          caseId,
          currentStageIndex,
          nextStageId: nextStage.id,
          nextStageTitle: nextStage.title,
          variant: ENABLE_PHASE_THREE_STAGE_INTENT ? "phase3" : "legacy",
          confidence: detection.confidence,
          heuristics: detection.heuristics,
          reason: detection.reason,
          messageSample: trimmed.slice(0, 280),
        });
      }

      if (detection.matched && detection.intent !== "none" && ENABLE_STAGE_READINESS_TELEMETRY) {
        dispatchStageReadinessEvent({
          attemptId,
          caseId,
          stageIndex: currentStageIndex,
          stageTitle: stages[currentStageIndex]?.title,
          intent: detection.intent as Exclude<StageReadinessIntent, "none">,
          confidence: detection.confidence,
          heuristics: detection.heuristics,
          reason: detection.reason,
          messageSample: trimmed.slice(0, 280),
        });
      }

      // Emit a debug event so stage detection is visible in debug overlays/toasts
      try {
        debugEventBus.emitEvent?.('info', 'StageDetection', 'Stage readiness detected', {
          attemptId,
          caseId,
          stageIndex: currentStageIndex,
          nextStageTitle: nextStage?.title,
          intent: detection.intent,
          confidence: detection.confidence,
          heuristics: detection.heuristics,
          reason: detection.reason,
          messageSample: trimmed.slice(0, 280),
        });
      } catch (e) {
        // non-fatal
      }

      return detection;
    },
    [attemptId, caseId, currentStageIndex, stageKeywordSets, stages]
  );

  const detectAdvanceGuardResponse = (
    content: string
  ): "confirm" | "decline" | "none" => {
    const normalized = content.toLowerCase().replace(/\s+/g, " ").trim();
    if (!normalized) return "none";

    if (
      /\b(yes|yeah|yep|ready|sure|absolutely|of course|do it|let's go|lets go|move on|advance|proceed|next)\b/.test(
        normalized
      )
    ) {
      return "confirm";
    }

    if (
      /\b(no|not yet|wait|hold on|stay|keep going|continue here|need more|give me more time)\b/.test(
        normalized
      )
    ) {
      return "decline";
    }

    return "none";
  };

  // Trigger an auto-send that also flashes the Send button briefly so the
  // user sees that the message was submitted automatically.
  const [autoSendFlash, setAutoSendFlash] = useState(false);
  const triggerAutoSend = async (text: string) => {
    try {
      console.debug("triggerAutoSend invoked", { text });
      // flash briefly
      setAutoSendFlash(true);
      window.setTimeout(() => setAutoSendFlash(false), 600);
    } catch (e) {
      // ignore
    }
    // Clear hint if auto-sending
    setShowProceedHint(false);
    return sendUserMessage(text, undefined, { source: 'auto' });
  };

  // --- Pending message queue (localStorage-backed) -----------------
  const PENDING_KEY = "vw_pending_messages";

  const readPending = (): Array<any> => {
    try {
      const raw = localStorage.getItem(PENDING_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as Array<any>;
    } catch (e) {
      console.warn("Failed to read pending messages from storage:", e);
      return [];
    }
  };

  const writePending = (list: Array<any>) => {
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn("Failed to write pending messages to storage:", e);
    }
  };

  const enqueuePendingMessage = (
    msg: Message,
    stageIdx: number,
    caseIdLocal: string
  ) => {
    try {
      const list = readPending();
      // Keep only essential fields to minimize storage
      const entry = {
        id: msg.id,
        content: msg.content,
        stageIndex: stageIdx,
        caseId: caseIdLocal,
        timestamp: msg.timestamp,
      };
      list.push(entry);
      writePending(list);
      // ensure flush is scheduled
      schedulePendingFlush();
    } catch (e) {
      console.warn("Failed to enqueue pending message:", e);
    }
  };

  const dequeuePendingById = (id: string) => {
    try {
      const list = readPending().filter((p) => p.id !== id);
      writePending(list);
    } catch (e) {
      console.warn("Failed to dequeue pending message:", e);
    }
  };

  const flushPendingQueue = async () => {
    const list = readPending();
    if (!list || list.length === 0) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    for (const p of list.slice()) {
      try {
        // construct a minimal messages array with the user's pending content
        const apiMsg = [{ role: "user", content: p.content }];
        // call same endpoint via chatService to preserve behavior
        const response = await chatService.sendMessage(
          [
            // create a Message-like object so sendMessage accepts it
            {
              id: p.id,
              role: "user",
              content: p.content,
              timestamp: p.timestamp,
              stageIndex: p.stageIndex,
              displayRole: "You",
            },
          ] as Message[],
          p.stageIndex,
          p.caseId,
          { attemptId }
        );

        // Respect server-side suppression flag for pending flush responses
        if ((response as any)?.suppress) {
          // remove from pending store so we don't retry
          dequeuePendingById(p.id);
          continue;
        }

        // Append assistant reply into chat UI
        const stage = stages[p.stageIndex] ?? stages[currentStageIndex];
        const roleName = response.displayRole ?? stage?.role;
        const safePersonaRoleKey = chooseSafePersonaKey({
          userPersonaKey: null,
          selectedPersonaAtSend: null,
          lastSentPersona: null,
          responsePersonaKey: response.personaRoleKey ?? null,
          activePersona: activePersona ?? null,
          stageRole: stage?.role ?? null,
          roleName: roleName ?? null,
        });

        const normalizedPersonaKey = safePersonaRoleKey;
        const portraitUrl = response.portraitUrl;
        const serverVoiceId = normalizeVoiceId(response.voiceId);
        // Prefer patientSex (if provided) for pronoun/voice selection.
        const resolvedResponseSex =
          response.patientSex === "male" ||
          response.patientSex === "female" ||
          response.patientSex === "neutral"
            ? response.patientSex
            : response.personaSex;

        let responseVoiceSex: "male" | "female" | "neutral" =
          resolvedResponseSex === "male" ||
          resolvedResponseSex === "female" ||
          resolvedResponseSex === "neutral"
            ? resolvedResponseSex
            : "neutral";

        const resolvedVoiceForRole = getOrAssignVoiceForRole(
          normalizedPersonaKey,
          attemptId,
          {
            preferredVoice: serverVoiceId,
            sex: responseVoiceSex,
          }
        );
        const assistantVoiceId = serverVoiceId ?? resolvedVoiceForRole;
        // Prefer structuredFindings from server for pending flush
        const structured = (response as any)?.structuredFindings as Record<string,string|null> | undefined;
        const displayNames: Record<string,string> = {
          heart_rate: 'Heart rate',
          respiratory_rate: 'Respiratory rate',
          temperature: 'Temperature',
          blood_pressure: 'Blood pressure',
        };
        let finalContent = response.content;
        if (structured && Object.keys(structured).length > 0) {
          const parts: string[] = [];
          for (const k of Object.keys(structured)) {
            const val = structured[k];
            const name = displayNames[k] ?? k;
            parts.push(`${name}: ${val ?? 'not documented'}`);
          }
          finalContent = parts.join(', ');
        }

        let aiMessage = chatService.createAssistantMessage(
          finalContent,
          p.stageIndex,
          String(roleName ?? "assistant"),
          portraitUrl,
          assistantVoiceId,
          // pass resolved sex (prefer patientSex)
          resolvedResponseSex,
          safePersonaRoleKey,
          response.media
        );
        // Client-side nurse transform for pending flush responses
        const lastUser = [...messages].reverse().find((m) => m.role === "user");
        const transformed = transformNurseAssistantMessage(aiMessage, stage, lastUser?.content);
        aiMessage = transformed.message;
        upsertPersonaDirectory(normalizedPersonaKey, {
          displayName: aiMessage.displayRole,
          portraitUrl,
          voiceId: assistantVoiceId,
          sex: resolvedResponseSex,
        });
        appendAssistantMessage(aiMessage);
        // remove from pending store
        dequeuePendingById(p.id);
        // optionally clear any connection notice when successful
        setConnectionNotice(null);
      } catch (err) {
        // keep it in queue and try later; record notice
        console.warn("Pending flush failed for message", p.id, err);
        setConnectionNotice(
          "Connection interrupted. We'll keep trying in the background."
        );
      }
    }
  };

  const schedulePendingFlush = () => {
    // Start periodic flush attempts if not already running
    if (pendingFlushIntervalRef.current) return;
    // Try every 10s
    const id = window.setInterval(() => {
      void flushPendingQueue();
    }, 10000);
    pendingFlushIntervalRef.current = id as unknown as number;
  };

  const stopPendingFlush = () => {
    if (pendingFlushIntervalRef.current) {
      window.clearInterval(pendingFlushIntervalRef.current);
      pendingFlushIntervalRef.current = null;
    }
  };

  // Keep an effect to flush when connection returns and to wire online/offline UI
  useEffect(() => {
    const onOnline = () => {
      setConnectionNotice(null);
      void flushPendingQueue();
      schedulePendingFlush();
    };
    const onOffline = () => {
      setConnectionNotice(
        "Connection lost. We'll keep your progress safe and retry when you're back online."
      );
      schedulePendingFlush();
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    // flush immediately on mount in case there are pending items
    void flushPendingQueue();
    schedulePendingFlush();

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      stopPendingFlush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track whether the user explicitly toggled voice off for this attempt.
  // Declared here before any handlers that reference it (toggleVoiceMode,
  // initialization effects) so it's available when used.
  const userToggledOffRef = useRef(false);
  // Temporarily record if we disabled voice mode for an assistant intro
  const tempVoiceDisabledRef = useRef<boolean>(false);
  // Record whether voice mode was enabled immediately before a temporary disable
  const prevVoiceWasOnRef = useRef<boolean>(false);
  // Timer ref for forced restore (used for fixed-length intros)
  const forceRestoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Record whether the mic was actively listening when we started TTS.
  // If true, the mic was paused because TTS started and should be resumed
  // once playback finishes (unless the user explicitly disabled the mic).
  const wasMicPausedForTtsRef = useRef<boolean>(false);

  const { requestPermission } = useSpeechDevices();

  const setVoiceModeEnabled = useCallback(
    async (next: boolean) => {
      // If enabling, ensure we have microphone permission first
      if (next) {
        try {
          await requestPermission();
        } catch (e) {
          showMicToast("Microphone access required — please allow access", 4000);
          console.warn("Microphone permission denied or failed", e);
          // Do not proceed to start STT without permission
          // Still toggle the UI state so the caller sees the intent
          setVoiceMode(true);
          return;
        }
      }

      setVoiceMode((current) => {
        if (current === next) {
          return current;
        }
        if (next) {
          // User enabled voice mode -> clear the "user toggled off" flag
          userToggledOffRef.current = false;
          reset();
          setInput("");
          baseInputRef.current = "";
          // Also enable TTS (speaker) when voice mode is turned on
          setTtsEnabledState(true);

          // If STT is currently suppressed (TTS playback), do not call
          // start() immediately — instead mark for resume so the STT
          // service restarts when suppression clears.
          if (isSuppressingSttRef.current) {
            resumeListeningRef.current = true;
          } else if (!isPlayingAudioRef.current) {
            // small delay to allow permission prompt to finish processing
            setTimeout(() => {
              try {
                try {
                  if (!canStartListening()) return;
                } catch (e) {}
                start();
              } catch (e) {
                /* ignore start failure */
              }
            }, 150);
          }

          // Show short toast indicating speak mode activated
          try {
            setTimepointToast({ title: "SPEAK - Voice Mode Activated", body: "" });
            if (voiceModeToastTimerRef.current) {
              window.clearTimeout(voiceModeToastTimerRef.current);
              voiceModeToastTimerRef.current = null;
            }
            voiceModeToastTimerRef.current = window.setTimeout(() => {
              hideTimepointToastWithFade(300);
              voiceModeToastTimerRef.current = null;
            }, 2000);
          } catch (e) {
            // ignore toast errors
          }
        } else {
          // User disabled voice mode -> mark and stop any active capture
          userToggledOffRef.current = true;
          stopAndMaybeSend();
          // Explicitly stop listening to ensure mic is off
          stop();
          setTtsEnabledState(false);

          // Show short toast indicating write mode activated
          try {
            setTimepointToast({ title: "WRITE - Write Mode Activated", body: "" });
            if (voiceModeToastTimerRef.current) {
              window.clearTimeout(voiceModeToastTimerRef.current);
              voiceModeToastTimerRef.current = null;
            }
            voiceModeToastTimerRef.current = window.setTimeout(() => {
              hideTimepointToastWithFade(300);
              voiceModeToastTimerRef.current = null;
            }, 2000);
          } catch (e) {
            // ignore toast errors
          }
        }
        return next;
      });
    },
    [reset, start, stopAndMaybeSend, stop, setTtsEnabledState, requestPermission]
  );

  // Toggle voice mode (persistent listening until toggled off)
  const [showModeControls, setShowModeControls] = useState<boolean>(true);
  const toggleVoiceMode = useCallback(() => {
    // Hide the SPEAK/WRITE and LEARN controls after user interaction
    try { setShowModeControls(false); } catch (e) {}
    setVoiceModeEnabled(!voiceModeRef.current);
  }, [setVoiceModeEnabled]);

  const togglePause = useCallback(async () => {
    if (isPaused) {
      setIsPaused(false);
      // Clear global pause flag so STT can restart
      setGlobalPaused(false);
      
      // CRITICAL: Reset ALL STT suppression state when resuming
      // These might be stuck from TTS that was playing when we paused
      isSuppressingSttRef.current = false;
      isPlayingAudioRef.current = false;
      try {
        // Only clear suppression/deaf mode if no audio is currently playing.
        // Prioritize TTS suppression over pause/resume to avoid accidental mic restarts.
        if (!isPlayingAudioRef.current) {
          setSttSuppressed(false, true); // skip cooldown
          exitDeafMode(); // clear deaf mode timestamp
        } else {
          try { debugEventBus.emitEvent?.('info','STT','defer_clear_suppression_due_to_playback'); } catch {}
          // Schedule a safe clear: service will clear suppression once it sees playback ended
          try {
            scheduleClearSuppressionWhen(() => !isPlayingAudioRef.current, 200, 8000);
          } catch (e) {
            // ignore scheduling failures
          }
        }
      } catch {}
      
      // Ensure voice mode and TTS are enabled when resuming
      setVoiceModeEnabled(true);
      setTtsEnabledState(true);

      // If voice mode was already on (so setVoiceModeEnabled didn't trigger start),
      // we need to manually restart listening now that we are unpaused.
      // Also check isListening from ref to avoid stale closure
      if (voiceModeRef.current && !isListening) {
        // Small delay to ensure state is fully cleared before starting
        setTimeout(() => {
          try {
            if (!isPlayingAudioRef.current && !isSttSuppressed() && !isInDeafMode()) {
              try {
                if (!canStartListening()) return;
              } catch (e) {}
              start();
            } else {
              try { debugEventBus.emitEvent?.('info','STT','deferred_manual_start_due_to_suppression'); } catch {}
            }
          } catch (e) {
            // ignore
          }
        }, 100);
      }
      // fade out the "Attempt Paused" toast when resuming
      if (timepointToast) hideTimepointToastWithFade(300);
    } else {
      setIsPaused(true);
      // Set global pause flag to prevent STT auto-restart on visibility change
      setGlobalPaused(true);
      // Inactivate voice mode and TTS when pausing the attempt
      try {
        setVoiceModeEnabled(false);
      } catch {
        // fallback: ensure listeners and TTS are stopped
        if (isListening) {
          try { stop(); } catch { };
        }
      }
      stopActiveTtsPlayback();
      setTtsEnabledState(false);
      try {
        await saveProgress(currentStageIndex, messages, timeSpentSeconds);
      } catch (e) {
        console.error("Failed to save progress on pause:", e);
      }
    }
  }, [isPaused, isListening, stop, start, saveProgress, messages, currentStageIndex, timeSpentSeconds, setVoiceModeEnabled, setTtsEnabledState]);

  const pulseVoiceModeControls = useCallback(async () => {
    const wait = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms));
    if (!voiceModeRef.current) {
      setVoiceModeEnabled(true);
      await wait(300);
    }
    setVoiceModeEnabled(false);
    await wait(300);
    setVoiceModeEnabled(true);
    await wait(300);
  }, [setVoiceModeEnabled]);

  const pulseTtsControls = useCallback(async () => {
    const wait = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms));
    if (!ttsEnabledRef.current) {
      setTtsEnabledState(true);
      await wait(200);
    }
    setTtsEnabledState(false);
    await wait(200);
    setTtsEnabledState(true);
  }, [setTtsEnabledState]);

  const ownerGreetingSentRef = useRef<boolean>(false);
  const nurseGreetingSentRef = useRef<boolean>(false);
  // Track which stage-intro strings we've already appended during this attempt
  // to avoid repeating the same intro (e.g., nurse intro) multiple times.
  const sentStageIntroRef = useRef<Set<string>>(new Set());

  const sendOwnerGreetingIfNeeded = useCallback(async () => {
    try {
      if (ownerGreetingSentRef.current) return;
      // If there are any user/assistant messages already, do not send greeting
      const hasConversation = messages.some((m) => m.role === "user" || m.role === "assistant");
      if (hasConversation) return;
      const personaMeta = await ensurePersonaMetadata("owner");
      const greeting = "Hello Doctor";
      const assistantMsg = chatService.createAssistantMessage(
        greeting,
        currentStageIndex,
        personaMeta?.displayName ?? "Owner",
        personaMeta?.portraitUrl,
        personaMeta?.voiceId,
        personaMeta?.sex as any,
        "owner"
      );
      appendAssistantMessage(assistantMsg);
      ownerGreetingSentRef.current = true;
      if (ttsEnabled) {
        try {
          // Force resume after this owner greeting if voice mode is active so the mic restarts
          // Use the ref to read the up-to-date voice-mode state (avoids stale state when called immediately after enabling)
          const forceResume = Boolean(voiceModeRef.current && !userToggledOffRef.current);
          await playTtsAndPauseStt(greeting, personaMeta?.voiceId, { roleKey: "owner", displayRole: assistantMsg.displayRole, role: "owner", caseId, forceResume } as any, personaMeta?.sex as any);
        } catch {
          // ignore TTS errors
        }
      }
    } catch (e) {
      // non-blocking
    }
  }, [messages, currentStageIndex, ensurePersonaMetadata, appendAssistantMessage, ttsEnabled, playTtsAndPauseStt, caseId]);

  const handleStartSpeakingPrompt = useCallback(async () => {
    if (startSequenceActive) {
      return;
    }
    setStartSequenceActive(true);
    try {
      // Explicitly enable Voice Mode and TTS without toggling/pulsing.
      // The user click is a valid trusted event for starting audio contexts.
      setVoiceModeEnabled(true);
      setTtsEnabledState(true);

      // Briefly suppress immediate "Microphone Blocked" toasts while the
      // browser permission prompt may be displayed.
      try {
        sttBlockedSuppressUntilRef.current = Date.now() + 2000; // 2s suppression window
        if (sttBlockedDelayedToastTimerRef.current) {
          window.clearTimeout(sttBlockedDelayedToastTimerRef.current);
          sttBlockedDelayedToastTimerRef.current = null;
        }
      } catch (e) {
        // ignore
      }
      
      // Ensure we start listening immediately
      userToggledOffRef.current = false; 
      if (!isListening) {
        try {
          try {
            if (!canStartListening()) {
              console.debug("start prevented by service guard on user init click");
            } else start();
          } catch (e) {
            start();
          }
        } catch (e) {
          console.warn("Failed to start STT on click", e);
        }
      }
      setShowStartSpeakingPrompt(false);
      try { hideIntroToast(); } catch (e) {}

      // Send owner's greeting at the start of the case
      try {
        void sendOwnerGreetingIfNeeded();
      } catch {}
    } catch (err) {
      console.error("Failed to initialize voice controls:", err);
    } finally {
      setStartSequenceActive(false);
    }
  }, [startSequenceActive, setVoiceModeEnabled, setTtsEnabledState, isListening, start, sendOwnerGreetingIfNeeded, hideIntroToast]);

  const handleStartWritePrompt = useCallback(() => {
    try {
      // Explicitly ensure voice mode and TTS are OFF for text-first flow.
      setTtsEnabledState(false);
      setVoiceModeEnabled(false);
      setShowStartSpeakingPrompt(false);
      try { hideIntroToast(); } catch (e) {}
    } catch (err) {
      console.warn("Failed to initialize write controls:", err);
    }
  }, [setVoiceModeEnabled, setTtsEnabledState, hideIntroToast]);

  // Update input when transcript changes
  // Update input when interim or final transcripts arrive. When listening,
  // show the live interim transcript in the textarea so users see dictation
  // as it happens. When interim is empty, show the last final transcript.
  useEffect(() => {
    if (isListening) {
      // If there's live interim text, cancel any pending auto-send because
      // the user is still speaking. Show interim appended to committed base.
      if (clearInputSuppressionRef.current) {
        // A manual send just happened - avoid re-populating input immediately to prevent ghost text
        return;
      }
      if (interimTranscript && interimTranscript.trim()) {
        if (autoSendTimerRef.current) {
          window.clearTimeout(autoSendTimerRef.current);
          autoSendTimerRef.current = null;
          autoSendPendingTextRef.current = null;
        }
        const combined = mergeStringsNoDup(baseInputRef.current, interimTranscript.trim());
        setInput(combined);
        return;
      }
      if (transcript && transcript.trim()) {
        const finalTrim = transcript.trim();
        const now = Date.now();

        // If onFinal already handled this exact final transcript, avoid
        // appending it again here. Clear the marker and ensure visible
        // input reflects the base buffer.
        if (
          lastFinalHandledRef.current &&
          lastFinalHandledRef.current === finalTrim
        ) {
          lastFinalHandledRef.current = null;
          setInput(baseInputRef.current);
          return;
        }

        // If we recently appended the same chunk, skip to avoid duplicates
        if (
          lastAppendedTextRef.current === finalTrim &&
          now - (lastAppendTimeRef.current || 0) < 3000
        ) {
          if (!clearInputSuppressionRef.current) setInput(baseInputRef.current);
          return;
        }

        // When a final transcript arrives that wasn't already appended via
        // the onFinal handler (safety), ensure it's reflected in baseInput.
        if (
          !baseInputRef.current ||
          !baseInputRef.current.includes(finalTrim)
        ) {
          baseInputRef.current = mergeStringsNoDup(baseInputRef.current, finalTrim);
          lastAppendedTextRef.current = finalTrim;
          lastAppendTimeRef.current = now;
        }
        setInput(baseInputRef.current);

        // If the STT engine exposed the final via the `transcript` state
        // rather than the onFinal callback, ensure we still schedule the
        // final-only auto-send timer so the message doesn't get stuck.
        if (voiceMode && !autoSendFinalTimerRef.current && autoSendSttRef.current) {
          autoSendFinalTimerRef.current = window.setTimeout(() => {
            autoSendFinalTimerRef.current = null;
            autoSendPendingTextRef.current = null;
            try {
              // GUARD: If we're in deaf mode (TTS playing or just ended), skip auto-send
              if (isInDeafMode()) {
                console.debug("Auto-send (transcript) BLOCKED: in deaf mode", { source: 'transcript-auto' });
                try { debugEventBus.emitEvent?.('info','AutoSend','blocked_deaf_mode',{ source: 'transcript-auto' }); } catch {};
                // show a short hint for transcript-auto blocked sends
                try { setTimepointToast({ title: "Auto-send blocked", body: "Audio playback detected — tap Send to force your message." }); setTimeout(() => hideTimepointToastWithFade(300), 2400); } catch {}
                return;
              }
              console.debug(
                "Auto-send (final via transcript) firing with text:",
                baseInputRef.current
              );
              void triggerAutoSend(baseInputRef.current);
            } catch (err) {
              console.error(
                "Failed to auto-send final transcript (via transcript):",
                err
              );
            }
          }, 500);
        }
      }
    }
  }, [interimTranscript, transcript, isListening]);

  // Mic inactivity watchdog: during nurse-sensitive stages, if the mic is
  // listening and no interim/final transcripts are observed for 90s, stop
  // the mic and auto-send any pending text. This prevents the mic from
  // auto-stopping earlier while allowing long pauses during nurse stages.
  useEffect(() => {
    try {
      const stage = stages?.[currentStageIndex];
      const stageTitle = (stage?.title ?? "").toLowerCase();
      const isSensitiveStage = /physical|laboratory|lab|treatment/.test(stageTitle);

      // Clear timer if not applicable
      if (!isListening || !isSensitiveStage) {
        if (micInactivityTimerRef.current) {
          window.clearTimeout(micInactivityTimerRef.current);
          micInactivityTimerRef.current = null;
        }
        return;
      }

      // Reset timer on each transcript/interim update
      if (micInactivityTimerRef.current) {
        window.clearTimeout(micInactivityTimerRef.current);
        micInactivityTimerRef.current = null;
      }

      micInactivityTimerRef.current = window.setTimeout(() => {
        try {
          // Send any pending text then stop listening
          stopAndMaybeSend();
          stop();
          showMicToast("Microphone stopped due to inactivity", 2000);
        } catch (e) {
          // ignore
        }
        micInactivityTimerRef.current = null;
      }, 90000);

      return () => {
        if (micInactivityTimerRef.current) {
          window.clearTimeout(micInactivityTimerRef.current);
          micInactivityTimerRef.current = null;
        }
      };
    } catch (e) {
      // ignore
    }
  }, [isListening, transcript, interimTranscript, currentStageIndex, stages, stopAndMaybeSend, stop]);

  // Adjust STT debounce adaptively based on ambient noise level to reduce
  // false positives in noisy environments.
  useEffect(() => {
    try {
      if (typeof ambientLevel === "number" && setDebounceMs) {
        // Map ambientLevel 0..1 to debounce between 600..1800ms
        const min = 600;
        const max = 1800;
        const ms = Math.round(min + (max - min) * Math.min(1, ambientLevel));
        setDebounceMs(ms);
      }
    } catch (e) {
      // ignore
    }
  }, [ambientLevel, setDebounceMs]);

  // Scroll to bottom when messages change but only if the user is already
  // near the bottom. This prevents an aggressive page-level scroll when the
  // user presses Enter or is inspecting earlier messages.
  useEffect(() => {
    try {
      const container = document.getElementById("chat-messages");
      const endEl = messagesEndRef.current;

      // If we have a scrollable chat container, only scroll that element (not the whole page).
      // Compute bounding rects to decide whether the bottom sentinel is visible within the
      // chat container viewport. If it is not visible, scroll the container to the bottom.
      if (container && endEl) {
        try {
          const containerRect = container.getBoundingClientRect();
          const endRect = endEl.getBoundingClientRect();

          const isVisible = endRect.top >= containerRect.top && endRect.bottom <= containerRect.bottom;

          if (!isVisible) {
            // Scroll the container to show newest message. Use container.scrollTo so the
            // page viewport doesn't jump.
            container.scrollTo({ top: container.scrollHeight, behavior: "auto" });
          }
          return;
        } catch (inner) {
          // If bounds computation fails for any reason, fall through to safe fallback.
        }
      }

      // Fallback: ensure the sentinel is in view without forcing a page-level jump by
      // using 'block: nearest'. This minimizes the chance that the browser will scroll
      // the outer page container.
      try {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "nearest" });
      } catch {}
    } catch (e) {
      // If anything else goes wrong, be noisy in console but avoid breaking the app
      try {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "nearest" });
      } catch {}
    }
  }, [messages]);

  // Intro toast: central, non-blocking pop-up shown when an attempt opens.
  const introShownRef = useRef(false);
  const [introMounted, setIntroMounted] = useState(false);
  const [showIntroToast, setShowIntroToast] = useState(false);

  useEffect(() => {
    if (!attemptId) return;
    if (introShownRef.current) return;
    introShownRef.current = true;
    setIntroMounted(true);
    setShowIntroToast(true);
    // Keep the intro visible until the user explicitly interacts (Speak/Write/Learn/Close)
    return () => { /* no-op */ };
  }, [attemptId]);

  // Listen for debug events and surface stage-detection events as a subtle toast for quick visibility
  useEffect(() => {
    const handler = (ev: any) => {
      try {
        const event = ev as any;
        // If trace capture is enabled, store events for later inspection (QA only)
        try {
          const enabled = typeof window !== 'undefined' && (window.localStorage?.getItem?.('sttTrace') === '1' || (window as any).__stt_trace_enabled);
          if (enabled) {
            try {
              (window as any).__stt_trace = (window as any).__stt_trace || [];
              (window as any).__stt_trace.push({ ts: Date.now(), event });
              // Keep trace bounded
              if ((window as any).__stt_trace.length > 500) (window as any).__stt_trace.shift();
            } catch {}
          }
        } catch {}

        // Ignore high-volume speech debug events for the toast UI (they're still captured in trace)
        if (event.source === 'TTS' || event.source === 'STT') return;
        // Only show a toast for stage-related debug events so the UI isn't noisy
        if (event.source && String(event.source).toLowerCase().startsWith('stage')) {
          try {
            setTimepointToast({ title: `${event.source} - ${event.message}`, body: event.details ? JSON.stringify(event.details, null, 0).slice(0, 220) : '' });
            // Content visible briefly
            setTimeout(() => hideTimepointToastWithFade(300), 3000);
          } catch {}
        }
      } catch (e) {
        // ignore
      }
    };
    try {
      debugEventBus.on('debug-event', handler);
    } catch {}
    // Expose simple helpers for QA: enable trace capture with localStorage.setItem('sttTrace','1') or set window.__stt_trace_enabled = true
    try {
      (window as any).dumpSttTrace = () => {
        try {
          console.log('__stt_trace length:', (window as any).__stt_trace?.length ?? 0);
          console.log((window as any).__stt_trace?.slice(-200) ?? []);
        } catch (e) {
          console.warn('Failed to dump STT trace', e);
        }
      };
    } catch {}

    return () => {
      try { debugEventBus.off('debug-event', handler); } catch {}
    };
  }, []);

  // Ensure STT is active when an attempt is open. This effect covers cases
  // where `attemptId` didn't change but the component mounted or `isListening`
  // changed (e.g. due to hook identity differences). Do not auto-start if
  // the user explicitly toggled voice off for this attempt.
  useEffect(() => {
    if (!attemptId) return;
    if (userToggledOffRef.current) return;
    if (speechSupported && voiceMode && !isListening && !startedListeningRef.current && !isPlayingAudioRef.current) {
      try {
        // Auto-start listening for the attempt. We clear the input and the
        // committed base buffer so dictation starts fresh.
        reset();
        setInput("");
        baseInputRef.current = "";
        try {
          if (!canStartListening()) {
            console.debug("auto-start suppressed by service guard when opening attempt");
          } else start();
        } catch (e) {
          start();
        }
        startedListeningRef.current = true;
      } catch (e) {
        console.error("Failed to auto-start STT:", e);
      }
    }
  }, [attemptId, voiceMode, isListening, reset, start]);

  useEffect(() => {
    if (!voiceMode || !speechSupported) return;
    if (userToggledOffRef.current) return;
    if (isListening || startedListeningRef.current || isPlayingAudioRef.current) return;
    try {
      reset();
      try {
        if (!canStartListening()) {
          console.debug("auto-start suppressed by service guard (voiceMode change)");
        } else start();
      } catch (e) {
        start();
      }
      startedListeningRef.current = true;
    } catch (e) {
      console.error("Failed to auto-start STT:", e);
    }
  }, [voiceMode, isListening, reset, start]);

  // Auto-pause attempt and show toast if user leaves the chat page
  useEffect(() => {
    if (!attemptId) return;
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        setIsPaused(true);
        // Set global pause flag to prevent STT auto-restart when window is refocused
        setGlobalPaused(true);
        // Turn off voice mode when auto-pausing - CRITICAL for stopping STT/TTS
        try {
          setVoiceModeEnabled(false);
        } catch {
          // fallback: ensure listeners and TTS are stopped
          if (isListening) {
            try { stop(); } catch { };
          }
        }
        stopActiveTtsPlayback();
        setTtsEnabledState(false);
        // Also enter deaf mode to ignore any pending STT results
        enterDeafMode();
        setTimepointToast({
          title: "Attempt Paused",
          body: "You left the case. The attempt is paused. Re-enter to unpause.",
        });
      } else if (document.visibilityState === "visible") {
        // Clear any pause/deaf-mode status when the user returns to the tab
        setIsPaused(false);
        setGlobalPaused(false);
        try {
          exitDeafMode();
        } catch {}
        try {
          // If voice mode is enabled and the user didn't explicitly toggle off,
          // attempt to re-start listening after a short delay to allow devices to settle.
          if (voiceMode && !userToggledOffRef.current) {
            attemptStartListening(400);
          }
        } catch (e) {
          // ignore
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // When the attempt is paused, any deliberate user interaction with a
    // button or activating a control should unpause. Listen for pointerdown
    // and keyboard activation events and unpause if needed.
    const handleUserInteraction = (ev: Event) => {
      try {
        if (!isPaused) return;
        const target = ev.target as HTMLElement | null;
        if (!target) return;
        // Button click or role=button
        if (target.closest && target.closest('button, [role="button"]')) {
          // Unpause via the togglePause helper (it will resume when paused)
          try {
            void togglePause();
          } catch (e) {}
        }
        // Keyboard activation (Enter/Space) when a button is focused
        if ((ev as KeyboardEvent).key && ((ev as KeyboardEvent).key === 'Enter' || (ev as KeyboardEvent).key === ' ')) {
          const active = document.activeElement as HTMLElement | null;
          if (active && (active.tagName === 'BUTTON' || active.getAttribute('role') === 'button')) {
            try { void togglePause(); } catch (e) {}
          }
        }
      } catch (e) {
        // ignore
      }
    };

    document.addEventListener('pointerdown', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction as EventListener);

    // Listen for unauthorized save events (e.g., expired auth token) and show a helpful toast
    const onSaveUnauthorized = (ev: any) => {
      try {
        setTimepointToast({ title: "Save Failed", body: "Failed to save progress — please sign in again." });
        setTimeout(() => hideTimepointToastWithFade(300), 3000);
      } catch (e) {}
    };
    window.addEventListener('vw:attempt-save-unauthorized', onSaveUnauthorized as EventListener);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      document.removeEventListener('pointerdown', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction as EventListener);
      window.removeEventListener('vw:attempt-save-unauthorized', onSaveUnauthorized as EventListener);
    };
  }, [attemptId, isListening, stop, setVoiceModeEnabled, setTtsEnabledState, stopActiveTtsPlayback, enterDeafMode, isPaused, togglePause, voiceMode]);

  // Auto-save (throttled) ��� keeps the existing delete+insert server behavior
  useEffect(() => {
    const attemptKey = attemptId ?? "__no_attempt__";
    const nextMessages = Array.isArray(latestInitialMessagesRef.current)
      ? latestInitialMessagesRef.current
      : [];

    setMessages([...nextMessages]);
    lastSavedSnapshotRef.current = JSON.stringify(nextMessages);
    lastSavedAtRef.current = 0;

    if (lastHydratedAttemptKeyRef.current === attemptKey) {
      return;
    }

    lastHydratedAttemptKeyRef.current = attemptKey;
    setInput("");
    baseInputRef.current = "";
    setTimeSpentSeconds(0);
    setConnectionNotice(null);
    setAdvanceGuard(null);
    setStageIndicator(null);
    setVoiceMode(Boolean(attemptId));
    clearStageIntentLocks();

    startedListeningRef.current = false;
    userToggledOffRef.current = false;
    resumeListeningRef.current = false;
    introShownRef.current = false;

    if (autoSendTimerRef.current) {
      window.clearTimeout(autoSendTimerRef.current);
      autoSendTimerRef.current = null;
    }
    if (autoSendFinalTimerRef.current) {
      window.clearTimeout(autoSendFinalTimerRef.current);
      autoSendFinalTimerRef.current = null;
    }
    autoSendPendingTextRef.current = null;
    lastFinalHandledRef.current = null;
    lastAppendedTextRef.current = null;
    lastAppendTimeRef.current = 0;

    scheduleAutoProceedRef.current = null;
    handleProceedRef.current = null;

    if (nextStageIntentTimeoutRef.current) {
      window.clearTimeout(nextStageIntentTimeoutRef.current);
      nextStageIntentTimeoutRef.current = null;
    }
    if (pendingFlushIntervalRef.current) {
      window.clearInterval(pendingFlushIntervalRef.current);
      pendingFlushIntervalRef.current = null;
    }

    stopActiveTtsPlayback();
    try {
      cancelRef.current?.();
    } catch (err) {
      // ignore
    }
    try {
      stopRef.current?.();
    } catch (err) {
      // ignore
    }
    try {
      resetRef.current?.();
    } catch (err) {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  useEffect(() => {
    if (!attemptId) return;

    const intervalMs = 30000; // auto-save every 30s
    const throttleMs = 15000; // don't save more often than every 15s

    let mounted = true;

    const doAutoSave = async () => {
      // Snapshot messages to detect changes
      const snapshot = JSON.stringify(messages);

      // Nothing changed since last save
      if (snapshot === lastSavedSnapshotRef.current) return;

      const now = Date.now();
      if (now - lastSavedAtRef.current < throttleMs) return;

      // Avoid saving empty conversations
      if (!messages || messages.length === 0) return;

      lastSavedAtRef.current = now;
      try {
        const success = await saveProgress(
          currentStageIndex,
          messages,
          timeSpentSeconds
        );
        if (success) {
          lastSavedSnapshotRef.current = snapshot;
        }
      } catch (err) {
        console.error("Auto-save failed:", err);
      }
    };

    // Periodic interval
    const timer = setInterval(() => {
      if (!mounted) return;
      void doAutoSave();
    }, intervalMs);

    // Save when the page is hidden / unloaded so we don't lose recent changes
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        void doAutoSave();
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Attempt a final save (best-effort)
      void doAutoSave();
      // Let the unload proceed; do not block
      delete e.returnValue;
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("beforeunload", handleBeforeUnload);

    // Run an immediate save shortly after mount to capture any resumed state
    void doAutoSave();

    return () => {
      mounted = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [attemptId, messages, currentStageIndex, timeSpentSeconds, saveProgress]);

  useEffect(() => {
    const stage = stages[currentStageIndex];
    const stageTitle = stage?.title ?? `Stage ${currentStageIndex + 1}`;
    const tip = getStageTip(caseId, currentStageIndex);

    if (tip) {
      setStageIndicator({
        title: stageTitle,
        body: tip,
      });
      // Auto-hide after 8 seconds
      const timer = setTimeout(() => {
        setStageIndicator(null);
      }, 8000);
      return () => clearTimeout(timer);
    } else {
      setStageIndicator(null);
    }
  }, [caseId, currentStageIndex, stages]);

  const handleSubmit = async (e: React.FormEvent) => {
    try {
      e.preventDefault();
      try { debugEventBus.emitEvent?.('info','UI','submit_clicked',{ stageIndex: currentStageIndex, activePersona, inputSample: (input||"").slice(0,140) }); } catch {}
      // Delegate to shared sendUserMessage helper and mark as manual so it bypasses auto-send blocks
      await sendUserMessage(input, undefined, { source: 'manual' });
    } finally {
      try { debugEventBus.emitEvent?.('info','UI','submit_complete',{ stageIndex: currentStageIndex, activePersona }); } catch {}
      // Clear the base input buffer and visible input when the user clicks Send
      try {
        baseInputRef.current = "";
      } catch {}
      try {
        setInput("");
      } catch {}

      // Ensure focus returns to the textarea without causing a page scroll
      try {
        (textareaRef.current as any)?.focus?.({ preventScroll: true });
      } catch (e) {
        try {
          textareaRef.current?.focus();
        } catch {}
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const isLastStage = currentStageIndex === stages.length - 1;
  const nextStageName = isLastStage ? "Complete Examination" : stages[currentStageIndex + 1]?.title || "Next Stage";
  const nextStageTitle = isLastStage
    ? "Complete Examination"
    : `Proceed to ${nextStageName}`;

  // Helper to produce a short assistant intro when proceeding to a new stage
  const getStageAssistantIntro = (targetStageIndex: number) => {
    const title = stages[targetStageIndex]?.title || "next stage";
    const role = String(stages[targetStageIndex]?.role || "").toLowerCase();

    // If the upcoming stage expects interaction with the owner/client,
    // normally the intro should come from the owner. However, if the UI
    // currently has the Nurse persona focused, we should not produce an
    // owner prompt attributed to the Nurse (nurse must never speak owner
    // prompts). In that case, return a Nurse-centred intro instead.
    if (role.includes("owner") || role.includes("client")) {
      if (activePersona === "veterinary-nurse") {
        // Nurse-focused intro (non-owner phrasing)
        return `I'm the veterinary nurse supporting this case. I'm ready to share the documented findings for the ${title.toLowerCase()} whenever you need them.`;
      }
      // A brief, natural owner prompt that invites the student to report
      // findings or ask follow-up questions. Keep it short so the student
      // can respond.
      return `Hi Doc, do you have any news for me?`;
    }

    if (title.toLowerCase().includes("treatment plan")) {
      return "What are your indications and treatment plan, Doctor?";
    }

    return `I'm the veterinary nurse supporting this case. I'm ready to share the documented findings for the ${title.toLowerCase()} whenever you need them.`;
  };

  const handleProceed = async () => {
    resetNextStageIntent();
    clearStageIntentLocks();
    // Clear any pending UI confirmation when the proceed flow starts
    setPendingStageAdvance(null);
    if (isAdvancingRef.current) {
      return;
    }
    const stageResult = evaluateStageCompletion(currentStageIndex, messages);
    if (stageResult.status === "insufficient") {
      // If we haven't warned the user yet for this stage, do so now.
      if (!advanceGuard || advanceGuard.stageIndex !== currentStageIndex) {
        setAdvanceGuard({
          stageIndex: currentStageIndex,
          askedAt: Date.now(),
          metrics: stageResult.metrics,
        });
        await emitStageReadinessPrompt(currentStageIndex, stageResult);
        reset();
        baseInputRef.current = "";
        return;
      }
      // If we HAVE warned them (advanceGuard is set), allow them to proceed
      // by falling through to the logic below.
    }

    isAdvancingRef.current = true;

    // Check if we are completing the examination (last stage)
    if (currentStageIndex >= stages.length - 1) {
      try {
        onProceedToNextStage(messages, timeSpentSeconds);
      } catch (e) {
        console.error("Error in onProceedToNextStage (completion):", e);
      } finally {
        isAdvancingRef.current = false;
      }
      return;
    }

    const targetIndex = Math.min(currentStageIndex + 1, stages.length - 1);

    const introText = getStageAssistantIntro(targetIndex);
    // Choose a display role based on the configured stage role so the UI
    // labels the speaker appropriately (e.g., Owner, Laboratory Technician)
    const stageRole = stages[targetIndex]?.role ?? "Virtual Assistant";
    const roleName = String(stageRole);
    let normalizedRoleKey = resolveChatPersonaRoleKey(stageRole, roleName);

    // Fix: If the intro text explicitly claims to be the veterinary nurse,
    // but the stage role is generic (e.g. "Veterinarian"), force the nurse persona.
    // This ensures the correct avatar (with picture) and voice are used.
    if (
      introText.includes("I'm the veterinary nurse") &&
      normalizedRoleKey !== "veterinary-nurse"
    ) {
      normalizedRoleKey = "veterinary-nurse";
    }

    // Clear hint when proceeding
    setShowProceedHint(false);

    const personaMeta = await ensurePersonaMetadata(normalizedRoleKey);

    // Create assistant message using persona metadata when available so the
    // client sees the correct speaker (owner vs assistant vs lab tech) with
    // a consistent portrait and voice.
    let voiceSex: "male" | "female" | "neutral" =
      personaMeta?.sex === "male" ||
        personaMeta?.sex === "female" ||
        personaMeta?.sex === "neutral"
        ? personaMeta.sex
        : "neutral";

    const voiceForRole = getOrAssignVoiceForRole(normalizedRoleKey, attemptId, {
      preferredVoice: personaMeta?.voiceId,
      sex: voiceSex,
    });

    // Find auto-trigger media for this stage
    const targetStage = stages[targetIndex];
    const autoMedia = caseMedia.filter((m) => {
      if (m.trigger !== "auto") return false;
      // Match by stage ID or Key
      if (m.stage?.stageId && m.stage.stageId === targetStage?.id) return true;
      if (m.stage?.stageKey && m.stage.stageKey === targetStage?.id) return true;
      return false;
    });

    const assistantMsg = chatService.createAssistantMessage(
      introText,
      targetIndex,
      personaMeta?.displayName ?? roleName,
      personaMeta?.portraitUrl,
      voiceForRole,
      personaMeta?.sex,
      normalizedRoleKey,
      autoMedia.length > 0 ? autoMedia : undefined
    );
    upsertPersonaDirectory(normalizedRoleKey, {
      displayName: personaMeta?.displayName ?? roleName,
      portraitUrl: personaMeta?.portraitUrl,
      voiceId: voiceForRole,
      sex: personaMeta?.sex,
    });

    // Avoid repeating identical stage intro messages during the same attempt.
    const introKey = `${normalizedRoleKey}:${introText}`;
    if (!sentStageIntroRef.current.has(introKey)) {
      // Append assistant message immediately so user sees it
      // Special UX: if we're leaving the Physical Examination stage and
      // the intro is coming from the nurse, use a shorter prompt that
      // asks the Doctor to tell the owner what they think, then after
      // 3s switch focus to the owner and show an owner placeholder.
      const leavingPhysical = /physical|exam|examination/i.test((stages[currentStageIndex]?.title ?? "").toLowerCase());
      if (leavingPhysical && normalizedRoleKey === "veterinary-nurse") {
        // Override nurse placeholder text
        (assistantMsg as any).content = "All right Doc, tell the owner what you think.";
        appendAssistantMessage(assistantMsg);
        // Schedule persona switch to owner and show owner placeholder after 3s
        try {
          // Delay UI switch and suppress auto-start to avoid accidental mic resume
          handleSetActivePersona("owner", { delayMs: 3000, suppressAutoStartMs: 3000 });
        } catch (e) {}

        // Append owner placeholder after 3s so it's visible in the owner stream
        void (async () => {
          const delay = 3000;
          await new Promise((res) => setTimeout(res, delay));
          try {
            const ownerMeta = await ensurePersonaMetadata("owner");
            const ownerVoice = getOrAssignVoiceForRole("owner", attemptId, { preferredVoice: ownerMeta?.voiceId, sex: (ownerMeta?.sex as any) ?? "neutral" });
            const ownerMsg = chatService.createAssistantMessage(
              "Do you have any news, Doc?",
              targetIndex,
              ownerMeta?.displayName ?? "Owner",
              ownerMeta?.portraitUrl,
              ownerVoice,
              ownerMeta?.sex,
              "owner"
            );
            upsertPersonaDirectory("owner", {
              displayName: ownerMeta?.displayName ?? "Owner",
              portraitUrl: ownerMeta?.portraitUrl,
              voiceId: ownerVoice,
              sex: ownerMeta?.sex,
            });
            appendAssistantMessage(ownerMsg);
          } catch (err) {
            // non-blocking
          }
        })();
      } else {
        appendAssistantMessage(assistantMsg);
      }
      sentStageIntroRef.current.add(introKey);
    } else {
      // Already sent this intro earlier in the attempt - skip appending/playing TTS
      // but still ensure the UI scrolls the message area so the user sees latest
      try { messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); } catch (e) {}
    }

    // Speak if tts enabled; ensure the mic is fully stopped while the
    // assistant speaks so STT does not capture its audio, then restore
    // listening after playback completes.
    // However, for nurse intros in sensitive stages (Physical, Laboratory,
    // Treatment) we intentionally skip TTS to avoid self-capture and leaking
    // persona prompts. Respect that policy here on the client when
    // determining whether to play the intro audio.
    const introStageTitleLower = (stages[targetIndex]?.title ?? "").toLowerCase();
    const introIsSensitive = /physical|laboratory|lab|treatment/.test(introStageTitleLower);
    const skipIntroTts = introIsSensitive && normalizedRoleKey === "veterinary-nurse";

    if (ttsEnabled && introText && !skipIntroTts) {
      try {
        // If currently listening, stop immediately and also update the
        // UI to show voice mode as disabled so nothing will restart it
        // while the assistant speaks. We'll restore voice mode afterward.
        const wasListening = !!isListening;
        if (wasListening) {
          // Record that the mic was actively listening when we initiated intro TTS
          // so that the resume logic knows this was a TTS-paused mic and will
          // deterministically attempt to restart it after playback completes.
          wasMicPausedForTtsRef.current = !userToggledOffRef.current && wasListening;
          try {
            console.debug("Intro TTS: marking wasMicPausedForTts", { wasListening, userToggledOff: userToggledOffRef.current });
          } catch (e) {}

          // Do NOT stop the mic or toggle the visible mic UI here. The
          // `playTtsAndPauseStt` helper will handle suppression/abort and
          // prevent self-capture while preserving the voice-mode UI state.
          try {
            prevVoiceWasOnRef.current = !!voiceModeRef.current;
          } catch (e) {}
          // small delay to reduce race conditions before starting TTS
          await new Promise((res) => setTimeout(res, 150));
        }

        // Use per-role voice for the assistant intro as well
        const introMeta = {
          roleKey: normalizedRoleKey,
          displayRole: roleName,
          role: stageRole ?? roleName,
          caseId,
          metadata: {
            stageId: stages[targetIndex]?.id,
            stageIntro: true,
          },
        } satisfies Omit<TtsEventDetail, "audio">;
        // For non-sensitive intros allow auto-resume so the mic is
        // reliably restarted after playback when it was previously listening.
        // Use skipResume=false (explicit) to avoid leaving the mic disabled.
        try {
          console.debug("Intro TTS: allowing playTtsAndPauseStt to auto-resume STT for non-sensitive intro", { targetIndex });
        } catch (e) {}
        await playTtsAndPauseStt(
          introText,
          assistantMsg.voiceId ?? voiceForRole,
          introMeta,
          personaMeta?.sex as any,
          false
        );
        } catch (e) {
          try {
            if (ttsAvailable && speakAsync) {
              await speakAsync(introText);
            } else if (ttsAvailable) {
              speak(introText);
            }
          } catch (err) {
            console.error("Intro TTS failed:", err);
          }
        } finally {
        // Restore voice mode only if we temporarily disabled it above.
        if (tempVoiceDisabledRef.current) {
          // Wait for TTS playback to be fully finished before re-enabling
          // voice mode. Keep the temporary-disable flag set while waiting
          // so no other code path will attempt to start STT prematurely.
          const waitForTtsToFinish = async (timeoutMs = 15000, pollMs = 100) => {
            const start = Date.now();
            return new Promise<void>((resolve) => {
              const check = () => {
                const audioPlaying = !!(isPlayingAudioRef.current);
                const lastEnd = lastTtsEndRef.current || 0;
                const timeSinceEnd = Date.now() - lastEnd;
                // Consider playback finished only when no audio is playing
                // and suppression has been cleared (or the end time is slightly older).
                if (!audioPlaying && (!isSuppressingSttRef.current || timeSinceEnd > 400)) {
                  resolve();
                  return;
                }
                if (Date.now() - start >= timeoutMs) {
                  // Timeout: give up and resolve so we don't block forever.
                  resolve();
                  return;
                }
                setTimeout(check, pollMs);
              };
              check();
            });
          };

          // Special-case: the nurse intro is a fixed short phrase (~9s). If
          // this is that intro and voice mode was enabled before the temp
          // disable, schedule a forced restore after 9s so the mic is toggled
          // back on for the student even if TTS events are delayed.
          try {
            const nurseIntroMarker = "I'm the veterinary nurse supporting this case";
            if (introText && introText.includes(nurseIntroMarker) && prevVoiceWasOnRef.current) {
              // Clear any previous timer
              if (forceRestoreTimerRef.current) {
                clearTimeout(forceRestoreTimerRef.current);
              }
              forceRestoreTimerRef.current = setTimeout(() => {
                // Only restore if still temporarily disabled and user didn't
                // explicitly toggle mic off in the meantime.
                if (tempVoiceDisabledRef.current && !userToggledOffRef.current) {
                  tempVoiceDisabledRef.current = false;
                  try {
                    setVoiceModeEnabled(true);
                  } catch (err) {
                    console.warn("Forced restore of voice mode failed:", err);
                  }
                }
                forceRestoreTimerRef.current = null;
              }, 9000);
            }
          } catch (e) {
            // ignore timer setup errors
          }

          try {
            await waitForTtsToFinish(15000, 100);
          } catch (err) {
            // ignore - we'll still attempt to restore voice mode below
          } finally {
            // Clear the temporary-disable flag only after playback is done
            tempVoiceDisabledRef.current = false;
            try {
              // Restore voice mode only if the user didn't explicitly turn it off
              // while the intro played. Also ensure we don't double-toggle if the
              // forced timer already restored it.
              if (!userToggledOffRef.current) {
                setVoiceModeEnabled(true);
              }
            } catch (err) {
              console.warn("Failed to restore voice mode after TTS", err);
            }
            // Clean up any pending forced restore timer
            if (forceRestoreTimerRef.current) {
              clearTimeout(forceRestoreTimerRef.current);
              forceRestoreTimerRef.current = null;
            }
          }
      } else {
        // If we intentionally skipped TTS for this intro, log for diagnostics.
        if (skipIntroTts) {
          try {
            console.debug("Skipping intro TTS for nurse in sensitive stage", { targetIndex, introStageTitleLower });
          } catch (e) {}

          // Ensure voice mode is available after the intro when TTS is intentionally skipped.
          // Activate voice mode unless the user explicitly toggled it off previously.
          try {
            if (!userToggledOffRef.current) {
              setVoiceModeEnabled(true);
            }
          } catch (e) {
            console.warn('Failed to enable voice mode after skipped intro TTS', e);
          }
        }
      }
      }
    }

    // After speaking (or immediately if TTS off), call parent handler to
    // actually advance the stage. Pass the current messages snapshot.
    try {
      onProceedToNextStage(messages, timeSpentSeconds);
    } catch (e) {
      console.error("Error in onProceedToNextStage:", e);
    } finally {
      isAdvancingRef.current = false;
    }
  };

  handleProceedRef.current = handleProceed;

  const scheduleAutomaticProceed = useCallback(() => {
    resetNextStageIntent();
    if (typeof window === "undefined") {
      return;
    }
    nextStageIntentTimeoutRef.current = window.setTimeout(async () => {
      nextStageIntentTimeoutRef.current = null;
      if (isStageIntentLocked()) {
        return;
      }
      if (handleProceedRef.current && !isAdvancingRef.current) {
        try {
          await handleProceedRef.current();
        } catch (err) {
          console.error("Automatic stage advance failed:", err);
        }
      }
    }, 400);
  }, [resetNextStageIntent]);

  scheduleAutoProceedRef.current = scheduleAutomaticProceed;

  const confirmPendingAdvance = async () => {
    if (!pendingStageAdvance) return;
    const { stageIndex } = pendingStageAdvance;
    setPendingStageAdvance(null);
    try {
      debugEventBus.emitEvent?.("success", "StageIntent", "confirmed", { stageIndex });
    } catch (e) {}
    // If a direct proceed handler is available, call it immediately.
    if (handleProceedRef.current && !isAdvancingRef.current) {
      try {
        await handleProceedRef.current();
      } catch (err) {
        console.error("Confirming stage advance failed:", err);
      }
    } else {
      // Fallback: schedule automatic proceed shortly
      scheduleAutoProceedRef.current?.();
    }
  };

  const declinePendingAdvance = () => {
    if (!pendingStageAdvance) return;
    const declined = pendingStageAdvance;
    setPendingStageAdvance(null);
    lockStageIntent("stay");
    try {
      debugEventBus.emitEvent?.("info", "StageIntent", "declined", { stageIndex: declined.stageIndex });
    } catch (e) {}
  };

  return (
    <div className="relative flex h-full flex-col">
      <div className="absolute top-16 right-4 z-50">
        <div className="flex items-center gap-2">
          <GuidedTour steps={tourSteps} tourId="chat-interface" autoStart={true} />
          {role === "admin" && (
            <label className="flex items-center space-x-2 text-xs text-gray-200">
              <input
                type="checkbox"
                checked={debugEnabled}
                onChange={(e) => {
                  try {
                    const v = Boolean(e.target.checked);
                    setDebugEnabled(v);
                    if (typeof window !== "undefined") window.localStorage.setItem("vw_debug", v ? "true" : "false");
                  } catch {}
                }}
              />
              <span className="select-none">Debug</span>
            </label>
          )}
        </div>
      </div>
      {/* Connection notice banner */}
      {connectionNotice && (
        <div className="w-full bg-yellow-200 text-yellow-900 px-4 py-2 text-sm text-center z-40">
          {connectionNotice}
        </div>
      )}
      {fallbackNotice && (
        <div className="w-full bg-blue-100 text-blue-900 px-4 py-2 text-sm text-center z-40">
          {fallbackNotice}
        </div>
      )}
      
      {/* Lightweight mic/noise status toast */}
      {micToast && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none">
          <div className="bg-gray-900/90 text-white text-xs px-3 py-1.5 rounded-full shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
            {micToast}
          </div>
        </div>
      )}

      {/* Admin debug toast (shows last LLM prompt + response for 10s when enabled) */}
      {debugToastVisible && debugToastText && role === "admin" && debugEnabled && (
        <div className="fixed bottom-36 left-1/2 transform -translate-x-1/2 z-50 pointer-events-auto">
          <div className="bg-black/90 text-white text-xs px-4 py-2 rounded-lg shadow-lg backdrop-blur-sm whitespace-pre-wrap max-w-2xl">
            {debugToastText}
          </div>
        </div>
      )}

      {/* Intro toast (central, non-blocking) */}
      {introMounted && (
        <div className="fixed inset-0 flex items-start justify-center pt-24 pointer-events-none z-50">
          <div
            // Allow clicks inside the card so the user can dismiss it early.
            className={`max-w-xl w-full mx-4 transition-opacity duration-700 ${showIntroToast ? "opacity-100" : "opacity-0"
              }`}
          >
            <div
              role="status"
              aria-live="polite"
              onClick={() => {
                // Start fade-out immediately, then remove from DOM after the
                // transition completes (matching the 0.8s fade used earlier).
                setShowIntroToast(false);
                window.setTimeout(() => setIntroMounted(false), 800);
              }}
              className="cursor-pointer pointer-events-auto bg-orange-500 text-white px-6 py-4 rounded-lg shadow-lg text-center"
            >
              <div className="text-sm leading-relaxed">
                You are about to start the clinical interview. Greet the owner,
                then proceed with history-taking and physical exam questions.
                <div className="mt-2 font-semibold">Voice Mode is enabled:</div>
                <div className="text-xs mt-1">
                  the app will listen and speak. To switch to text-only, click
                  the 'Voice Mode' button to disable listening and speaking.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {showStartSpeakingPrompt && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
          <div className="relative pointer-events-auto">
              <div className="flex flex-col items-center space-y-4">
                <div className="text-center mb-2 font-semibold">How would you like to begin?</div>
                <div className="flex space-x-4">
                  <Button
                    type="button"
                    size="lg"
                    className="px-8 py-6 text-lg font-semibold text-white shadow-2xl bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 hover:from-rose-600 hover:to-amber-600"
                    onClick={handleStartSpeakingPrompt}
                    disabled={startSequenceActive}
                  >
                    {startSequenceActive ? "Starting voice..." : "Speak"}
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    className="px-6 py-6 text-lg font-semibold"
                    onClick={handleStartWritePrompt}
                    disabled={startSequenceActive}
                  >
                    Write
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground mt-2">You can toggle voice mode and mic later using the mic button.</div>

                {/* LEARN HOW TO USE (overlay) - shows below the SPEAK / WRITE buttons */}
                <div className="mt-4 flex justify-center">
                  <button
                    id="learn-how-to-use-overlay"
                    type="button"
                    onClick={() => {
                      try {
                        const btn = document.getElementById('start-tour-chat-interface') as HTMLButtonElement | null;
                        if (btn) btn.click();
                        // Hide the intro banner when the user explicitly requests the tour
                        try { hideIntroToast(); } catch (e) {}
                        // keep the start overlay visible so the user can choose SPEAK/WRITE after tour
                      } catch (e) {
                        // ignore
                      }
                    }}
                    className="w-56 rounded-md bg-white/90 text-slate-800 text-sm px-4 py-3 shadow-md hover:shadow-lg transition"
                    aria-label="Learn how to use"
                  >
                    LEARN HOW TO USE
                  </button>
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="absolute -top-3 -right-3 bg-muted/90 text-foreground"
                  onClick={() => {
                    setShowStartSpeakingPrompt(false);
                    try { setVoiceModeEnabled(false); } catch (e) { /* ignore */ }
                    try { hideIntroToast(); } catch (e) {}
                  }}
                  title="Close"
                >
                  ×
                </Button>
              </div>

          </div>
        </div>
      )}
      {/* Stage Tip Toast (central, non-blocking) */}
      {stageIndicator && (
        <div className="fixed top-24 left-0 right-0 flex justify-center pointer-events-none z-40">
          <div className="bg-muted/90 backdrop-blur-sm border border-border text-foreground px-4 py-3 rounded-lg shadow-lg max-w-md text-center pointer-events-auto animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="font-semibold text-sm mb-1">{stageIndicator.title}</div>
            <div className="text-sm">{stageIndicator.body}</div>
            <button
              onClick={() => setStageIndicator(null)}
              className="absolute top-1 right-2 text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Chat messages area */}
      <div id="chat-messages" className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl">
          {/* Persona filter is controlled by the big OWNER / VOICE MODE / NURSE controls above */}
          <div className="space-y-4">
            {/* Group consecutive assistant messages by same persona/stage into a single visual entry */}
            {(() => {
              const visible = messages.filter((m) => {
                const p = m.personaRoleKey ?? (m.displayRole ? resolveChatPersonaRoleKey(m.displayRole, m.displayRole) : null);
                return p === activePersona;
              });

              const grouped: Message[] = [];
              for (const m of visible) {
                const last = grouped.length ? grouped[grouped.length - 1] : null;
                if (
                  last &&
                  last.role === "assistant" &&
                  m.role === "assistant" &&
                  (last.displayRole ?? last.role ?? "assistant") === (m.displayRole ?? m.role ?? "assistant") &&
                  last.stageIndex === m.stageIndex
                ) {
                  try {
                    // Merge content de-duplicating overlapping text
                    const mergedContent = mergeStringsNoDup(last.content, m.content);
                    (last as any).content = mergedContent;
                    // Merge structured findings shallowly
                    const lastSF = (last as any).structuredFindings || {};
                    const mSF = (m as any).structuredFindings || {};
                    const mergedSF = { ...lastSF, ...mSF };
                    if (Object.keys(mergedSF).length) (last as any).structuredFindings = mergedSF;
                    // Keep earliest timestamp
                    (last as any).timestamp = last.timestamp || m.timestamp;
                  } catch (e) {
                    grouped.push({ ...m });
                  }
                } else {
                  grouped.push({ ...m });
                }
              }

              return grouped.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  stages={stages}
                  onRetry={retryUserMessage}
                />
              ));
            })()}

            {isLoading && (
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <div className="animate-pulse">Thinking...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div> 
        </div>
      </div>

      {/* Proceed to Next Stage button */}
      <div id="stage-controls" className="border-t bg-background p-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
            <Button
              onClick={handleProceed}
              disabled={false}
              className={`sr-only w-full sm:flex-1 ${isLastStage
                ? "bg-gradient-to-l from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600"
                : "bg-gradient-to-l from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                } 
                text-white border-none transition-all duration-300`}
              variant="outline"
            >
              {nextStageTitle}
            </Button>

            <div className="grid grid-cols-1 sm:grid-cols-[auto_auto_1fr_auto] gap-4 items-center w-full p-2 bg-background/80 border border-border rounded-lg">
              {/* Left persona */}
              {/* OWNER button (left) with portrait above */}
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleSetActivePersona("owner")}
                  aria-pressed={activePersona === "owner"}
                  className={`rounded-full overflow-hidden border bg-muted focus:outline-none focus:ring-2 focus:ring-blue-500 transition-transform ${activePersona === "owner" ? "h-20 w-20 scale-100" : "h-10 w-10 scale-100"}`}
                  aria-label="Select Owner persona"
                >
                  {personaDirectory?.owner?.portraitUrl ? (
                    <img src={personaDirectory.owner.portraitUrl} alt="OWNER portrait" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">OWN</div>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleSetActivePersona("owner")}
                  className={`px-2 py-0.5 text-sm rounded-md ${activePersona === "owner" ? "bg-blue-600 text-white" : "bg-muted"}`}
                  aria-pressed={activePersona === "owner"}
                  data-testid="owner-tab"
                >
                  OWNER
                </button>
              </div> 

              {/* Central voice control with a single status button below showing current mode */}
              <div className="flex flex-col items-center gap-2 justify-center flex-shrink-0">
                <VoiceModeControl
                  voiceMode={voiceMode}
                  isListening={isListening}
                  isSpeaking={isSpeaking}
                  onToggle={toggleVoiceMode}
                  disabled={!speechSupported}
                />
                {showModeControls && (
                  <div className="flex flex-col items-stretch gap-2 w-full">
                    <button
                      id="mode-status-button"
                      className={`px-3 py-1 rounded-md text-sm ${voiceMode ? "bg-amber-500 text-white" : "bg-muted"}`}
                      aria-pressed={voiceMode}
                      onClick={() => {
                        // when toggling on, request microphone access explicitly to force permission prompt
                        try { setShowModeControls(false); } catch (e) {}
                        if (!voiceMode) {
                          try {
                            void requestPermission();
                          } catch (e) {}
                        }
                        setVoiceModeEnabled(!voiceMode);
                        textareaRef.current?.focus();
                      }}
                    >
                      {voiceMode ? "SPEAK" : "WRITE"}
                    </button>
                  </div>
                )}
              </div> 

              {/* NURSE button (right) with portrait above */}
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleSetActivePersona("veterinary-nurse")}
                  aria-pressed={activePersona === "veterinary-nurse"}
                  className={`rounded-full overflow-hidden border bg-muted focus:outline-none focus:ring-2 focus:ring-blue-500 transition-transform ${activePersona === "veterinary-nurse" ? "h-20 w-20 scale-100" : "h-10 w-10 scale-100"}`}
                  aria-label="Select Nurse persona"
                >
                  {personaDirectory?.["veterinary-nurse"]?.portraitUrl ? (
                    <img src={personaDirectory!["veterinary-nurse"].portraitUrl} alt="NURSE portrait" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">NUR</div>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleSetActivePersona("veterinary-nurse")}
                  className={`px-2 py-0.5 text-sm rounded-md ${activePersona === "veterinary-nurse" ? "bg-blue-600 text-white" : "bg-muted"}`}
                  aria-pressed={activePersona === "veterinary-nurse"}
                  data-testid="nurse-tab"
                >
                  NURSE
                </button>
              </div> 

              {/* Next stage control (large button) */}
              <div className="relative flex items-center justify-end gap-2">
                {showProceedHint && (
                  <button
                    id="proceed-hint"
                    onClick={() => {
                      try { void handleProceed(); } catch (e) {}
                      try { setShowProceedHint(false); } catch (e) {}
                    }}
                    className="absolute -top-12 right-0 bg-orange-500 text-white px-3 py-2 rounded-md shadow-xl animate-bounce text-xs font-semibold z-50"
                    aria-label="Proceed hint"
                  >
                    CLICK TO GO ON TO NEXT STAGE
                  </button>
                )}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        id="next-stage-button"
                        onClick={handleProceed}
                        size="lg"
                        variant="default"
                        className={`px-6 py-3 text-sm font-semibold ${isLastStage ? "bg-gradient-to-l from-green-500 to-teal-500" : "bg-gradient-to-l from-blue-500 to-purple-500"} text-white border-none`}
                      >
                        {isLastStage ? "COMPLETE" : "NEXT STAGE"}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{`Click here to advance to ${nextStageName}`}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* Input area placed to the right of persona controls (responsive) */}
            <div className="col-span-1 sm:col-span-1 w-full">
              <form onSubmit={handleSubmit} className="relative">
                {pendingStageAdvance && (
                  <div className="mb-2 rounded-md border bg-blue-50 px-3 py-2 text-sm flex items-center justify-between gap-3">
                    <div>
                      Step to stage: <strong>{pendingStageAdvance.title}</strong>?
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={confirmPendingAdvance}>Yes</Button>
                      <Button size="sm" variant="ghost" onClick={declinePendingAdvance}>No</Button>
                    </div>
                  </div>
                )}

                <Textarea
                  id="chat-input"
                  name="chat-message"
                  autoComplete="off"
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => {
                    const val = e.target.value;
                    baseInputRef.current = val;
                    setInput(val);
                    if (showStartSpeakingPrompt) {
                      setShowStartSpeakingPrompt(false);
                      try { setVoiceModeEnabled(false); } catch (err) {}
                      try { void sendOwnerGreetingIfNeeded(); } catch (e) {}
                    }
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={isListening ? `${interimTranscript || "Listening..."}` : "Type or record your message..."}
                  className="min-h-[90px] w-full resize-none pr-28 rounded-md bg-muted/20 border border-border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500" 
                  rows={3}
                />

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button
                          type="submit"
                          id="send-button"
                          size="icon"
                          disabled={isLoading || !input.trim() || input.trim().length < 2}
                          className={`absolute bottom-2 right-2 ${input.trim() && input.trim().length >= 2 ? "bg-gradient-to-l from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 border-none" : ""} ${autoSendFlash ? "animate-pulse ring-2 ring-offset-1 ring-blue-300" : ""}`}
                        >
                          <SendIcon className="h-5 w-5" />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {input.trim().length > 0 && input.trim().length < 2 && (
                      <TooltipContent>
                        <p>Message too short</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </form>

              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <Button variant="ghost" size="sm" className="flex items-center gap-1 text-xs" onClick={() => setShowNotepadByPersona(prev => ({ ...prev, [activePersona]: !prev[activePersona] }))}>
                  <PenLine className="h-3.5 w-3.5" />
                  {showNotepadByPersona[activePersona] ? "Hide Notepad" : "Show Notepad"}
                </Button>

                <div className="flex items-center gap-1 border rounded-md px-1 bg-background/50">
                  <FontSizeToggle />
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <Checkbox checked={autoSendStt} onCheckedChange={(v) => setAutoSendStt(Boolean(v))} />
                  <span>Auto-send STT</span>
                </label>
              </div>
            </div>
            <div className="w-full mt-3">
              {audioDevicesSupported && (
                <div className="mb-2 space-y-2">
                  {audioNotice && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      {audioNotice}
                    </div>
                  )}
                  <AudioDeviceSelector />
                </div>
              )}
            </div>


          </div>
        </div>
      </div>

      {/* Timepoint Toast */}
      {timepointToast && (
        <div className="fixed top-24 left-0 right-0 flex justify-center pointer-events-none z-50">
          <div className={`bg-primary text-primary-foreground px-6 py-4 rounded-lg shadow-lg max-w-md text-center pointer-events-auto ${toastVisible
            ? 'animate-in fade-in slide-in-from-top-4 duration-300'
            : 'animate-out fade-out slide-out-to-top-4 duration-300'
            }`}>
            <div className="font-bold text-lg mb-1">{timepointToast.title}</div>
            <div className="text-sm">{timepointToast.body}</div>
            <button
              onClick={() => hideTimepointToastWithFade()}
              className="absolute top-1 right-2 text-primary-foreground/80 hover:text-primary-foreground"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <Dialog open={showTimepointDialog} onOpenChange={setShowTimepointDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Time Progression</DialogTitle>
            <DialogDescription>
              It is now {pendingTimepoint?.label}. Do you want to proceed with the updates for this time?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleSnoozeTimepoint}>
              Wait
            </Button>
            <Button onClick={confirmTimepointUnlock}>
              Advance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notepad (per-persona) */}
      <Notepad isOpen={Boolean(showNotepadByPersona[activePersona])} onClose={() => setShowNotepadByPersona(prev => ({ ...prev, [activePersona]: false }))} />
    </div>
  );
}

