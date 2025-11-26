"use client";

import type React from "react";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { SendIcon, PenLine, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSTT } from "@/features/speech/hooks/useSTT";
import { useMicButton } from "@/features/speech/hooks/useMicButton";
import { useTTS } from "@/features/speech/hooks/useTTS";
import {
  speakRemote,
  speakRemoteStream,
  stopActiveTtsPlayback,
} from "@/features/speech/services/ttsService";
import { ChatMessage } from "@/features/chat/components/chat-message";
import { Notepad } from "@/features/chat/components/notepad";
import { FeedbackButton } from "@/features/feedback/components/feedback-button";
import { SaveAttemptButton } from "@/features/attempts/components/save-attempt-button";
import { useSaveAttempt } from "@/features/attempts/hooks/useSaveAttempt";
import type { Message } from "@/features/chat/models/chat";
import type { Stage } from "@/features/stages/types";
import { getStageTip } from "@/features/stages/services/stageService";
import { chatService } from "@/features/chat/services/chatService";
import { getOrAssignVoiceForRole } from "@/features/speech/services/voiceMap";
import type { TtsEventDetail } from "@/features/speech/models/tts-events";
import { normalizeRoleKey } from "@/features/avatar/utils/role-utils";

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
};

type PersonaDirectoryEntry = {
  displayName?: string;
  portraitUrl?: string;
  voiceId?: string;
  sex?: string;
};

