"use client";

import type React from "react";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";

import { SendIcon, PenLine } from "lucide-react";
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
import { setSttSuppressed, enterDeafMode, exitDeafMode, setGlobalPaused, isInDeafMode } from "@/features/speech/services/sttService";
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
import VoiceModeControl from "@/features/chat/components/VoiceModeControl";
import { AudioDeviceSelector } from "@/features/speech/components/audio-device-selector";
import {
  detectStageIntentLegacy,
  detectStageIntentPhase3,
  type StageIntentContext,
} from "@/features/chat/utils/stage-intent-detector";
import { parseRequestedKeys } from "@/features/chat/services/physFinder";
import { endsWithIncompleteMarker } from "@/features/chat/utils/incomplete";
import { detectPersonaSwitch, looksLikeLabRequest } from "@/features/chat/utils/persona-intent";
import { emitStageEvaluation } from "@/features/chat/utils/stage-eval";
import axios from "axios";
import {
  detectStageReadinessIntent,
  type StageReadinessContext,
  type StageReadinessDetection,
  type StageReadinessIntent,
} from "@/features/chat/utils/stage-readiness-intent";
import { dispatchStageIntentEvent } from "@/features/chat/models/stage-intent-events";
import { dispatchStageReadinessEvent } from "@/features/chat/models/stage-readiness-events";
import { useCaseTimepoints } from "@/features/cases/hooks/useCaseTimepoints";
import type { CaseTimepoint } from "@/features/cases/models/caseTimepoint";
import { useAuth } from "@/features/auth/services/authService";
import { HelpTip } from "@/components/ui/help-tip";
import { GuidedTour } from "@/components/ui/guided-tour";
import { FontSizeToggle } from "@/features/navigation/components/font-size-toggle";

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
];

const STAGE_COMPLETION_RULES: Record<string, StageCompletionRule> = {
  "physical examination": {
    minUserTurns: 2,
    minAssistantTurns: 2,
    assistantKeywords: PHYSICAL_EXAM_KEYWORDS,
    minAssistantKeywordHits: 2,
  },
};

const ENABLE_PHASE_THREE_STAGE_INTENT =
  process.env.NEXT_PUBLIC_ENABLE_PHASE_THREE_STAGE_INTENT === "true";
const ENABLE_STAGE_READINESS_TELEMETRY =
  process.env.NEXT_PUBLIC_ENABLE_STAGE_READINESS_INTENT === "true";
const STAGE_STAY_BLOCK_WINDOW_MS = 45_000;

const normalizeVoiceId = (voice?: string | null) =>
  voice && isSupportedVoice(voice) ? voice : undefined;

