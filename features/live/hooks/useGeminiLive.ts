"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { GeminiLiveService } from "../services/geminiLiveService";
import type {
  LiveSessionStatus,
  TranscriptEntry,
  PersonaInstruction,
} from "../types";
import {
  appendLiveTextFragment,
  filterLivePersonaText,
} from "../utils/filterLiveResponse";

export type UseGeminiLiveResult = {
  status: LiveSessionStatus;
  isSpeaking: boolean;
  streamingText: string;
  transcript: TranscriptEntry[];
  currentPersona: PersonaInstruction | null;
  error: string | null;
  connect: (
    token: string,
    persona: PersonaInstruction,
    options?: { preserveTranscript?: boolean },
  ) => Promise<void>;
  disconnect: () => void;
  sendAudio: (chunk: ArrayBuffer) => void;
  sendText: (text: string) => void;
  switchPersona: (persona: PersonaInstruction, conversationContext?: string) => void;
  sendContext: (context: string) => void;
  interrupt: () => void;
  setOnAudio: (cb: ((chunk: ArrayBuffer) => void) | null) => void;
};

export function useGeminiLive(initialTranscript: TranscriptEntry[] = []): UseGeminiLiveResult {
  const serviceRef = useRef<GeminiLiveService | null>(null);
  const entryIdCounterRef = useRef(0);
  const [status, setStatus] = useState<LiveSessionStatus>("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>(initialTranscript);
  const [currentPersona, setCurrentPersona] = useState<PersonaInstruction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pendingResponseTextRef = useRef("");
  const onAudioRef = useRef<((chunk: ArrayBuffer) => void) | null>(null);
  const personaRef = useRef<PersonaInstruction | null>(null);
  const tokenRef = useRef<string | null>(null);
  const initialTranscriptRef = useRef(initialTranscript);

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
          case "textReceived":
            if (typeof event.data === "string") {
              pendingResponseTextRef.current = appendLiveTextFragment(
                pendingResponseTextRef.current,
                event.data,
              );
              setStreamingText(pendingResponseTextRef.current);
            }
            break;
          case "inputTranscription":
            if (typeof event.data === "string") {
              setTranscript((prev) => [
                ...prev,
                {
                  id: `entry_${++entryIdCounterRef.current}`,
                  speaker: "user",
                  text: event.data as string,
                  timestamp: Date.now(),
                },
              ]);
            }
            break;
          case "turnComplete": {
            const filtered = filterLivePersonaText(pendingResponseTextRef.current);

            if (!filtered.suppressed && personaRef.current) {
              const roleKey = personaRef.current.roleKey;
              setTranscript((prev) => [
                ...prev,
                {
                  id: `entry_${++entryIdCounterRef.current}`,
                  speaker: "persona",
                  text: filtered.text,
                  timestamp: Date.now(),
                  roleKey,
                },
              ]);
            }

            // Generation is complete; queued audio may still be draining.
            pendingResponseTextRef.current = "";
            setStreamingText("");
            setIsSpeaking(false);
            break;
          }
          case "interrupted":
            setIsSpeaking(false);
            pendingResponseTextRef.current = "";
            setStreamingText("");
            break;
          case "disconnected":
            setStatus("disconnected");
            setIsSpeaking(false);
            pendingResponseTextRef.current = "";
            setStreamingText("");
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
            pendingResponseTextRef.current = "";
            setStreamingText("");
            break;
        }
      },
    });

    return () => {
      serviceRef.current?.disconnect();
    };
  }, []);

  const connect = useCallback(async (
    token: string,
    persona: PersonaInstruction,
    options?: { preserveTranscript?: boolean },
  ) => {
    if (!serviceRef.current) return;
    setStatus("connecting");
    setCurrentPersona(persona);
    personaRef.current = persona;
    tokenRef.current = token;
    setError(null);
    if (!options?.preserveTranscript) setTranscript(initialTranscriptRef.current);
    pendingResponseTextRef.current = "";
    setStreamingText("");

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
    pendingResponseTextRef.current = "";
    setStreamingText("");
  }, []);

  const sendAudio = useCallback((chunk: ArrayBuffer) => {
    serviceRef.current?.sendAudio(chunk);
  }, []);

  const sendText = useCallback((text: string) => {
    serviceRef.current?.sendText(text);

    const normalized = text.trim();
    if (!normalized || normalized.startsWith("[SYS_TRIGGER]")) return;

    // Client-entered messages do not always produce inputTranscription events,
    // so record them immediately. This keeps typed turns above the persona
    // response in the same chronological transcript as spoken turns.
    setTranscript((prev) => [
      ...prev,
      {
        id: `entry_${++entryIdCounterRef.current}`,
        speaker: "user",
        text: normalized,
        timestamp: Date.now(),
      },
    ]);
  }, []);

  const switchPersona = useCallback((persona: PersonaInstruction, conversationContext?: string) => {
    setCurrentPersona(persona);
    const prev = personaRef.current;
    personaRef.current = persona;

    // If voice changed, need to reconnect; otherwise just update instruction
    if (prev?.voiceName !== persona.voiceName && tokenRef.current) {
      connect(tokenRef.current, persona, { preserveTranscript: true })
        .then(() => {
          if (conversationContext) {
            serviceRef.current?.sendConversationContext(conversationContext);
          }
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Reconnection failed");
          setStatus("error");
        });
    } else {
      serviceRef.current?.sendSystemInstruction(persona.systemInstruction);
    }
  }, [connect]);

  const sendContext = useCallback((context: string) => {
    serviceRef.current?.sendConversationContext(context);
  }, []);

  const interrupt = useCallback(() => {
    serviceRef.current?.interrupt();
    setIsSpeaking(false);
    pendingResponseTextRef.current = "";
    setStreamingText("");
  }, []);

  const setOnAudio = useCallback((cb: ((chunk: ArrayBuffer) => void) | null) => {
    onAudioRef.current = cb;
  }, []);

  return {
    status,
    isSpeaking,
    streamingText,
    transcript,
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
  };
}
