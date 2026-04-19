"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { GeminiLiveService } from "../services/geminiLiveService";
import type {
  LiveSessionStatus,
  TranscriptEntry,
  PersonaInstruction,
} from "../types";

export type UseGeminiLiveResult = {
  status: LiveSessionStatus;
  isSpeaking: boolean;
  transcript: TranscriptEntry[];
  currentPersona: PersonaInstruction | null;
  error: string | null;
  connect: (token: string, persona: PersonaInstruction) => Promise<void>;
  disconnect: () => void;
  sendAudio: (chunk: ArrayBuffer) => void;
  sendText: (text: string) => void;
  switchPersona: (persona: PersonaInstruction) => void;
  interrupt: () => void;
};

let entryIdCounter = 0;

export function useGeminiLive(): UseGeminiLiveResult {
  const serviceRef = useRef<GeminiLiveService | null>(null);
  const [status, setStatus] = useState<LiveSessionStatus>("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [currentPersona, setCurrentPersona] = useState<PersonaInstruction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const audioChunksRef = useRef<ArrayBuffer[]>([]);
  const onAudioRef = useRef<((chunks: ArrayBuffer[]) => void) | null>(null);

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
              onAudioRef.current?.(audioChunksRef.current);
            }
            break;
          case "textReceived":
            if (typeof event.data === "string" && currentPersona) {
              setTranscript((prev) => [
                ...prev,
                {
                  id: `entry_${++entryIdCounter}`,
                  speaker: "persona",
                  text: event.data as string,
                  timestamp: Date.now(),
                },
              ]);
            }
            break;
          case "inputTranscription":
            if (typeof event.data === "string") {
              setTranscript((prev) => [
                ...prev,
                {
                  id: `entry_${++entryIdCounter}`,
                  speaker: "user",
                  text: event.data as string,
                  timestamp: Date.now(),
                },
              ]);
            }
            break;
          case "turnComplete":
            setIsSpeaking(false);
            audioChunksRef.current = [];
            break;
          case "interrupted":
            setIsSpeaking(false);
            audioChunksRef.current = [];
            break;
          case "disconnected":
            setStatus("disconnected");
            setIsSpeaking(false);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = useCallback(async (token: string, persona: PersonaInstruction) => {
    if (!serviceRef.current) return;
    setStatus("connecting");
    setCurrentPersona(persona);
    setError(null);
    setTranscript([]);

    try {
      await serviceRef.current.connect(token, persona.systemInstruction);
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
    serviceRef.current?.sendSystemInstruction(persona.systemInstruction);
  }, []);

  const interrupt = useCallback(() => {
    serviceRef.current?.interrupt();
    setIsSpeaking(false);
    audioChunksRef.current = [];
  }, []);

  return {
    status,
    isSpeaking,
    transcript,
    currentPersona,
    error,
    connect,
    disconnect,
    sendAudio,
    sendText,
    switchPersona,
    interrupt,
  };
}
