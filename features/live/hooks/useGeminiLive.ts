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
  transcript: TranscriptEntry[];
  currentPersona: PersonaInstruction | null;
  error: string | null;
  connect: (token: string, persona: PersonaInstruction) => Promise<void>;
  disconnect: () => void;
  sendAudio: (chunk: ArrayBuffer) => void;
  sendText: (text: string) => void;
  switchPersona: (persona: PersonaInstruction) => void;
  interrupt: () => void;
  setOnAudio: (cb: ((chunks: ArrayBuffer[]) => void) | null) => void;
};

export function useGeminiLive(): UseGeminiLiveResult {
  const serviceRef = useRef<GeminiLiveService | null>(null);
  const entryIdCounterRef = useRef(0);
  const [status, setStatus] = useState<LiveSessionStatus>("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [currentPersona, setCurrentPersona] = useState<PersonaInstruction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const audioChunksRef = useRef<ArrayBuffer[]>([]);
  const pendingResponseTextRef = useRef("");
  const onAudioRef = useRef<((chunks: ArrayBuffer[]) => void) | null>(null);
  const personaRef = useRef<PersonaInstruction | null>(null);
  const tokenRef = useRef<string | null>(null);

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
              // Hold audio until the completed output transcription has passed
              // the safety filter. Streaming immediately would allow a
              // disclaimer to be spoken before we can identify it.
              audioChunksRef.current.push(event.data);
              setIsSpeaking(true);
            }
            break;
          case "textReceived":
            if (typeof event.data === "string") {
              pendingResponseTextRef.current = appendLiveTextFragment(
                pendingResponseTextRef.current,
                event.data,
              );
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
            const chunks = audioChunksRef.current;
            const filtered = filterLivePersonaText(pendingResponseTextRef.current);

            if (!filtered.suppressed && personaRef.current) {
              setTranscript((prev) => [
                ...prev,
                {
                  id: `entry_${++entryIdCounterRef.current}`,
                  speaker: "persona",
                  text: filtered.text,
                  timestamp: Date.now(),
                },
              ]);
              if (chunks.length > 0) {
                onAudioRef.current?.([...chunks]);
              }
            }

            // Always discard the pending turn, including suppressed audio.
            audioChunksRef.current = [];
            pendingResponseTextRef.current = "";
            setIsSpeaking(false);
            break;
          }
          case "interrupted":
            setIsSpeaking(false);
            audioChunksRef.current = [];
            pendingResponseTextRef.current = "";
            break;
          case "disconnected":
            setStatus("disconnected");
            setIsSpeaking(false);
            audioChunksRef.current = [];
            pendingResponseTextRef.current = "";
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
            audioChunksRef.current = [];
            pendingResponseTextRef.current = "";
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
    setTranscript([]);
    audioChunksRef.current = [];
    pendingResponseTextRef.current = "";

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
    audioChunksRef.current = [];
    pendingResponseTextRef.current = "";
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
    pendingResponseTextRef.current = "";
  }, []);

  const setOnAudio = useCallback((cb: ((chunks: ArrayBuffer[]) => void) | null) => {
    onAudioRef.current = cb;
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
    setOnAudio,
  };
}
