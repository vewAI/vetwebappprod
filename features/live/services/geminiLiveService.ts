import {
  GEMINI_LIVE_MODEL,
  type LiveEvent,
} from "../types";

export type LiveServiceCallbacks = {
  onEvent: (event: LiveEvent) => void;
};

const GEMINI_WS_BASE = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent";

export class GeminiLiveService {
  private ws: WebSocket | null = null;
  private callbacks: LiveServiceCallbacks;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private setupResolve: (() => void) | null = null;
  private audioChunkCount = 0;

  constructor(callbacks: LiveServiceCallbacks) {
    this.callbacks = callbacks;
  }

  async connect(token: string, systemInstruction: string): Promise<void> {
    this.disconnect();

    const url = `${GEMINI_WS_BASE}?key=${encodeURIComponent(token)}`;
    console.log("[Live] Connecting to Gemini Live API...");

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          console.log("[Live] WebSocket opened, sending setup...");
          this.sendSetup(systemInstruction);
          // Wait for setupComplete before resolving
          this.setupResolve = () => {
            console.log("[Live] Setup complete, session ready");
            this.callbacks.onEvent({ type: "connected" });
            resolve();
          };
          // Timeout fallback — if no setupComplete in 5s, resolve anyway
          setTimeout(() => {
            if (this.setupResolve) {
              console.log("[Live] No setupComplete received, resolving anyway");
              this.setupResolve();
              this.setupResolve = null;
            }
          }, 5000);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };

        this.ws.onerror = (e) => {
          console.error("[Live] WebSocket error", e);
          this.callbacks.onEvent({
            type: "error",
            data: "WebSocket connection error",
          });
        };

        this.ws.onclose = (event) => {
          console.log("[Live] WebSocket closed", event.code, event.reason);
          const wasIntentional = event.code === 1000;
          this.callbacks.onEvent({
            type: wasIntentional ? "disconnected" : "error",
            data: wasIntentional ? "Session ended" : `Connection lost (${event.code})`,
          });

          if (!wasIntentional && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect(token, systemInstruction);
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  private sendSetup(systemInstruction: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const setupMessage = {
      setup: {
        model: `models/${GEMINI_LIVE_MODEL}`,
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Orus",
              },
            },
          },
        },
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
      },
    };

    console.log("[Live] Setup message model:", setupMessage.setup.model);
    this.ws.send(JSON.stringify(setupMessage));
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const raw = typeof event.data === "string" ? event.data : "{}";
      const data = JSON.parse(raw);

      // Log every message for debugging
      const keys = Object.keys(data);
      console.log("[Live] Received message:", keys.join(", "));

      if (data.error) {
        console.error("[Live] API error:", data.error);
        this.callbacks.onEvent({
          type: "error",
          data: data.error.message ?? "Unknown API error",
        });
        return;
      }

      // Setup complete
      if (data.setupComplete) {
        console.log("[Live] Setup complete received");
        if (this.setupResolve) {
          this.setupResolve();
          this.setupResolve = null;
        }
        return;
      }

      // Audio response from model
      if (data.serverContent?.modelTurn?.parts) {
        console.log("[Live] Model turn received, parts:", data.serverContent.modelTurn.parts.length);
        for (const part of data.serverContent.modelTurn.parts) {
          if (part.inlineData?.data) {
            const pcmBuffer = base64ToArrayBuffer(part.inlineData.data);
            console.log("[Live] Audio chunk:", pcmBuffer.byteLength, "bytes");
            this.callbacks.onEvent({
              type: "audioReceived",
              data: pcmBuffer,
            });
          }
          if (part.text) {
            console.log("[Live] Text part:", part.text.substring(0, 100));
            this.callbacks.onEvent({
              type: "textReceived",
              data: part.text,
            });
          }
        }
      }

      // Input transcription (what the user said)
      if (data.serverContent?.inputTranscription?.text) {
        console.log("[Live] User transcription:", data.serverContent.inputTranscription.text);
        this.callbacks.onEvent({
          type: "inputTranscription",
          data: data.serverContent.inputTranscription.text,
        });
      }

      // Model output transcription
      if (data.serverContent?.transcription?.text) {
        console.log("[Live] Model transcription:", data.serverContent.transcription.text);
        this.callbacks.onEvent({
          type: "textReceived",
          data: data.serverContent.transcription.text,
        });
      }

      // Turn complete
      if (data.serverContent?.turnComplete) {
        console.log("[Live] Turn complete (audio chunks received:", this.audioChunkCount + ")");
        this.callbacks.onEvent({ type: "turnComplete" });
      }

      // Interruption
      if (data.serverContent?.interrupted) {
        console.log("[Live] Interrupted");
        this.callbacks.onEvent({ type: "interrupted" });
      }
    } catch (e) {
      console.warn("[Live] Failed to parse message:", e);
    }
  }

  sendAudio(pcmChunk: ArrayBuffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.audioChunkCount++;
    const message = {
      realtimeInput: {
        mediaChunks: [
          {
            data: arrayBufferToBase64(pcmChunk),
            mimeType: "audio/pcm;rate=16000",
          },
        ],
      },
    };

    this.ws.send(JSON.stringify(message));
  }

  sendText(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const message = {
      clientContent: {
        turns: [
          {
            role: "user",
            parts: [{ text }],
          },
        ],
        turnComplete: true,
      },
    };

    this.ws.send(JSON.stringify(message));
  }

  sendSystemInstruction(systemInstruction: string): void {
    this.sendText(
      `[SYSTEM: Your persona and instructions have changed. New instructions follow. Adopt this new persona immediately.]\n\n${systemInstruction}`
    );
  }

  interrupt(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const message = {
      clientContent: {
        turns: [],
        turnComplete: true,
      },
    };

    this.ws.send(JSON.stringify(message));
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      try {
        this.ws.close(1000, "Client disconnect");
      } catch {
        // ignore
      }
      this.ws = null;
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private scheduleReconnect(token: string, systemInstruction: string): void {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    this.reconnectTimer = setTimeout(() => {
      this.callbacks.onEvent({ type: "disconnected", data: "Reconnecting..." });
      this.connect(token, systemInstruction).catch(() => {
        // Reconnect failed — will retry if under limit
      });
    }, delay);
  }
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
