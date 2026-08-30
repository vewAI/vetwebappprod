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

export type UseGeminiLiveResult = {
  status: LiveSessionStatus;
  isSpeaking: boolean;
  messages: Message[];
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
  const [currentPersona, setCurrentPersona] = useState<PersonaInstruction | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Synchronous mirror of `messages` so event handlers (which run outside
  // React's render cycle) can build on the latest transcript.
  const messagesRef = useRef<Message[]>(initialMessages);

  // Latest interim input transcription not yet committed to `messages`.
  const pendingInputRef = useRef<string | null>(null);

  // Partial assistant text of the current turn (see mergeAssistantFragment).
  const pendingAssistantRef = useRef<string | null>(null);
  const pendingAssistantIdRef = useRef<string | null>(null);

  const onAudioRef = useRef<((chunk: ArrayBuffer) => void) | null>(null);
  const onInterruptedRef = useRef<(() => void) | null>(null);
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
              setIsSpeaking(true);
            }
            break;
          case "textReceived": {
            if (typeof event.data !== "string" || !personaRef.current) break;
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
            if (finished) {
              // Final transcription → commit to the chat log.
              pendingInputRef.current = null;
              appendUserMessage(text);
            } else {
              pendingInputRef.current = text;
            }
            break;
          }
          case "turnComplete": {
            // Defensive flush: if the final event never carried `finished: true`,
            // commit the last interim text so the user's words still land in the
            // chat log (deduped in appendUserMessage).
            if (pendingInputRef.current) {
              appendUserMessage(pendingInputRef.current, true);
              pendingInputRef.current = null;
            }

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
            setIsSpeaking(false);
            resetPendingAssistant();
            break;
          }
          case "interrupted":
            pendingInputRef.current = null;
            setIsSpeaking(false);
            // Barge-in: the model was cut off mid-turn, so drop any audio the
            // local player still has queued (wired from live-session).
            onInterruptedRef.current?.();
            // Keep the partial text already shown; a new turn starts next event.
            resetPendingAssistant();
            break;
          case "disconnected":
            setStatus("disconnected");
            setIsSpeaking(false);
            pendingInputRef.current = null;
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
            setIsSpeaking(false);
            pendingInputRef.current = null;
            resetPendingAssistant();
            break;
        }
      },
    });

    return () => {
      serviceRef.current?.disconnect();
    };
  }, [appendUserMessage, commitMessages, resetPendingAssistant]);

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
    setIsSpeaking(false);
    pendingInputRef.current = null;
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
    setIsSpeaking(false);
    pendingInputRef.current = null;
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
  };
}
