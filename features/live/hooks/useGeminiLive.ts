"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { GeminiLiveService } from "../services/geminiLiveService";
import { mergeAssistantFragment } from "../utils/mergeAssistantFragment";
import { insertUserMessage } from "../utils/insertUserMessage";
import type { Message } from "@/features/chat/models/chat";
import type {
  LiveSessionStatus,
  PersonaInstruction,
} from "../types";

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
  switchPersona: (persona: PersonaInstruction) => void;
  interrupt: () => void;
  setOnAudio: (cb: ((chunks: ArrayBuffer[]) => void) | null) => void;
  setOnAudioStream: (cb: ((chunk: ArrayBuffer) => void) | null) => void;
  setOnAudioFlush: (cb: (() => void) | null) => void;
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

  const audioChunksRef = useRef<ArrayBuffer[]>([]);
  const onAudioRef = useRef<((chunks: ArrayBuffer[]) => void) | null>(null);
  const onAudioStreamRef = useRef<((chunk: ArrayBuffer) => void) | null>(null);
  const onAudioFlushRef = useRef<(() => void) | null>(null);
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
      // Compare against the most recent USER entry — the current assistant
      // entry may sit below it, so the plain "last message" check is not enough.
      if (dedupeLast) {
        const prev = messagesRef.current;
        let i = prev.length - 1;
        while (i >= 0 && prev[i].role !== "user") i--;
        if (i >= 0 && prev[i].content === text) return;
      }
      const userMessage: Message = {
        id: `entry_${++entryIdCounterRef.current}`,
        role: "user" as const,
        content: text,
        timestamp: new Date().toISOString(),
        stageIndex: stageIndexRef.current,
        displayRole: "You",
        personaRoleKey: personaRef.current?.roleKey,
        status: "sent" as const,
      };
      // If the assistant is already streaming its reply, place the user's
      // intervention ABOVE it so the log reads user-then-avatar.
      commitMessages(
        insertUserMessage(messagesRef.current, userMessage, pendingAssistantIdRef.current)
      );
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
              audioChunksRef.current.push(event.data);
              setIsSpeaking(true);
              onAudioStreamRef.current?.(event.data);
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
            const chunks = audioChunksRef.current;
            if (chunks.length > 0) {
              onAudioRef.current?.([...chunks]);
              audioChunksRef.current = [];
            }
            onAudioFlushRef.current?.();
            setIsSpeaking(false);
            resetPendingAssistant();
            break;
          }
          case "interrupted":
            pendingInputRef.current = null;
            setIsSpeaking(false);
            audioChunksRef.current = [];
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

  const sendText = useCallback((text: string) => {
    serviceRef.current?.sendText(text);
  }, []);

  const switchPersona = useCallback((persona: PersonaInstruction) => {
    setCurrentPersona(persona);
    const prev = personaRef.current;
    personaRef.current = persona;

    // P4.3: If voice changed, need to reconnect; otherwise just update instruction
    if (prev?.voiceName !== persona.voiceName && tokenRef.current) {
      // P4.3: Keep audio flowing during reconnect — don't interrupt playback.
      // The service reconnects in the background; onAudioStream continues.
      serviceRef.current?.disconnect();
      setStatus("connecting");
      serviceRef.current?.connect(tokenRef.current, persona.systemInstruction, persona.voiceName)
        .then(() => {
          setStatus("connected");
          setError(null);
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Reconnection failed");
          setStatus("error");
        });
    } else if (serviceRef.current?.isConnected) {
      // P4.3: Same voice — just send updated system instruction inline.
      // No disconnect needed; audio playback continues uninterrupted.
      serviceRef.current.sendSystemInstruction(persona.systemInstruction);
    }
  }, []);

  const interrupt = useCallback(() => {
    serviceRef.current?.interrupt();
    setIsSpeaking(false);
    audioChunksRef.current = [];
  }, []);

  const setOnAudio = useCallback((cb: ((chunks: ArrayBuffer[]) => void) | null) => {
    onAudioRef.current = cb;
  }, []);

  const setOnAudioStream = useCallback((cb: ((chunk: ArrayBuffer) => void) | null) => {
    onAudioStreamRef.current = cb;
  }, []);

  const setOnAudioFlush = useCallback((cb: (() => void) | null) => {
    onAudioFlushRef.current = cb;
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
    interrupt,
    setOnAudio,
    setOnAudioStream,
    setOnAudioFlush,
  };
}
