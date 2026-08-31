"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { GeminiLiveService } from "../services/geminiLiveService";
import { mergeAssistantFragment } from "../utils/mergeAssistantFragment";
import type { Message } from "@/features/chat/models/chat";
import type {
  LiveSessionStatus,
  PersonaInstruction,
} from "../types";
import { filterLivePersonaText } from "../utils/filterLiveResponse";
import { isLikelyNonEnglish, translateTranscriptToEnglish } from "../utils/transcriptLanguage";

export type UseGeminiLiveResult = {
  status: LiveSessionStatus;
  isSpeaking: boolean;
  messages: Message[];
  /** Live interim transcription of what the user is saying (not yet final). */
  pendingInput: string | null;
  currentPersona: PersonaInstruction | null;
  error: string | null;
  connect: (token: string, persona: PersonaInstruction) => Promise<void>;
  disconnect: () => void;
  sendAudio: (chunk: ArrayBuffer) => void;
  sendText: (text: string) => void;
  switchPersona: (persona: PersonaInstruction, conversationContext?: string) => void;
  sendContext: (context: string) => void;
  interrupt: () => void;
  setOnAudio: (cb: ((chunk: ArrayBuffer) => void) | null) => void;
  setOnInterrupted: (cb: (() => void) | null) => void;
  /** True while the persona's generated audio is actually playing locally. */
  setModelAudioActive: (active: boolean) => void;
};