export function ChatInterface({
  caseId,
  attemptId,
  initialMessages = [],
  currentStageIndex,
  stages,
  onProceedToNextStage,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [connectionNotice, setConnectionNotice] = useState<string | null>(null);
  const [showNotepad, setShowNotepad] = useState(false);
  const [timeSpentSeconds, setTimeSpentSeconds] = useState(0);
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(
    () => Boolean(attemptId) || true
  );
  // When true, the assistant will speak first and the message text will only
  // appear after the voice playback completes. This helps focus attention on
  // the audio but may cause users to read ahead — make it optional.
  const [voiceFirst, setVoiceFirst] = useState<boolean>(
    () => Boolean(attemptId) || true
  );
  // Voice Mode (mic) should default ON when an attempt is open; otherwise off.
  const [voiceMode, setVoiceMode] = useState<boolean>(() => Boolean(attemptId));
  const [personaDirectory, setPersonaDirectory] = useState<
    Record<string, PersonaDirectoryEntry>
  >({});
  const [stageIndicator, setStageIndicator] = useState<
    { title: string; body: string } | null
  >(null);
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
  const isAdvancingRef = useRef<boolean>(false);
  const nextStageIntentTimeoutRef = useRef<number | null>(null);
  const handleProceedRef = useRef<(() => Promise<void>) | null>(null);
  const scheduleAutoProceedRef = useRef<(() => void) | null>(null);

  const upsertPersonaDirectory = useCallback(
    (roleKey: string | null | undefined, entry: PersonaDirectoryEntry) => {
      if (!roleKey) return;
      const normalized = normalizeRoleKey(roleKey) ?? roleKey;
      setPersonaDirectory((prev) => {
        const existing = prev[normalized] ?? {};
        return {
          ...prev,
          [normalized]: {
            ...existing,
            ...entry,
          },
        };
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

  const resetNextStageIntent = useCallback(() => {
    if (nextStageIntentTimeoutRef.current) {
      window.clearTimeout(nextStageIntentTimeoutRef.current);
      nextStageIntentTimeoutRef.current = null;
    }
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

  const { isListening, transcript, interimTranscript, start, stop, reset } =
    useSTT((finalText: string) => {
      console.debug(
        "STT onFinal fired, voiceMode=",
        voiceMode,
        "finalText=",
        finalText
      );
      if (voiceMode && finalText && finalText.trim()) {
        // Trim and attempt to de-duplicate obvious repeats from STT finals
        const trimmed = collapseImmediateRepeat(finalText.trim());
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
    });

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
      autoSendPendingTextRef.current = null;
      resetNextStageIntent();
    };
  }, [resetNextStageIntent]);

  useEffect(() => {
    let cancelled = false;
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
          const normalizedKey = normalizeRoleKey(rawKey) ?? rawKey;
          if (!normalizedKey) continue;
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
              typeof metadata?.sex === "string"
                ? (metadata.sex as string)
                : typeof identity?.sex === "string"
                  ? identity.sex
                  : undefined,
          };
        }
        if (!cancelled) {
          setPersonaDirectory(next);
        }
      } catch (err) {
        console.warn("Failed to load persona directory", err);
      }
    }

    void loadPersonaDirectory();
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  // Text-to-speech
  const {
    available: ttsAvailable,
    isSpeaking,
    speak,
    speakAsync,
    cancel,
  } = useTTS();

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

  type TtsPlaybackMeta = Omit<TtsEventDetail, "audio"> | undefined;

  const playTtsAndPauseStt = async (
    text: string,
    voice?: string,
    meta?: TtsPlaybackMeta
  ) => {
    if (!text) return;
    stopActiveTtsPlayback();
    let stoppedForPlayback = false;
    try {
      if (isListening) {
        stoppedForPlayback = true;
        resumeListeningRef.current = true;
        try {
          stop();
        } catch (e) {
          // ignore
        }
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
            if (ttsAvailable && speakAsync) {
              await speakAsync(ttsText);
            } else if (ttsAvailable) {
              speak(ttsText);
            }
          } catch (e) {
            console.error("TTS playback failed:", e);
          }
        }
      }
    } finally {
      // Resume listening if we previously stopped for playback and voiceMode
      // is still enabled.
      if (stoppedForPlayback && resumeListeningRef.current) {
        resumeListeningRef.current = false;
        if (voiceMode) {
          setTimeout(() => start(), 50);
        }
      }
    }
  };

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

    const hasNextStage = currentStageIndex < stages.length - 1;
    const shouldAutoAdvance =
      hasNextStage && detectNextStageIntent(trimmed);

    if (shouldAutoAdvance) {
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
      const response = await chatService.sendMessage(
        snapshot,
        currentStageIndex,
        caseId
      );
      const stage = stages[currentStageIndex] ?? stages[0];
      const roleName = response.displayRole ?? stage?.role ?? "assistant";
      const portraitUrl = response.portraitUrl;
      const aiMessage = chatService.createAssistantMessage(
        response.content,
        currentStageIndex,
        roleName,
        portraitUrl,
        response.voiceId,
        response.personaSex,
        response.personaRoleKey
      );
      const finalAssistantContent = aiMessage.content;
      const normalizedPersonaKey =
        aiMessage.personaRoleKey ??
        (roleName ? normalizeRoleKey(roleName) ?? undefined : undefined);
      upsertPersonaDirectory(normalizedPersonaKey, {
        displayName: aiMessage.displayRole,
        portraitUrl,
        voiceId: response.voiceId,
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

          const preferredVoice = aiMessage.voiceId ?? response.voiceId;
          const voiceSex: "male" | "female" | "neutral" =
            response.personaSex === "male" ||
            response.personaSex === "female" ||
            response.personaSex === "neutral"
              ? response.personaSex
              : "neutral";
          const voiceForRole = getOrAssignVoiceForRole(
            String(roleName ?? "assistant"),
            attemptId,
            {
              preferredVoice,
              sex: voiceSex,
            }
          );

          const normalizedRoleKey =
            response.personaRoleKey ??
            normalizeRoleKey(roleName ?? stage?.role ?? "assistant") ??
            undefined;
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
                aiMessage.voiceId ?? voiceForRole,
                ttsMeta
              );
            } catch (streamErr) {
              playbackError = streamErr;
              console.warn("Voice-first TTS playback encountered an error:", streamErr);
            } finally {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === placeholderMessage.id
                    ? { ...m, content: finalAssistantContent }
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
                aiMessage.voiceId ?? voiceForRole,
                ttsMeta
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
        // TTS disabled — just show the message
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
    }
  };

  const retryUserMessage = async (messageId: string) => {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;
    await sendUserMessage(msg.content, messageId);
  };

  const detectNextStageIntent = (content: string) => {
    const nextIndex = currentStageIndex + 1;
    const nextStage = stages[nextIndex];
    if (!nextStage) return false;

    const normalized = content.toLowerCase().replace(/\s+/g, " ").trim();
    if (!normalized) return false;

    const isQuestion = /\b(what|which|who|where|when|why|how)\b/.test(normalized);
    const postponeIntent = /\b(later|after|eventually)\b/.test(normalized);

    const directionWords = [
      "go",
      "move",
      "proceed",
      "advance",
      "continue",
      "switch",
      "jump",
      "head",
      "start",
      "begin",
      "shift",
    ];
    const directionPhrases = ["let's", "lets", "ready to", "time to", "we should"];
    const hasDirectionWord = directionWords.some((word) =>
      new RegExp(`\\b${word}\\b`).test(normalized)
    );
    const hasDirectionPhrase = directionPhrases.some((phrase) =>
      normalized.includes(phrase)
    );
    const hasDirection = hasDirectionWord || hasDirectionPhrase;

    const mentionsNextStagePhrase = /\bnext\s+(stage|section|part|step)\b/.test(normalized);
    const stageNumber = nextIndex + 1;
    const mentionsStageNumber = new RegExp(
      `\\b(stage|section|part)\\s*${stageNumber}\\b`
    ).test(normalized);

    if (mentionsNextStagePhrase && !isQuestion && !postponeIntent) {
      const shortDirectCommand = /^(next\s+(stage|section|part|step))(\s+(please|now))?$/.test(
        normalized
      );
      if (hasDirection || /\bplease\b/.test(normalized) || shortDirectCommand) {
        return true;
      }
    }

    if (
      mentionsStageNumber &&
      !isQuestion &&
      !postponeIntent &&
      (hasDirection || /\bplease\b/.test(normalized) || /\bnow\b/.test(normalized))
    ) {
      return true;
    }

    if (!isQuestion) {
      const numericShortCommand = new RegExp(
        `^(stage|section|part)\\s*${stageNumber}(\\s+(please|now))?$`
      ).test(normalized);
      if (numericShortCommand && !postponeIntent) {
        return true;
      }
    }

    const nextKeywords = stageKeywordSets[nextIndex] ?? [];
    const mentionsNextKeywords = nextKeywords.some((keyword) => {
      if (!keyword) return false;
      const candidate = keyword.trim();
      if (!candidate) return false;
      return normalized.includes(candidate.toLowerCase());
    });

    if (!mentionsNextKeywords) {
      return false;
    }

    if ((hasDirection || mentionsNextStagePhrase) && !isQuestion && !postponeIntent) {
      return true;
    }

    const immediateCue =
      !isQuestion && (/(^now\b|\bnow$)/.test(normalized) || /\bplease\b/.test(normalized));
    if (immediateCue && !postponeIntent) {
      const keywordMatchesEdge = nextKeywords.some((keyword) => {
        if (!keyword) return false;
        const candidate = keyword.toLowerCase();
        return (
          normalized.startsWith(candidate) ||
          normalized.endsWith(`${candidate} now`) ||
          normalized.includes(`${candidate} now`) ||
          normalized.includes(`now ${candidate}`)
        );
      });
      if (keywordMatchesEdge) {
        return true;
      }
    }

    return false;
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
          p.caseId
        );

        // Append assistant reply into chat UI
        const roleName = response.displayRole ?? stages[currentStageIndex].role;
        const aiMessage = chatService.createAssistantMessage(
          response.content,
          p.stageIndex,
          String(roleName ?? "assistant"),
          response.portraitUrl,
          response.voiceId,
          response.personaSex,
          response.personaRoleKey
        );
        const normalizedPersonaKey =
          aiMessage.personaRoleKey ??
          (roleName ? normalizeRoleKey(String(roleName)) ?? undefined : undefined);
        upsertPersonaDirectory(normalizedPersonaKey, {
          displayName: aiMessage.displayRole,
          portraitUrl: response.portraitUrl,
          voiceId: response.voiceId,
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

  // Toggle voice mode (persistent listening until toggled off)
  const toggleVoiceMode = () => {
    setVoiceMode((v) => {
      const next = !v;
      if (next) {
        // User enabled voice mode -> clear the "user toggled off" flag
        userToggledOffRef.current = false;
        // enable voice mode -> start listening
        reset();
        setInput("");
        baseInputRef.current = "";
        start();
      } else {
        // User disabled voice mode -> mark that choice so auto-init doesn't
        // re-enable it automatically for this attempt.
        userToggledOffRef.current = true;
        // disable voice mode -> stop listening and auto-send transcript
        // Also disable TTS so the related UI toggles off automatically.
        stopAndMaybeSend();
        stopActiveTtsPlayback();
        try {
          // Cancel any playing speech and turn off TTS toggle
          cancel();
        } catch (e) {
          // ignore
        }
        setTtsEnabled(false);
      }
      return next;
    });
  };

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
    if (voiceMode && !isListening && !startedListeningRef.current) {
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

  // Auto-focus textarea when loaded
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
    // attemptId changes or other hooks update.
  }, []);

  // attemptId changes or other hooks update.
  useEffect(() => {
    if (!attemptId) return;

    // Only initialize voice mode once per attemptId. Some hooks (start/reset)
    // may change identity during runtime which could re-run this effect and
    // inadvertently re-enable voice mode after the user explicitly toggled
    // it off. Use prevAttemptIdRef to ensure we only run this initialization
    // when the attemptId actually changes.
    if (prevAttemptIdRef.current === attemptId) return;
    prevAttemptIdRef.current = attemptId;

    // Ensure voiceMode state is ON when an attempt opens
    setVoiceMode(true);

    // Start listening once when an attempt opens. Don't gate on the
    // `voiceMode` state variable (it may not have updated yet in this
    // render), instead use the startedListeningRef to ensure we only start
    // once.
    if (!startedListeningRef.current) {
      try {
        reset();
        setInput("");
        baseInputRef.current = "";
        start();
        startedListeningRef.current = true;
      } catch (e) {
        console.error("Failed to start STT after attempt opened:", e);
      }
    }
    // Run only when attemptId changes; intentionally omit start/reset from
    // the dependency list to avoid re-running due to identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  // Timer to track time spent on the case
  useEffect(() => {
    // Only start the timer if we have an attempt ID
    if (!attemptId) return;

    // Set up a timer that increments every second
    const timer = setInterval(() => {
      setTimeSpentSeconds((prev) => prev + 1);
    }, 1000);

    // Clean up the timer when the component unmounts
    return () => clearInterval(timer);
  }, [attemptId]);

  // Auto-save (throttled) — keeps the existing delete+insert server behavior
  const { saveProgress } = useSaveAttempt(attemptId);
  const lastSavedAtRef = useRef<number>(0);
  const lastSavedSnapshotRef = useRef<string>("");

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
    setStageIndicator({
      title: stageTitle,
      body: tip,
    });
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

    return `I am a veterinary assistant. I'm here to help with the ${title.toLowerCase()} and to provide information about findings and tests when requested. Please let me know how I can assist.`;
  };

  const handleProceed = async () => {
    resetNextStageIntent();
    if (isAdvancingRef.current) {
      return;
    }
    isAdvancingRef.current = true;
    const targetIndex = Math.min(currentStageIndex + 1, stages.length - 1);

    const introText = getStageAssistantIntro(targetIndex);
    // Choose a display role based on the configured stage role so the UI
    // labels the speaker appropriately (e.g., Owner, Laboratory Technician)
    const stageRole = stages[targetIndex]?.role ?? "Virtual Assistant";
    const roleName = String(stageRole);
    const normalizedRoleKey = normalizeRoleKey(roleName ?? "assistant") ?? undefined;
    const personaMeta = normalizedRoleKey
      ? personaDirectory[normalizedRoleKey]
      : undefined;

    // Create assistant message using persona metadata when available so the
    // client sees the correct speaker (owner vs assistant vs lab tech) with
    // a consistent portrait and voice.
    const voiceSex: "male" | "female" | "neutral" =
      personaMeta?.sex === "male" ||
      personaMeta?.sex === "female" ||
      personaMeta?.sex === "neutral"
        ? personaMeta.sex
        : "neutral";

    const voiceForRole = getOrAssignVoiceForRole(
      roleName,
      attemptId,
      {
        preferredVoice: personaMeta?.voiceId,
        sex: voiceSex,
      }
    );
    const assistantMsg = chatService.createAssistantMessage(
      introText,
      targetIndex,
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
          displayRole: assistantMsg.displayRole,
          role: roleName,
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
      {/* Connection notice banner */}
      {connectionNotice && (
        <div className="w-full bg-yellow-200 text-yellow-900 px-4 py-2 text-sm text-center z-40">
          {connectionNotice}
        </div>
      )}
      {/* Intro toast (central, non-blocking) */}
      {introMounted && (
        <div className="fixed inset-0 flex items-start justify-center pt-24 pointer-events-none z-50">
          <div
            // Allow clicks inside the card so the user can dismiss it early.
            className={`max-w-xl w-full mx-4 transition-opacity duration-700 ${
              showIntroToast ? "opacity-100" : "opacity-0"
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
      {/* Chat messages area */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl space-y-4">
          {stageIndicator && (
            <div className="flex justify-center">
              <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/50 px-4 py-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {stageIndicator.title}
                </span>
                <span>{stageIndicator.body}</span>
              </div>
            </div>
          )}
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
      <div className="border-t bg-background p-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex justify-between items-center mb-4 gap-4">
            <Button
              onClick={handleProceed}
              disabled={false}
              className={`flex-1 ${
                isLastStage
                  ? "bg-gradient-to-l from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600"
                  : "bg-gradient-to-l from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
              } 
                text-white border-none transition-all duration-300`}
              variant="outline"
            >
              {nextStageTitle}
            </Button>

            <div className="flex gap-2 items-center">
              {/* Big voice-mode toggle */}
              <Button
                type="button"
                size="sm"
                variant={voiceMode ? "destructive" : "secondary"}
                className="flex items-center gap-2 px-4"
                onClick={toggleVoiceMode}
                title={
                  voiceMode
                    ? "Disable voice mode"
                    : "Enable voice mode (toggle)"
                }
              >
                <Mic className="h-4 w-4" />
                {voiceMode ? "Voice Mode: On" : "Voice Mode: Off"}
              </Button>

              {attemptId && (
                <SaveAttemptButton
                  attemptId={attemptId}
                  stageIndex={currentStageIndex}
                  messages={messages}
                  timeSpentSeconds={timeSpentSeconds}
                />
              )}

              {/* TTS toggle */}
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center gap-1 text-xs"
                onClick={() => {
                  // When disabling, cancel any in-progress speech
                  setTtsEnabled((v) => {
                    const next = !v;
                    if (!next) {
                      stopActiveTtsPlayback();
                      cancel();
                    }
                    return next;
                  });
                }}
                title={ttsEnabled ? "Disable speech" : "Enable speech"}
              >
                {ttsEnabled ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <VolumeX className="h-4 w-4" />
                )}
              </Button>

              {/* Voice-first toggle: when enabled, play audio first and show text after */}
              <Button
                variant={voiceFirst ? "destructive" : "secondary"}
                size="sm"
                className="flex items-center gap-1 text-xs"
                onClick={() => setVoiceFirst((v) => !v)}
                title={
                  voiceFirst
                    ? "Voice-first: audio plays before text"
                    : "Text-first: show text immediately"
                }
              >
                {voiceFirst ? "Voice-first: On" : "Voice-first: Off"}
              </Button>

              <FeedbackButton
                messages={messages}
                stage={stages[currentStageIndex]}
                stageIndex={currentStageIndex}
                caseId={caseId}
                attemptId={attemptId || ""}
              />
            </div>
          </div>

          {/* ...existing UI above the input area... */}

          {/* Input area */}
          <form onSubmit={handleSubmit} className="relative">
            <Textarea
              id="chat-input"
              name="chat-message"
              autoComplete="off"
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                baseInputRef.current = e.target.value;
                setInput(e.target.value);
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
                // When voiceMode is enabled the big toggle controls listening and
                // the mic button should be passive (no click toggle required).
                if (voiceMode) return;
              }}
              onMouseDown={!voiceMode ? handleStart : undefined}
              onMouseUp={!voiceMode ? handleStop : undefined}
              onMouseLeave={!voiceMode ? handleCancel : undefined}
              // Touch support for mobile devices when not in toggle mode
              onTouchStart={!voiceMode ? handleStart : undefined}
              onTouchEnd={!voiceMode ? handleStop : undefined}
              className={`absolute bottom-2 right-12 ${
                isListening
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-blue-400 hover:bg-blue-500 text-white"
              }`}
              title={
                voiceMode
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
            <Button
              type="submit"
              id="send-button"
              size="icon"
              disabled={isLoading || !input.trim()}
              className={`absolute bottom-2 right-2 ${
                input.trim()
                  ? "bg-gradient-to-l from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 border-none"
                  : ""
              } ${
                autoSendFlash
                  ? "animate-pulse ring-2 ring-offset-1 ring-blue-300"
                  : ""
              }`}
            >
              <SendIcon className="h-5 w-5" />
            </Button>
          </form>

          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-1 text-xs"
              onClick={() => setShowNotepad(!showNotepad)}
            >
              <PenLine className="h-3.5 w-3.5" />
              {showNotepad ? "Hide Notepad" : "Show Notepad"}
            </Button>
            <span>Press Enter to send, Shift+Enter for new line</span>
          </div>
        </div>
      </div>

      {/* Notepad */}
      <Notepad isOpen={showNotepad} onClose={() => setShowNotepad(false)} />
    </div>
  );
}
