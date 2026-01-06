"use client";

import type React from "react";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { SendIcon, PenLine, Mic, MicOff, Volume2, VolumeX, Pause, Play, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  speakRemote,
  speakRemoteStream,
  stopActiveTtsPlayback,
} from "@/features/speech/services/ttsService";
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
import { useSpeechDevices } from "@/features/speech/context/audio-device-context";
import { AudioDeviceSelector } from "@/features/speech/components/audio-device-selector";
import {
  detectStageIntentLegacy,
  detectStageIntentPhase3,
  type StageIntentContext,
} from "@/features/chat/utils/stage-intent-detector";
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
  const { timepoints } = useCaseTimepoints(caseId);
  const latestInitialMessagesRef = useRef<Message[]>(initialMessages ?? []);
  const lastHydratedAttemptKeyRef = useRef<string | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [connectionNotice, setConnectionNotice] = useState<string | null>(null);
  const [showNotepad, setShowNotepad] = useState(false);
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
        setMessages((prev) => [...prev, assistantMsg]);
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
  // Track the last final transcript that onFinal handled so we don't
  // duplicate it when the `transcript` state also updates.
  const lastFinalHandledRef = useRef<string | null>(null);
  // Track last appended chunk and time to avoid rapid duplicate appends
  const lastAppendedTextRef = useRef<string | null>(null);
  const lastAppendTimeRef = useRef<number>(0);
  // Timers for STT error toast fade and voice-mode restart
  const sttErrorToastTimerRef = useRef<number | null>(null);
  const sttErrorRestartTimerRef = useRef<number | null>(null);
  // Timer for auto-sending when a '...' placeholder is left waiting
  const placeholderAutoSendTimerRef = useRef<number | null>(null);

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
        // If we're suppressing STT (TTS playing or shortly after), ignore finals
        if (isSuppressingSttRef.current) {
          // mark handled to avoid re-appending via transcript effect
          lastFinalHandledRef.current = finalText;
          return;
        }

        if (voiceMode && finalText && finalText.trim()) {
          // Trim and attempt to de-duplicate obvious repeats from STT finals
          const trimmed = collapseImmediateRepeat(finalText.trim());
          // If the final appears to exactly repeat the last assistant message
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
              if (normFinal && normAssistant && normFinal === normAssistant && recentTts) {
                // Mark handled to avoid re-appending from transcript effect
                lastFinalHandledRef.current = trimmed;
                // Do not append or send; keep listening active for the student's reply
                return;
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
          if (
            baseInputRef.current &&
            baseInputRef.current.trim().length > 0 &&
            !baseInputRef.current.trim().endsWith(trimmed)
          ) {
            baseInputRef.current = `${baseInputRef.current.trim()} ${trimmed}`;
          } else if (
            !baseInputRef.current ||
            baseInputRef.current.trim().length === 0
          ) {
            baseInputRef.current = trimmed;
          }
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
          // subsequent interim updates. This ensures that after a true
          // final transcript the text is always sent even if interims arrive
          // briefly after. Use a short delay to allow any minor buffering.
          autoSendFinalTimerRef.current = window.setTimeout(() => {
            autoSendFinalTimerRef.current = null;
            autoSendPendingTextRef.current = null;
            try {
              console.debug(
                "Auto-send (final) firing with text:",
                baseInputRef.current
              );
              void triggerAutoSend(baseInputRef.current);
            } catch (e) {
              console.error("Failed to auto-send final transcript:", e);
            }
          }, 500);
        }
      },
      700,
      {
        inputDeviceId: selectedInputId,
      }
    );

  // Handle STT Errors (e.g. network error on Chromium)
  useEffect(() => {
    if (sttError) {
      console.warn("ChatInterface received STT error:", sttError);
      let title = "Speech Recognition Error";
      let body = "An error occurred with the speech service.";

      if (sttError.includes("network")) {
        title = "Speech Service Unavailable";
        body = "Chromium browsers often lack Google Speech keys. Please use Google Chrome.";
      } else if (sttError.includes("not-allowed")) {
        title = "Microphone Blocked";
        body = "Please allow microphone access in your browser settings.";
      }

      setTimepointToast({ title, body });
      // Use setVoiceModeEnabled so we run the proper cleanup (stop STT/TTS)
      try {
        setVoiceModeEnabled(false);
      } catch (e) {
        // fallback to setting state directly if handler not available
        setVoiceMode(false);
      }
      // fade the toast after 1s, then restart voice mode 2s after the fade
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
          try {
            setVoiceModeEnabled(true);
          } catch (e) {
            setVoiceMode(true);
          }
          // if voice mode is intended and we're not listening, start STT
          if (voiceModeRef.current && !isListening) {
            try {
              start();
            } catch (e) {
              console.warn("Failed to restart STT after error:", e);
            }
          }
          sttErrorRestartTimerRef.current = null;
        }, 2000);
      }, 1000);
    }
  }, [sttError]);

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
      if (placeholderAutoSendTimerRef.current) {
        window.clearTimeout(placeholderAutoSendTimerRef.current);
        placeholderAutoSendTimerRef.current = null;
      }
      autoSendPendingTextRef.current = null;
      resetNextStageIntent();
    };
  }, [resetNextStageIntent]);

  useEffect(() => {
    let cancelled = false;
    setPersonaDirectory({});
    personaDirectoryRef.current = {};
    resetPersonaDirectoryReady();

    async function loadPersonaDirectory() {
      try {
        const response = await fetch(
          `/api/personas?caseId=${encodeURIComponent(caseId)}`
        );
        if (!response.ok) {
          throw new Error(`Failed to load personas: ${response.status}`);
        }
        const payload = await response.json().catch(() => ({ personas: [] }));
        const personas = Array.isArray(payload?.personas)
          ? payload.personas
          : [];
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
  const pendingFlushIntervalRef = useRef<number | null>(null);

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
    gender?: "male" | "female"
  ) => {
    if (!text) return;
    stopActiveTtsPlayback();
    isPlayingAudioRef.current = true;
    let stoppedForPlayback = false;
    try {
      if (isListening || voiceMode) {
        // If voice mode is on, we want to ensure we resume listening after playback,
        // even if we are currently stopped (e.g. due to pulseVoiceModeControls).
        resumeListeningRef.current = true;

        // Always attempt to stop if voice mode is on, to ensure mic is off during playback.
        // Use abort() to immediately discard any pending audio buffer to prevent
        // self-recording of the TTS start.
        try {
          // Set suppression flag so any STT events emitted while the mic is
          // shutting down or while TTS plays are ignored.
          isSuppressingSttRef.current = true;
          if (abort) {
            abort();
          } else {
            stop();
          }
          stoppedForPlayback = true;
        } catch (e) {
          // ignore
        }

        // Give a moment for the mic to fully release. Increased to 500ms to prevent
        // self-recording of the TTS start.
        await new Promise(resolve => setTimeout(resolve, 500));
      }

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
      // clear suppression after a short grace period (600ms)
      window.setTimeout(() => {
        isSuppressingSttRef.current = false;
      }, 600);
      // Resume listening if we previously stopped for playback and voiceMode
      // is still enabled. Start immediately since the awaited TTS promise
      // resolves only after playback has finished.
      if (resumeListeningRef.current) {
        resumeListeningRef.current = false;
        if (voiceMode) {
          try {
            start();
          } catch (e) {
            // ignore errors starting STT
          }
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
        personaMeta?.sex,
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
        setMessages((prev) => [...prev, assistantMsg]);
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

  // sendUserMessage helper (used by manual submit and auto-send)
  const sendUserMessage = async (text: string, existingMessageId?: string) => {
    const trimmed = String(text ?? "").trim();
    if (!trimmed || isLoading) return;

    // Prevent duplicate user messages: if the most recent user message
    // matches this content and was sent very recently, skip to avoid
    // showing the same message twice (e.g., from race between manual
    // submit and STT auto-send).
    try {
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

      // Simplified behavior: instead of a general LLM-based completeness check,
      // only treat very short (<=2 words) voice fragments as potentially
      // incomplete and wait for continuation. This avoids false positives.
      if (voiceMode && !awaitingContinuationRef.current) {
        const tokenCount = String(trimmed).split(/\s+/).filter(Boolean).length;
        if (tokenCount <= 2) {
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
          // schedule an auto-send if no continuation arrives within 6s
          if (placeholderAutoSendTimerRef.current) {
            window.clearTimeout(placeholderAutoSendTimerRef.current);
            placeholderAutoSendTimerRef.current = null;
          }
          placeholderAutoSendTimerRef.current = window.setTimeout(() => {
            if (awaitingContinuationRef.current) {
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
          }, 6000);
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

    if (existingMessageId) {
      // Mark existing message as pending and reuse it
      snapshot = messages.map((m) =>
        m.id === existingMessageId ? { ...m, status: "pending" } : m
      );
      setMessages(snapshot);
      userMessage = snapshot.find((m) => m.id === existingMessageId) ?? null;
    } else {
      userMessage = chatService.createUserMessage(trimmed, currentStageIndex);
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

      const response = await chatService.sendMessage(
        snapshot,
        currentStageIndex,
        caseId,
        { attemptId }
      );
      const stage = stages[currentStageIndex] ?? stages[0];
      const roleName = response.displayRole ?? stage?.role ?? "assistant";
      const safePersonaRoleKey =
        (response.personaRoleKey &&
          isAllowedChatPersonaKey(response.personaRoleKey)
          ? response.personaRoleKey
          : resolveChatPersonaRoleKey(stage?.role, roleName));
      const normalizedPersonaKey = safePersonaRoleKey;
      const portraitUrl = response.portraitUrl;
      const serverVoiceId = normalizeVoiceId(response.voiceId);
      let responseVoiceSex: "male" | "female" | "neutral" =
        response.personaSex === "male" ||
          response.personaSex === "female" ||
          response.personaSex === "neutral"
          ? response.personaSex
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

      // Use the specific persona name if available in the directory, otherwise fall back to the role name
      const existingPersona = normalizedPersonaKey ? personaDirectoryRef.current[normalizedPersonaKey] : undefined;
      const finalDisplayName = existingPersona?.displayName ?? roleName;

      const aiMessage = chatService.createAssistantMessage(
        response.content,
        currentStageIndex,
        finalDisplayName,
        portraitUrl,
        assistantVoiceId,
        response.personaSex,
        safePersonaRoleKey,
        response.media
      );
      const finalAssistantContent = aiMessage.content;
      upsertPersonaDirectory(normalizedPersonaKey, {
        displayName: aiMessage.displayRole,
        portraitUrl,
        voiceId: assistantVoiceId,
        sex: response.personaSex,
      });

      // Speak the assistant response when TTS is enabled. We support a
      // "voice-first" mode where the spoken audio plays first and the
      // message text is appended after playback completes.
      if (ttsEnabled && response.content) {
        try {
          if (isListening) {
            // Remember to resume after TTS finishes.
            resumeListeningRef.current = true;
            try {
              // Stop listening synchronously; some STT implementations
              // may take a moment to fully stop the microphone stream,
              // so wait briefly before starting playback to avoid the
              // assistant audio being picked up.
              stop();
            } catch (e) {
              /* ignore */
            }
            // Small settle delay to let the microphone/hardware stop.
            await new Promise((res) => setTimeout(res, 150));
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
            const placeholderMessage: Message = {
              ...aiMessage,
              content: "",
            };
            setMessages((prev) => [...prev, placeholderMessage]);
            // Ensure React renders the placeholder before audio playback starts.
            await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
            let playbackError: unknown = null;
            try {
              await playTtsAndPauseStt(
                response.content,
                finalVoiceForRole,
                ttsMeta,
                responseVoiceSex === "male" || responseVoiceSex === "female" ? responseVoiceSex : undefined
              );
            } catch (streamErr) {
              playbackError = streamErr;
              console.warn("Voice-first TTS playback encountered an error:", streamErr);
            } finally {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === placeholderMessage.id
                    ? {
                      ...m,
                      content: finalAssistantContent,
                      media: aiMessage.media,
                    }
                    : m
                )
              );
              if (playbackError) {
                console.error("TTS playback failed after voice-first attempt:", playbackError);
              }
            }
          } else {
            // Default behavior: show the text immediately, then play audio
            setMessages((prev) => [...prev, aiMessage]);
            try {
              await playTtsAndPauseStt(
                response.content,
                finalVoiceForRole,
                ttsMeta,
                responseVoiceSex === "male" || responseVoiceSex === "female" ? responseVoiceSex : undefined
              );
            } catch (err) {
              console.error("TTS failed:", err);
            }
          }

          // After TTS completes, resume listening if we previously stopped and
          // voiceMode is still active.
          if (resumeListeningRef.current) {
            resumeListeningRef.current = false;
            if (voiceMode) {
              setTimeout(() => start(), 50);
            }
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
          setMessages((prev) => [...prev, aiMessage]);
        }
      } else {
        // TTS disabled ��� just show the message
        setMessages((prev) => [...prev, aiMessage]);
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

        // Append assistant reply into chat UI
        const stage = stages[p.stageIndex] ?? stages[currentStageIndex];
        const roleName = response.displayRole ?? stage?.role;
        const safePersonaRoleKey =
          (response.personaRoleKey &&
            isAllowedChatPersonaKey(response.personaRoleKey)
            ? response.personaRoleKey
            : resolveChatPersonaRoleKey(stage?.role, roleName));
        const normalizedPersonaKey = safePersonaRoleKey;
        const portraitUrl = response.portraitUrl;
        const serverVoiceId = normalizeVoiceId(response.voiceId);
        let responseVoiceSex: "male" | "female" | "neutral" =
          response.personaSex === "male" ||
            response.personaSex === "female" ||
            response.personaSex === "neutral"
            ? response.personaSex
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
        const aiMessage = chatService.createAssistantMessage(
          response.content,
          p.stageIndex,
          String(roleName ?? "assistant"),
          portraitUrl,
          assistantVoiceId,
          response.personaSex,
          safePersonaRoleKey,
          response.media
        );
        upsertPersonaDirectory(normalizedPersonaKey, {
          displayName: aiMessage.displayRole,
          portraitUrl,
          voiceId: assistantVoiceId,
          sex: response.personaSex,
        });
        setMessages((prev) => [...prev, aiMessage]);
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

  const setVoiceModeEnabled = useCallback(
    (next: boolean) => {
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
          if (!isPlayingAudioRef.current) {
            start();
          }
        } else {
          // User disabled voice mode -> mark and stop any active capture
          userToggledOffRef.current = true;
          stopAndMaybeSend();
          // Explicitly stop listening to ensure mic is off
          stop();
          setTtsEnabledState(false);
        }
        return next;
      });
    },
    [reset, start, stopAndMaybeSend, stop, setTtsEnabledState]
  );

  // Toggle voice mode (persistent listening until toggled off)
  const toggleVoiceMode = useCallback(() => {
    setVoiceModeEnabled(!voiceModeRef.current);
  }, [setVoiceModeEnabled]);

  const togglePause = useCallback(async () => {
    if (isPaused) {
      setIsPaused(false);
      // Ensure voice mode and TTS are enabled when resuming
      setVoiceModeEnabled(true);
      setTtsEnabledState(true);

      // If voice mode was already on (so setVoiceModeEnabled didn't trigger start),
      // we need to manually restart listening now that we are unpaused.
      if (voiceModeRef.current && !isListening) {
        start();
      }
      // fade out the "Attempt Paused" toast when resuming
      if (timepointToast) hideTimepointToastWithFade(300);
    } else {
      setIsPaused(true);
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
      await pulseVoiceModeControls();
      await pulseTtsControls();
      setShowStartSpeakingPrompt(false);
    } catch (err) {
      console.error("Failed to initialize voice controls:", err);
    } finally {
      setStartSequenceActive(false);
    }
  }, [pulseVoiceModeControls, pulseTtsControls, startSequenceActive]);

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
        const combined =
          baseInputRef.current && baseInputRef.current.trim().length > 0
            ? `${baseInputRef.current.trim()} ${interimTranscript.trim()}`
            : interimTranscript;
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
          if (
            baseInputRef.current &&
            baseInputRef.current.trim().length > 0 &&
            !baseInputRef.current.trim().endsWith(finalTrim)
          ) {
            baseInputRef.current = `${baseInputRef.current.trim()} ${finalTrim}`;
          } else {
            baseInputRef.current = finalTrim;
          }
          lastAppendedTextRef.current = finalTrim;
          lastAppendTimeRef.current = now;
        }
        setInput(baseInputRef.current);

        // If the STT engine exposed the final via the `transcript` state
        // rather than the onFinal callback, ensure we still schedule the
        // final-only auto-send timer so the message doesn't get stuck.
        if (voiceMode && !autoSendFinalTimerRef.current) {
          autoSendFinalTimerRef.current = window.setTimeout(() => {
            autoSendFinalTimerRef.current = null;
            autoSendPendingTextRef.current = null;
            try {
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

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
  }, [attemptId]);

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
    e.preventDefault();
    // Delegate to shared sendUserMessage helper
    await sendUserMessage(input);
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
    setMessages((prev) => [...prev, assistantMsg]);

    // Speak if tts enabled; stop listening first so the assistant audio
    // isn't picked up by STT, then resume listening after TTS completes.
    if (ttsEnabled && introText) {
      try {
        // If currently listening, stop and remember to resume. Wait a
        // short moment to ensure the mic stream is stopped before playback.
        if (isListening) {
          resumeListeningRef.current = true;
          try {
            stop();
          } catch (e) {
            /* ignore */
          }
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
        await playTtsAndPauseStt(
          introText,
          assistantMsg.voiceId ?? voiceForRole,
          introMeta
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
        if (resumeListeningRef.current) {
          resumeListeningRef.current = false;
          if (voiceMode) {
            // Resume after a short delay so mic hardware settles
            setTimeout(() => start(), 150);
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
        <GuidedTour steps={tourSteps} tourId="chat-interface" autoStart={true} />
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
            <Button
              type="button"
              size="lg"
              className="px-8 py-6 text-lg font-semibold text-white shadow-2xl bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 hover:from-rose-600 hover:to-amber-600"
              onClick={handleStartSpeakingPrompt}
              disabled={startSequenceActive}
            >
              {startSequenceActive ? "Starting voice..." : "Click Here to START Speaking"}
            </Button>
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
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.map((message) => (
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

      {/* Proceed to Next Stage button */}
      <div id="stage-controls" className="border-t bg-background p-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
            <Button
              onClick={handleProceed}
              disabled={false}
              className={`w-full sm:flex-1 ${isLastStage
                ? "bg-gradient-to-l from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600"
                : "bg-gradient-to-l from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                } 
                text-white border-none transition-all duration-300`}
              variant="outline"
            >
              {nextStageTitle}
            </Button>

            <div className="flex gap-2 items-center w-full sm:w-auto justify-center sm:justify-end">
              {/* Pause Button */}
              <Button
                type="button"
                size="sm"
                variant={isPaused ? "default" : "secondary"}
                className="flex items-center gap-2 px-4"
                onClick={togglePause}
                title={isPaused ? "Resume case" : "Pause case"}
              >
                {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                <span className="hidden sm:inline">{isPaused ? "Resume" : "Pause"}</span>
              </Button>

              {/* Big voice-mode toggle */}
              <Button
                type="button"
                size="sm"
                variant={voiceMode ? "destructive" : "secondary"}
                className="flex items-center gap-2 px-4"
                onClick={toggleVoiceMode}
                disabled={!speechSupported}
                title={
                  !speechSupported
                    ? "Speech recognition is not supported in this browser (try Chrome/Edge)"
                    : voiceMode
                      ? "Disable voice mode"
                      : "Enable voice mode (toggle)"
                }
              >
                <Mic className="h-4 w-4" />
                <span className="hidden sm:inline">{voiceMode ? "Voice Mode: On" : "Voice Mode: Off"}</span>
                <span className="sm:hidden">{voiceMode ? "On" : "Off"}</span>
              </Button>

              {/* TTS toggle */}
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center gap-1 text-xs"
                onClick={toggleTts}
                title={ttsEnabled ? "Disable speech" : "Enable speech"}
              >
                {ttsEnabled ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <VolumeX className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {audioDevicesSupported && (
            <div className="mb-4 space-y-2">
              {audioNotice && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  {audioNotice}
                </div>
              )}
              <AudioDeviceSelector />
            </div>
          )}

          {/* Input area */}
          <form onSubmit={handleSubmit} className="relative">
            {showProceedHint && (
              <div className="absolute -top-12 left-0 right-0 flex justify-center pointer-events-none z-10">
                <div className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium animate-bounce">
                  If you have no more questions click on the [Proceed...] button
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
            {/* Mic button */}
            <Button
              type="button"
              size="icon"
              onClick={() => {
                if (speechSupported && voiceMode) {
                  toggleVoiceMode();
                }
              }}
              disabled={!speechSupported}
              onMouseDown={speechSupported && !voiceMode ? handleStart : undefined}
              onMouseUp={speechSupported && !voiceMode ? handleStop : undefined}
              onMouseLeave={speechSupported && !voiceMode ? handleCancel : undefined}
              // Touch support for mobile devices when not in toggle mode
              onTouchStart={speechSupported && !voiceMode ? handleStart : undefined}
              onTouchEnd={speechSupported && !voiceMode ? handleStop : undefined}
              className={`absolute bottom-2 right-12 ${isListening
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-blue-400 hover:bg-blue-500 text-white"
                } ${!speechSupported ? "opacity-50 cursor-not-allowed" : ""}`}
              title={
                !speechSupported
                  ? "Speech recognition is not supported in this browser"
                  : voiceMode
                    ? isListening
                      ? "Stop listening"
                      : "Start listening"
                    : "Hold to record, release to send"
              }
            >
              {isListening ? (
                <MicOff className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </Button>
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
            {role && (role === "professor" || role === "admin") && (
              <Button
                type="button"
                size="icon"
                title="Search attached reference papers"
                className="absolute bottom-2 right-14 bg-white text-gray-700 border"
                onClick={() => {
                  const q = input.trim() || (messages.length > 0 ? messages[messages.length - 1].content : "");
                  void runPaperSearch(q);
                }}
              >
                🔎
              </Button>
            )}
          </form>

          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center gap-1 text-xs"
                onClick={() => setShowNotepad(!showNotepad)}
              >
                <PenLine className="h-3.5 w-3.5" />
                {showNotepad ? "Hide Notepad" : "Show Notepad"}
              </Button>
              <div className="flex items-center gap-1 border rounded-md px-1 bg-background/50">
                <FontSizeToggle />
              </div>
              {/* Developer Skip Button - Hidden by default unless needed, or we can just show it */}
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-destructive"
                onClick={() => {
                  if (confirm("Force skip to next stage? This bypasses AI checks.")) {
                    handleProceed();
                  }
                }}
                title="Force Skip Stage (Dev)"
              >
                <SkipForward className="h-3.5 w-3.5" />
                Skip
              </Button>
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

      {/* Notepad */}
      <Notepad isOpen={showNotepad} onClose={() => setShowNotepad(false)} />
    </div>
  );
}