export function useGeminiLive(
  currentStageIndex: number = 0,
  initialMessages: Message[] = []
): UseGeminiLiveResult {
  const serviceRef = useRef<GeminiLiveService | null>(null);
  const entryIdCounterRef = useRef(0);
  const [status, setStatus] = useState<LiveSessionStatus>("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [pendingInput, setPendingInput] = useState<string | null>(null);
  const [currentPersona, setCurrentPersona] = useState<PersonaInstruction | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Synchronous mirror of `messages` so event handlers (which run outside
  // React's render cycle) can build on the latest transcript.
  const messagesRef = useRef<Message[]>(initialMessages);

  // Latest interim input transcription not yet committed to `messages`.
  const pendingInputRef = useRef<string | null>(null);

  // Live user entry tracking: the user's words are committed to the log as
  // soon as the first transcription event arrives and updated in place, so
  // they always appear BEFORE the persona reply regardless of the order the
  // server delivers input/output transcription events.
  const pendingUserIdRef = useRef<string | null>(null);
  const pendingUserFinalRef = useRef(false);
  const lastFlushedUserIdRef = useRef<string | null>(null);

  // Partial assistant text of the current turn (see mergeAssistantFragment).
  const pendingAssistantRef = useRef<string | null>(null);
  const pendingAssistantIdRef = useRef<string | null>(null);

  const onAudioRef = useRef<((chunk: ArrayBuffer) => void) | null>(null);
  const onInterruptedRef = useRef<(() => void) | null>(null);
  // Echo guard mirror: true while the persona's audio is being generated OR
  // still playing through the local queue.
  const isSpeakingRef = useRef(false);
  const modelAudioActiveRef = useRef(false);

  const setSpeaking = useCallback((v: boolean) => {
    isSpeakingRef.current = v;
    setIsSpeaking(v);
  }, []);

  const setModelAudioActive = useCallback((active: boolean) => {
    modelAudioActiveRef.current = active;
  }, []);

  const personaRef = useRef<PersonaInstruction | null>(null);
  const tokenRef = useRef<string | null>(null);
  const stageIndexRef = useRef(currentStageIndex);

  // Keep stageIndexRef in sync with the prop so new messages get the right stage
  useEffect(() => {
    stageIndexRef.current = currentStageIndex;
  }, [currentStageIndex]);

  const commitMessages = useCallback((next: Message[]) => {
    messagesRef.current = next;
    setMessages(next);
  }, []);

  const appendUserMessage = useCallback(
    (text: string, dedupeLast = false) => {
      // Dedupe only on demand (flush path): guards against a finished event
      // adding the same utterance right before the turnComplete flush.
      if (dedupeLast) {
        const prev = messagesRef.current;
        const last = prev[prev.length - 1];
        if (last && last.role === "user" && last.content === text) return;
      }
      commitMessages([
        ...messagesRef.current,
        {
          id: `entry_${++entryIdCounterRef.current}`,
          role: "user" as const,
          content: text,
          timestamp: new Date().toISOString(),
          stageIndex: stageIndexRef.current,
          displayRole: "You",
          personaRoleKey: personaRef.current?.roleKey,
          status: "sent" as const,
        },
      ]);
    },
    [commitMessages]
  );

  const resetPendingAssistant = useCallback(() => {
    pendingAssistantRef.current = null;
    pendingAssistantIdRef.current = null;
  }, []);

  // The model's own TTS picked up by an open mic gets transcribed as user
  // input. If a candidate "user" utterance substantially overlaps the latest
  // assistant message, it is echo — drop it.
  const isEchoOfAssistant = useCallback(
    (text: string): boolean => {
      const norm = (s: string) =>
        s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
      const candidate = norm(text);
      if (candidate.length < 25) return false;
      const lastAssistant = [...messagesRef.current]
        .reverse()
        .find((m) => m.role !== "user");
      if (!lastAssistant?.content) return false;
      const assistant = norm(lastAssistant.content);
      if (!assistant) return false;
      return assistant.includes(candidate) || candidate.includes(assistant);
    },
    []
  );

  // Create or update the in-flight user entry (see pendingUserIdRef).
  const upsertPendingUserEntry = useCallback(
    (text: string) => {
      const prev = messagesRef.current;
      const id = pendingUserIdRef.current;

      if (id) {
        const existing = prev.find((m) => m.id === id);
        if (!existing || existing.content === text) return;
        commitMessages(prev.map((m) => (m.id === id ? { ...m, content: text } : m)));
        return;
      }

      // No tracked entry: update the last flushed partial only when the final
      // text extends it (prevents duplicates when `finished` arrives late,
      // after turnComplete already flushed a partial transcription).
      const last = prev[prev.length - 1];
      if (
        last &&
        last.id === lastFlushedUserIdRef.current &&
        last.role === "user" &&
        text.startsWith(last.content)
      ) {
        commitMessages(prev.map((m) => (m.id === last.id ? { ...m, content: text } : m)));
        lastFlushedUserIdRef.current = null;
        pendingUserIdRef.current = last.id;
        return;
      }

      const newId = `entry_${++entryIdCounterRef.current}`;
      pendingUserIdRef.current = newId;
      commitMessages([
        ...prev,
        {
          id: newId,
          role: "user" as const,
          content: text,
          timestamp: new Date().toISOString(),
          stageIndex: stageIndexRef.current,
          displayRole: "You",
          personaRoleKey: personaRef.current?.roleKey,
          status: "sent" as const,
        },
      ]);
    },
    [commitMessages]
  );

  // Repair transcriptions delivered in the wrong language: replace the entry
  // content once the server-side translation resolves. The model heard the
  // original audio, so this only touches what the student reads.
  const rewriteEntryContent = useCallback(
    (entryId: string, expected: string, next: string) => {
      const current = messagesRef.current.find((m) => m.id === entryId);
      if (!current || current.content !== expected) return; // superseded
      commitMessages(
        messagesRef.current.map((m) => (m.id === entryId ? { ...m, content: next } : m))
      );
    },
    [commitMessages]
  );

  // Initialize service once
  useEffect(() => {
    serviceRef.current = new GeminiLiveService({
      onEvent: (event) => {
        switch (event.type) {
          case "connected":
            setStatus("connected");
            setError(null);
            break;
          case "audioReceived":
            if (event.data instanceof ArrayBuffer) {
              // Stream audio to the player immediately for a live, low-latency
              // conversation feel. Disclaimer blocking is handled by the
              // persona system prompt instead of gating playback here.
              onAudioRef.current?.(event.data);
              setSpeaking(true);
            }
            break;
          case "textReceived": {
            if (typeof event.data !== "string" || !personaRef.current) break;
            // Ordering guarantee: if the user's transcription hasn't been
            // committed yet, flush it FIRST so the reply never lands above
            // the question.
            if (pendingInputRef.current) {
              const flushed = pendingInputRef.current;
              pendingInputRef.current = null;
              setPendingInput(null);
              upsertPendingUserEntry(flushed);
            }
            const p = personaRef.current;
            // Accumulate streaming fragments into ONE entry per intervention.
            const result = mergeAssistantFragment(
              messagesRef.current,
              event.data,
              pendingAssistantIdRef.current,
              pendingAssistantRef.current,
              {
                displayName: p.displayName,
                roleKey: p.roleKey,
                portraitUrl: p.portraitUrl,
                voiceName: p.voiceName,
              },
              stageIndexRef.current,
              entryIdCounterRef.current
            );
            pendingAssistantIdRef.current = result.pendingId;
            pendingAssistantRef.current = result.pendingText;
            entryIdCounterRef.current = result.nextId;
            commitMessages(result.messages);
            break;
          }
          case "inputTranscription": {
            // ECHO GUARD: while the persona is generating or playing audio,
            // an open mic hears the model's own voice — those transcriptions
            // are NOT the user speaking. Drop them entirely.
            if (isSpeakingRef.current || modelAudioActiveRef.current) {
              pendingInputRef.current = null;
              setPendingInput(null);
              break;
            }
            const payload = event.data;
            const text =
              typeof payload === "string"
                ? payload
                : (payload as { text?: string } | null)?.text ?? "";
            const finished =
              typeof payload === "object" &&
              payload !== null &&
              (payload as { finished?: boolean }).finished === true;
            if (!text || !text.trim()) break;
            // Late-arriving echo: a transcription that substantially repeats
            // the latest assistant reply is the model hearing itself — drop it.
            if (isEchoOfAssistant(text)) {
              pendingInputRef.current = null;
              setPendingInput(null);
              pendingUserIdRef.current = null;
              break;
            }
            if (finished) {
              // Final transcription → commit/update the user entry with the
              // authoritative text.
              pendingInputRef.current = null;
              setPendingInput(null);
              upsertPendingUserEntry(text);
              const committedId = pendingUserIdRef.current;
              pendingUserIdRef.current = null;
              pendingUserFinalRef.current = true;
              if (committedId && isLikelyNonEnglish(text)) {
                const entryId = committedId;
                void translateTranscriptToEnglish(text).then((english) => {
                  if (english && english !== text) {
                    rewriteEntryContent(entryId, text, english);
                  }
                });
              }
            } else {
              // Interim → show the user's words immediately and grow them in
              // place until the final event lands.
              pendingInputRef.current = text;
              setPendingInput(text);
              upsertPendingUserEntry(text);
              pendingUserFinalRef.current = false;
            }
            break;
          }
          case "turnComplete": {
            // Defensive flush: if the final event never carried `finished: true`,
            // commit the last interim text so the user's words still land in the
            // chat log (deduped in upsertPendingUserEntry).
            if (pendingInputRef.current) {
              const flushed = pendingInputRef.current;
              pendingInputRef.current = null;
              setPendingInput(null);
              upsertPendingUserEntry(flushed);
            }
            // Track the flushed entry so a late `finished` event extends it
            // instead of duplicating it, then reset per-utterance state.
            lastFlushedUserIdRef.current = pendingUserIdRef.current;
            pendingUserIdRef.current = null;
            pendingUserFinalRef.current = false;

            // Ported from live: filter persona disclaimers/meta commentary out
            // of the completed assistant turn. If suppressed, drop the message;
            // otherwise replace its content with the filtered text.
            if (personaRef.current && pendingAssistantIdRef.current) {
              const filtered = filterLivePersonaText(pendingAssistantRef.current ?? "");
              const pid = pendingAssistantIdRef.current;
              if (filtered.suppressed) {
                commitMessages(messagesRef.current.filter((m) => m.id !== pid));
              } else if (pendingAssistantRef.current && filtered.text !== pendingAssistantRef.current) {
                commitMessages(
                  messagesRef.current.map((m) =>
                    m.id === pid ? { ...m, content: filtered.text } : m
                  )
                );
              }
            }

            // Generation is complete; queued audio may still be draining.
            setSpeaking(false);
            resetPendingAssistant();
            break;
          }
          case "interrupted":
            pendingInputRef.current = null;
            setSpeaking(false);
            // Barge-in: the model was cut off mid-turn, so drop any audio the
            // local player still has queued (wired from live-session).
            onInterruptedRef.current?.();
            // Keep the partial text already shown; a new turn starts next event.
            resetPendingAssistant();
            break;
          case "disconnected":
            setStatus("disconnected");
            setSpeaking(false);
            pendingInputRef.current = null;
            setPendingInput(null);
            pendingUserIdRef.current = null;
            pendingUserFinalRef.current = false;
            resetPendingAssistant();
            // Show disconnect reason as error if it indicates a real problem
            const disconnectReason = typeof event.data === "string" ? event.data : null;
            if (disconnectReason && !disconnectReason.includes("Session ended")) {
              setError(disconnectReason);
            }
            break;
          case "error":
            setError(typeof event.data === "string" ? event.data : "Unknown error");
            setStatus("error");
            setSpeaking(false);
            pendingInputRef.current = null;
            setPendingInput(null);
            pendingUserIdRef.current = null;
            pendingUserFinalRef.current = false;
            resetPendingAssistant();
            break;
        }
      },
    });

    return () => {
      serviceRef.current?.disconnect();
    };
  }, [appendUserMessage, commitMessages, resetPendingAssistant, upsertPendingUserEntry, rewriteEntryContent]);

  const connect = useCallback(
    async (token: string, persona: PersonaInstruction) => {
      if (!serviceRef.current) return;
      setStatus("connecting");
      setCurrentPersona(persona);
      personaRef.current = persona;
      tokenRef.current = token;
      setError(null);
      resetPendingAssistant();

      try {
        await serviceRef.current.connect(token, persona.systemInstruction, persona.voiceName);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Connection failed");
        setStatus("error");
      }
    },
    [resetPendingAssistant]
  );

  const disconnect = useCallback(() => {
    serviceRef.current?.disconnect();
    setStatus("disconnected");
    setSpeaking(false);
    pendingInputRef.current = null;
    setPendingInput(null);
    resetPendingAssistant();
  }, [resetPendingAssistant]);

  const sendAudio = useCallback((chunk: ArrayBuffer) => {
    serviceRef.current?.sendAudio(chunk);
  }, []);

  const sendText = useCallback(
    (text: string) => {
      serviceRef.current?.sendText(text);

      const normalized = text.trim();
      if (!normalized || normalized.startsWith("[SYS_TRIGGER]")) return;

      // Client-entered messages do not always produce inputTranscription
      // events, so record them immediately (ported from live). This keeps
      // typed turns above the persona response in chronological order.
      appendUserMessage(normalized);
    },
    [appendUserMessage]
  );

  const switchPersona = useCallback(
    (persona: PersonaInstruction, conversationContext?: string) => {
      setCurrentPersona(persona);
      const prev = personaRef.current;
      personaRef.current = persona;

      // P4.3: If voice changed, need to reconnect; otherwise just update
      // instruction inline — no disconnect, audio continues uninterrupted.
      if (prev?.voiceName !== persona.voiceName && tokenRef.current) {
        connect(tokenRef.current, persona)
          .then(() => {
            if (conversationContext) {
              serviceRef.current?.sendConversationContext(conversationContext);
            }
          })
          .catch((err: unknown) => {
            setError(err instanceof Error ? err.message : "Reconnection failed");
            setStatus("error");
          });
      } else if (serviceRef.current?.isConnected) {
        serviceRef.current.sendSystemInstruction(persona.systemInstruction);
        if (conversationContext) {
          serviceRef.current.sendConversationContext(conversationContext);
        }
      }
    },
    [connect]
  );

  const sendContext = useCallback((context: string) => {
    serviceRef.current?.sendConversationContext(context);
  }, []);

  const interrupt = useCallback(() => {
    serviceRef.current?.interrupt();
    setSpeaking(false);
    pendingInputRef.current = null;
    setPendingInput(null);
    resetPendingAssistant();
  }, [resetPendingAssistant]);

  const setOnAudio = useCallback((cb: ((chunk: ArrayBuffer) => void) | null) => {
    onAudioRef.current = cb;
  }, []);

  const setOnInterrupted = useCallback((cb: (() => void) | null) => {
    onInterruptedRef.current = cb;
  }, []);

  return {
    status,
    isSpeaking,
    messages,
    pendingInput,
    currentPersona,
    error,
    connect,
    disconnect,
    sendAudio,
    sendText,
    switchPersona,
    sendContext,
    interrupt,
    setOnAudio,
    setOnInterrupted,
    setModelAudioActive,
  };
}