import type { CaseMediaItem } from "@/features/cases/models/caseMedia";

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
    { element: '#voice-controls', popover: { title: 'Voice Controls', description: 'Toggle voice input (microphone) and text-to-speech (speaker) on or off.' } },
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

  const appendAssistantMessage = (msg: Message) => {
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
      } catch (e) {
        // ignore dedupe errors
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

  // Transform or suppress nurse/lab assistant messages on the client as a
  // secondary guardrail: if the assistant is a nurse and the current stage
  // is Physical/Laboratory/Treatment and the student did NOT explicitly
  // request specific findings, replace the long findings dump with a
  // clarifying prompt. Also disable TTS for suppressed messages to avoid
  // accidental self-capture or leakage.
  const transformNurseAssistantMessage = (
    aiMessage: Message,
    stage: Stage | undefined,
    lastUserText?: string
  ): { message: Message; allowTts: boolean } => {
    try {
      const personaKey = aiMessage.personaRoleKey ?? "";
      const roleLower = (stage?.role ?? "").toLowerCase();
      const stageTitle = (stage?.title ?? "").toLowerCase();
      const isSensitiveStage = /physical|laboratory|lab|treatment/.test(stageTitle) || /nurse|lab|laboratory/.test(roleLower);
      const isNursePersona = personaKey === "veterinary-nurse" || /nurse|lab/.test(personaKey || roleLower);
      if (!isSensitiveStage || !isNursePersona) return { message: aiMessage, allowTts: true };

      // Prefer explicit lastUserText, but fall back to the most recent
      // user message from conversation state if not provided.
      let lastUser = String(lastUserText ?? "").trim();
      if (!lastUser) {
        try {
          const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
          lastUser = String(lastUserMsg?.content ?? "").trim();
        } catch (e) {
          lastUser = "";
        }
      }
      const requested = parseRequestedKeys(lastUser || "");
      // If the user explicitly requested specific canonical keys, allow normal flow
      if (requested && Array.isArray(requested.canonical) && requested.canonical.length > 0) {
        return { message: aiMessage, allowTts: true };
      }

      // If the assistant content is short/simple, allow it
      const content = String(aiMessage.content ?? "").trim();
      if (!content || content.length < 180) return { message: aiMessage, allowTts: true };

      // Heuristics: if content contains multiple parameter indicators or pipe separators,
      // treat as a findings dump and suppress it in favor of a clarifying prompt.
      const findingsIndicators = /(temperature|temp\b|heart rate|pulse|respiratory rate|rr\b|hr\b|blood pressure|vitals|respirations)/i;
      const looksLikeDump = (content.match(/\|/g) || []).length >= 2 || findingsIndicators.test(content);
      if (!looksLikeDump) return { message: aiMessage, allowTts: true };

      const clarifying = "I can provide specific physical findings if you request them. Which parameters would you like (for example: 'hr, rr, temperature')?";
      const replaced: Message = { ...aiMessage, content: clarifying };
      return { message: replaced, allowTts: false };
    } catch (e) {
      return { message: aiMessage, allowTts: true };
    }
  };
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
  const [showStartSpeakingPrompt, setShowStartSpeakingPrompt] = useState(true);
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
      };

      addLabel(stage?.title);
      addLabel(stage?.role);

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
      const rule = ruleKey ? STAGE_COMPLETION_RULES[ruleKey] : undefined;
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
                  console.debug("Auto-send BLOCKED: in deaf mode (TTS playing or recently ended)");
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
                const minWordsWhenSuppressed = isSensitiveStage ? 1 : 3;
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
                  console.debug("Auto-send BLOCKED: message ends with incomplete marker", { finalLastWord, text: textToSend });
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

  const personaToastTimerRef = useRef<number | null>(null);
  const voiceModeToastTimerRef = useRef<number | null>(null);

  // Persist persona-specific input drafts to localStorage and show a brief
  // toast when the user switches persona.
  const handleSetActivePersona = useCallback((next: AllowedChatPersonaKey) => {
    if (next === activePersona) return;
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

    // show a short toast to confirm persona switch
    const displayName = personaDirectoryRef.current?.[next]?.displayName ?? (next === "owner" ? "OWNER" : "NURSE");
    setTimepointToast({ title: `Talking to ${displayName}`, body: "" });
    // Hide after 2s (clear any prior timer first)
    if (personaToastTimerRef.current) {
      window.clearTimeout(personaToastTimerRef.current);
    }
    personaToastTimerRef.current = window.setTimeout(() => {
      hideTimepointToastWithFade(300);
      personaToastTimerRef.current = null;
    }, 2000);
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
        if (userToggledOffRef.current || !voiceModeRef.current) {
          console.debug("attemptStartListening stopping retries", { attempts });
          return;
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
      setSttSuppressed(true);
    } catch {}
    isSuppressingSttRef.current = true;
    
    // Track whether the mic was actively listening *before* we started TTS
    // so we can deterministically restore it when playback ends. We consider
    // a mic 'paused for TTS' only if it was actively listening and the user
    // hadn't explicitly toggled it off.
    wasMicPausedForTtsRef.current = Boolean(isListening && !userToggledOffRef.current);
    // Only mark for resume if we actually paused the mic due to TTS.
    // This avoids accidental restarts when voice-mode is enabled but mic
    // wasn't actively listening (edge conditions, paused state, etc.).
    resumeListeningRef.current = Boolean(wasMicPausedForTtsRef.current);

    
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
    
    // Wait for mic hardware to fully release before playing audio
    // This is critical to prevent self-capture
    // Increased from 500ms to 700ms (+40%) for better separation and robustness
    await new Promise((resolve) => setTimeout(resolve, 700));
    
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
      // Record the tts end time and keep STT suppressed briefly to avoid
      // residual self-capture from the assistant audio.
      lastTtsEndRef.current = Date.now();
      
      // Exit deaf mode - this adds a 1.5 second buffer where results are still ignored
      // to catch any trailing audio/echo from TTS
      try {
        exitDeafMode();
      } catch {}
      
      // Clear suppression and restart STT. We use a manual delay sequence here
      // rather than relying on the service's default cooldown, because we know
      // exactly when playback ended.
      // 1. Wait 500ms for audio tail/echo to die down.
      // 2. Clear suppression (skip cooldown).
      // 3. Start listening immediately after.
      window.setTimeout(() => {
        isSuppressingSttRef.current = false;
        try {
          // Clear suppression but keep a small cooldown window to avoid immediate restarts
          // that could capture trailing assistant audio. Use default cooldown to enforce buffer.
          setSttSuppressed(false);
        } catch {}
      }, 800); // Increased buffer to 800ms to avoid residual self-capture


        // Decide whether to resume listening. Prefer resuming when the mic was
      // actively paused for TTS playback (wasMicPausedForTtsRef). Additionally,
      // if voice mode is enabled but the mic was not actively listening when
      // playback started (e.g., brief suppression or race), we should also
      // restart STT so the user can continue speaking immediately after the
      // intro. Always avoid resuming if the user explicitly toggled the mic off.
      if (!skipResume) {
        const shouldResumeDueToTts = wasMicPausedForTtsRef.current && !userToggledOffRef.current;
        const shouldResumeDueToVoiceMode = !wasMicPausedForTtsRef.current && voiceModeRef.current && !userToggledOffRef.current && !isListening;
        if (shouldResumeDueToTts) {
          // Clear TTS-paused marker and request restart
          wasMicPausedForTtsRef.current = false;
          resumeListeningRef.current = false;
          try {
            console.debug("playTtsAndPauseStt: resuming STT due to TTS-paused mic", { delay: 900 });
          } catch (e) {}
          attemptStartListening(900);
        } else if (shouldResumeDueToVoiceMode) {
          // Case: voice mode is on, mic wasn't actively listening at TTS start,
          // but user expects the app to listen after intro. Attempt restart.
          try {
            console.debug("playTtsAndPauseStt: resuming STT because voice mode is enabled and mic is currently idle", { delay: 900, voiceMode: !!voiceModeRef.current });
          } catch (e) {}
          attemptStartListening(900);
        } else if (resumeListeningRef.current) {
          // Fallback: existing behavior for cases where we wanted to resume
          // due to voiceMode being enabled or other prior state.
          resumeListeningRef.current = false;
          try {
            console.debug("playTtsAndPauseStt: resuming STT (fallback)", { delay: 900 });
          } catch (e) {}
          attemptStartListening(900);
        }
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

  // sendUserMessage helper (used by manual submit and auto-send)
  const sendUserMessage = async (text: string, existingMessageId?: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Detect explicit persona-switch requests (e.g., "can I talk with the owner")
    try {
      const personaSwitch = detectPersonaSwitch(trimmed);
      if (personaSwitch) {
        // Only switch if different
        if (personaSwitch !== activePersona) {
          handleSetActivePersona(personaSwitch);
          // Small confirmation message from the assistant persona
          (async () => {
            try {
              const personaMeta = await ensurePersonaMetadata(personaSwitch);
              const confirm = `Now talking to ${personaMeta?.displayName ?? (personaSwitch === "owner" ? "Owner" : "Nurse")}.`;
              const assistantMsg = chatService.createAssistantMessage(
                confirm,
                currentStageIndex,
                personaMeta?.displayName ?? (personaSwitch === "owner" ? "Owner" : "Nurse"),
                personaMeta?.portraitUrl,
                personaMeta?.voiceId,
                personaMeta?.sex as any,
                personaSwitch
              );
              appendAssistantMessage(assistantMsg);
              if (ttsEnabled) {
                try {
                  await playTtsAndPauseStt(confirm, personaMeta?.voiceId, { roleKey: personaSwitch, displayRole: assistantMsg.displayRole, role: personaSwitch, caseId } as any, personaMeta?.sex as any);
                } catch {}
              }
            } catch (e) {}
          })();
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
      if (!isLabStage && activePersona === "veterinary-nurse" && looksLikeLabRequest(trimmed)) {
        const personaMeta = await ensurePersonaMetadata("veterinary-nurse");
        const ack = "All right Doc, we will request that!";
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
      console.warn("Duplicate submission blocked by ref-check:", trimmed);
      return;
    }
    
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
          return;
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

        const brief = "Please wait until the Laboratory & Tests stage for those results.";
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

    // Guard: avoid double-user messages. If the last message in the history
    // is already from the user, do not append another consecutive user message.
    // This prevents accidental duplicate sends or repeated STT auto-sends from
    // creating back-to-back student messages in the chat.
    const lastMsg = messages[messages.length - 1];
    if (!existingMessageId && lastMsg && lastMsg.role === "user") {
      try {
        console.warn("Suppressed consecutive user message to avoid duplicates", { lastId: lastMsg.id, newText: trimmed });
      } catch (e) {}
      // Optionally, we could replace the previous user message or merge; currently
      // the requirement is to omit the latter message, so we simply return silently.
      return;
    }

    // Record the UI-selected persona at the moment of send to avoid race
    // conditions where the server reply might be attributed to another role.
    selectedPersonaAtSendRef.current = activePersona;

    // If the current active persona is the nurse and the user is sending a message,
    // emit a brief nurse acknowledgement message immediately so the user sees a
    // responsive acknowledgement from the chosen persona before the server reply.
    if (!existingMessageId && activePersona === "veterinary-nurse") {
      (async () => {
        try {
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
          appendAssistantMessage(ackMsg);
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
      } else if (stageResult.status !== "ready") {
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

    setIsLoading(true);

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
      const finalDisplayName = existingPersona?.displayName ?? roleName;
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
              setSttSuppressed(false, true);
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
      setIsLoading(false);
      // Reset interim transcripts after a send
      reset();
      // Clear base input buffer after a send so future dictation starts
      // from an empty buffer.
      baseInputRef.current = "";
      // Ensure visible input is cleared after the send completes
      setInput("");
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
      // flash briefly
      setAutoSendFlash(true);
      window.setTimeout(() => setAutoSendFlash(false), 600);
    } catch (e) {
      // ignore
    }
    // Clear hint if auto-sending
    setShowProceedHint(false);
    return sendUserMessage(text);
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
  const toggleVoiceMode = useCallback(() => {
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
        setSttSuppressed(false, true); // skip cooldown
        exitDeafMode(); // clear deaf mode timestamp
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
          start();
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
          start();
        } catch (e) {
          console.warn("Failed to start STT on click", e);
        }
      }
      setShowStartSpeakingPrompt(false);
    } catch (err) {
      console.error("Failed to initialize voice controls:", err);
    } finally {
      setStartSequenceActive(false);
    }
  }, [startSequenceActive, setVoiceModeEnabled, setTtsEnabledState, isListening, start]);

  // Update input when transcript changes
  // Update input when interim or final transcripts arrive. When listening,
  // show the live interim transcript in the textarea so users see dictation
  // as it happens. When interim is empty, show the last final transcript.
  useEffect(() => {
    if (isListening) {
      // If there's live interim text, cancel any pending auto-send because
      // the user is still speaking. Show interim appended to committed base.
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
          setInput(baseInputRef.current);
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
                console.debug("Auto-send (transcript) BLOCKED: in deaf mode");
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
      if (!container) {
        // Fallback to previous behavior
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
        return;
      }
      const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
      if (nearBottom) {
        container.scrollTo({ top: container.scrollHeight, behavior: "auto" });
      }
    } catch (e) {
      // If anything goes wrong, silently fallback to basic scrollIntoView
      try {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
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
    // Hide after 7s (fade handled by CSS transition)
    const t1 = window.setTimeout(() => setShowIntroToast(false), 7000);
    // Remove from DOM after fade (0.8s)
    const t2 = window.setTimeout(() => setIntroMounted(false), 7800);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [attemptId]);

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
        start();
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
      start();
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
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [attemptId, isListening, stop, setVoiceModeEnabled, setTtsEnabledState, stopActiveTtsPlayback, enterDeafMode]);

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
      // Delegate to shared sendUserMessage helper
      await sendUserMessage(input);
    } finally {
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
  const nextStageTitle = isLastStage
    ? "Complete Examination"
    : `Proceed to ${stages[currentStageIndex + 1]?.title || "Next Stage"}`;

  // Helper to produce a short assistant intro when proceeding to a new stage
  const getStageAssistantIntro = (targetStageIndex: number) => {
    const title = stages[targetStageIndex]?.title || "next stage";
    const role = String(stages[targetStageIndex]?.role || "").toLowerCase();
    // If the upcoming stage expects interaction with the owner/client,
    // have the intro come from the owner (roleplay) rather than the
    // veterinary assistant so the student hears the owner prompt.
    if (role.includes("owner") || role.includes("client")) {
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

    // Append assistant message immediately so user sees it
    appendAssistantMessage(assistantMsg);

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
            <div className="flex gap-4">
              <Button
                type="button"
                size="lg"
                className="px-8 py-6 text-lg font-semibold text-white shadow-2xl bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 hover:from-rose-600 hover:to-amber-600"
                onClick={handleStartSpeakingPrompt}
                disabled={startSequenceActive}
              >
                {startSequenceActive ? "Starting voice..." : "SPEAK"}
              </Button>

              <Button
                type="button"
                size="lg"
                variant="secondary"
                className="px-8 py-6 text-lg font-semibold"
                onClick={() => {
                  setShowStartSpeakingPrompt(false);
                  try { setVoiceModeEnabled(false); } catch (e) { /* ignore */ }
                  try { textareaRef.current?.focus(); } catch (e) {}
                }}
              >
                WRITE
              </Button>
            </div>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="absolute -top-3 -right-3 bg-muted/90 text-foreground"
              onClick={() => {
                setShowStartSpeakingPrompt(false);
                try { setVoiceModeEnabled(false); } catch (e) { /* ignore */ }
              }}
              title="Close"
            >
              ×
            </Button>
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
            {messages
              .filter((m) => {
                // Determine persona for message: explicit personaRoleKey preferred,
                // fallback to displayRole classification when available.
                const p = m.personaRoleKey ?? (m.displayRole ? resolveChatPersonaRoleKey(m.displayRole, m.displayRole) : null);
                return p === activePersona;
              })
              .map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  stages={stages}
                  onRetry={retryUserMessage}
                />
              ))}
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

            <div className="flex gap-4 items-center w-full sm:w-auto justify-center">
              {/* OWNER button (left) with portrait above */}
              <div className="flex flex-col items-center gap-1">
                <div className="h-10 w-10 rounded-full overflow-hidden border bg-muted">
                  {personaDirectory?.owner?.portraitUrl ? (
                    <img src={personaDirectory.owner.portraitUrl} alt="OWNER portrait" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">OWN</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleSetActivePersona("owner")}
                  className={`px-3 py-1 rounded-md ${activePersona === "owner" ? "bg-blue-600 text-white" : "bg-muted"}`}
                  aria-pressed={activePersona === "owner"}
                  data-testid="owner-tab"
                >
                  OWNER
                </button>
              </div>

              {/* Central voice control with a single status button below showing current mode */}
              <div className="flex flex-col items-center gap-2">
                <VoiceModeControl
                  voiceMode={voiceMode}
                  isListening={isListening}
                  isSpeaking={isSpeaking}
                  onToggle={toggleVoiceMode}
                  disabled={!speechSupported}
                />
                <button
                  id="mode-status-button"
                  className={`px-3 py-1 rounded-md text-sm ${voiceMode ? "bg-amber-500 text-white" : "bg-muted"}`}
                  aria-pressed={voiceMode}
                  onClick={() => {
                    // when toggling on, request microphone access explicitly to force permission prompt
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

              {/* NURSE button (right) with portrait above */}
              <div className="flex flex-col items-center gap-1">
                <div className="h-10 w-10 rounded-full overflow-hidden border bg-muted">
                  {personaDirectory?.["veterinary-nurse"]?.portraitUrl ? (
                    <img src={personaDirectory!["veterinary-nurse"].portraitUrl} alt="NURSE portrait" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">NUR</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleSetActivePersona("veterinary-nurse")}
                  className={`px-3 py-1 rounded-md ${activePersona === "veterinary-nurse" ? "bg-blue-600 text-white" : "bg-muted"}`}
                  aria-pressed={activePersona === "veterinary-nurse"}
                  data-testid="nurse-tab"
                >
                  NURSE
                </button>
              </div>
            </div>
          </div>



          {/* Input area */}
          <form onSubmit={handleSubmit} className="relative">
            {/* Visual proceed hint hidden per UI polish (programmatic proceed remains via handleProceed) */}
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
                // If the user starts typing, hide the start-speaking prompt
                // and ensure voice mode is deactivated to avoid unexpected listening.
                if (showStartSpeakingPrompt) {
                  setShowStartSpeakingPrompt(false);
                  try {
                    setVoiceModeEnabled(false);
                  } catch (err) {
                    // ignore if not ready
                  }
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                isListening
                  ? `${interimTranscript || "Listening..."}`
                  : "Type or record your message..."
              }
              className="min-h-[60px] w-full resize-none pr-24"
              rows={1}
            />

            {/* Send button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      type="submit"
                      id="send-button"
                      size="icon"
                      disabled={isLoading || !input.trim() || input.trim().length < 2}
                      className={`absolute bottom-2 right-2 ${input.trim() && input.trim().length >= 2
                        ? "bg-gradient-to-l from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 border-none"
                        : ""
                        } ${autoSendFlash
                          ? "animate-pulse ring-2 ring-offset-1 ring-blue-300"
                          : ""
                        }`}
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
            {/* Paper-search button removed per UX request */}
          </form>

          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center gap-1 text-xs"
                onClick={() => setShowNotepadByPersona(prev => ({ ...prev, [activePersona]: !prev[activePersona] }))}
              >
                <PenLine className="h-3.5 w-3.5" />
                {showNotepadByPersona[activePersona] ? "Hide Notepad" : "Show Notepad"}
              </Button>

              <div className="flex items-center gap-1 border rounded-md px-1 bg-background/50">
                <FontSizeToggle />
              </div>

              <div className="flex items-center gap-2 px-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox checked={autoSendStt} onCheckedChange={(v) => setAutoSendStt(Boolean(v))} />
                        <span className="text-xs">Auto-send STT</span>
                      </label>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>When enabled, spoken messages are sent automatically; when disabled, click Send to submit.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Developer Skip Button hidden (visual-only): kept programmatically via handleProceed() */}
              {/* <Button hidden>Skip</Button> */}
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

            <span>Press Enter to send, Shift+Enter for new line</span>
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

