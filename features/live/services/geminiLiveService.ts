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

  constructor(callbacks: LiveServiceCallbacks) {
    this.callbacks = callbacks;
  }

  async connect(token: string, systemInstruction: string): Promise<void> {
    this.disconnect();

    const url = `${GEMINI_WS_BASE}?key=${encodeURIComponent(token)}`;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.sendSetup(systemInstruction);
          this.callbacks.onEvent({ type: "connected" });
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };

        this.ws.onerror = () => {
          this.callbacks.onEvent({
            type: "error",
            data: "WebSocket connection error",
          });
        };

        this.ws.onclose = (event) => {
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

    this.ws.send(JSON.stringify(setupMessage));
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(typeof event.data === "string" ? event.data : "{}");

      if (data.error) {
        this.callbacks.onEvent({
          type: "error",
          data: data.error.message ?? "Unknown API error",
        });
        return;
      }

      // Audio response from model
      if (data.serverContent?.modelTurn?.parts) {
        for (const part of data.serverContent.modelTurn.parts) {
          if (part.inlineData?.data) {
            const pcmBuffer = base64ToArrayBuffer(part.inlineData.data);
            this.callbacks.onEvent({
              type: "audioReceived",
              data: pcmBuffer,
            });
          }
          if (part.text) {
            this.callbacks.onEvent({
              type: "textReceived",
              data: part.text,
            });
          }
        }
      }

      // Input transcription (what the user said)
      if (data.serverContent?.inputTranscription?.text) {
        this.callbacks.onEvent({
          type: "inputTranscription",
          data: data.serverContent.inputTranscription.text,
        });
      }

      // Model output transcription
      if (data.serverContent?.transcription?.text) {
        this.callbacks.onEvent({
          type: "textReceived",
          data: data.serverContent.transcription.text,
        });
      }

      // Turn complete
      if (data.serverContent?.turnComplete) {
        this.callbacks.onEvent({ type: "turnComplete" });
      }

      // Interruption
      if (data.serverContent?.interrupted) {
        this.callbacks.onEvent({ type: "interrupted" });
      }
    } catch {
      // Non-JSON or unexpected format — ignore
    }
  }

  sendAudio(pcmChunk: ArrayBuffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

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
    // Gemini Live doesn't support mid-session system instruction changes via setup.
    // Instead, send as a client_content turn with context.
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
