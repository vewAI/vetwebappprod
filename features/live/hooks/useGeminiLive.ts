"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { GeminiLiveService } from "../services/geminiLiveService";
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
          case "textReceived":
            if (typeof event.data === "string" && personaRef.current) {
              const p = personaRef.current;
              setMessages((prev) => [
                ...prev,
                {
                  id: `entry_${++entryIdCounterRef.current}`,
                  role: "assistant",
                  content: event.data as string,
                  timestamp: new Date().toISOString(),
                  stageIndex: stageIndexRef.current,
                  displayRole: p.displayName,
                  personaRoleKey: p.roleKey,
                  portraitUrl: p.portraitUrl,
                  voiceId: p.voiceName,
                  status: "sent" as const,
                },
              ]);
            }
            break;
          case "inputTranscription":
            if (typeof event.data === "string") {
              setMessages((prev) => [
                ...prev,
                {
                  id: `entry_${++entryIdCounterRef.current}`,
                  role: "user",
                  content: event.data as string,
                  timestamp: new Date().toISOString(),
                  stageIndex: stageIndexRef.current,
                  displayRole: "You",
                  personaRoleKey: personaRef.current?.roleKey,
                  status: "sent" as const,
                },
              ]);
            }
            break;
          case "turnComplete": {
            const chunks = audioChunksRef.current;
            if (chunks.length > 0) {
              onAudioRef.current?.([...chunks]);
              audioChunksRef.current = [];
            }
            onAudioFlushRef.current?.();
            setIsSpeaking(false);
            break;
          }
          case "interrupted":
            setIsSpeaking(false);
            audioChunksRef.current = [];
            break;
          case "disconnected":
            setStatus("disconnected");
            setIsSpeaking(false);
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
            break;
        }
      },
    });

    return () => {
      serviceRef.current?.disconnect();
    };
  }, []);

  const connect = useCallback(async (token: string, persona: PersonaInstruction) => {
    if (!serviceRef.current) return;
    setStatus("connecting");
    setCurrentPersona(persona);
    personaRef.current = persona;
    tokenRef.current = token;
    setError(null);

    try {
      await serviceRef.current.connect(token, persona.systemInstruction, persona.voiceName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
      setStatus("error");
    }
  }, []);

  const disconnect = useCallback(() => {
    serviceRef.current?.disconnect();
    setStatus("disconnected");
    setIsSpeaking(false);
  }, []);

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

    // If voice changed, need to reconnect; otherwise just update instruction
    if (prev?.voiceName !== persona.voiceName && tokenRef.current) {
      serviceRef.current?.disconnect();
      setStatus("connecting");
      serviceRef.current?.connect(tokenRef.current, persona.systemInstruction, persona.voiceName)
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Reconnection failed");
          setStatus("error");
        });
    } else {
      serviceRef.current?.sendSystemInstruction(persona.systemInstruction);
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
