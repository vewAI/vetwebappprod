import type { LiveEvent } from "../types";

export type LiveServiceCallbacks = {
  onEvent: (event: LiveEvent) => void;
};

export class GeminiLiveService {
  private session: any = null;
  private callbacks: LiveServiceCallbacks;

  constructor(callbacks: LiveServiceCallbacks) {
    this.callbacks = callbacks;
  }

  async connect(token: string, systemInstruction: string): Promise<void> {
    this.disconnect();

    console.log("[Live] Connecting via @google/genai SDK...");

    try {
      const { GoogleGenAI, Modality } = await import("@google/genai");

      const ai = new GoogleGenAI({ apiKey: token });

      this.session = await ai.live.connect({
        model: "gemini-live-2.5-flash-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Orus",
              },
            },
          },
          systemInstruction: systemInstruction,
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            console.log("[Live] Session opened");
            this.callbacks.onEvent({ type: "connected" });
          },
          onmessage: (message: any) => {
            this.handleMessage(message);
          },
          onerror: (e: any) => {
            console.error("[Live] Session error:", e);
            this.callbacks.onEvent({
              type: "error",
              data: e?.message ?? "Session error",
            });
          },
          onclose: (e: any) => {
            console.log("[Live] Session closed:", e?.reason);
            this.callbacks.onEvent({
              type: "disconnected",
              data: e?.reason ?? "Session ended",
            });
            this.session = null;
          },
        },
      });

      console.log("[Live] Connected successfully");
    } catch (err) {
      console.error("[Live] Connect failed:", err);
      this.callbacks.onEvent({
        type: "error",
        data: err instanceof Error ? err.message : "Connection failed",
      });
      throw err;
    }
  }

  private handleMessage(message: any): void {
    const content = message.serverContent;

    // Audio response from model
    if (content?.modelTurn?.parts) {
      for (const part of content.modelTurn.parts) {
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
    if (content?.inputTranscription?.text) {
      this.callbacks.onEvent({
        type: "inputTranscription",
        data: content.inputTranscription.text,
      });
    }

    // Output transcription (what the model said)
    if (content?.outputTranscription?.text) {
      this.callbacks.onEvent({
        type: "textReceived",
        data: content.outputTranscription.text,
      });
    }

    // Turn complete
    if (content?.turnComplete) {
      this.callbacks.onEvent({ type: "turnComplete" });
    }

    // Interruption
    if (content?.interrupted) {
      this.callbacks.onEvent({ type: "interrupted" });
    }
  }

  sendAudio(pcmChunk: ArrayBuffer): void {
    if (!this.session) return;

    this.session.sendRealtimeInput({
      audio: {
        data: arrayBufferToBase64(pcmChunk),
        mimeType: "audio/pcm;rate=16000",
      },
    });
  }

  sendText(text: string): void {
    if (!this.session) return;

    this.session.sendClientContent({
      turns: text,
      turnComplete: true,
    });
  }

  sendSystemInstruction(systemInstruction: string): void {
    this.sendText(
      `[SYSTEM: Your persona and instructions have changed. New instructions follow. Adopt this new persona immediately.]\n\n${systemInstruction}`
    );
  }

  interrupt(): void {
    if (!this.session) return;

    this.session.sendClientContent({
      turnComplete: true,
    });
  }

  disconnect(): void {
    if (this.session) {
      try {
        this.session.close();
      } catch {
        // ignore
      }
      this.session = null;
    }
  }

  get isConnected(): boolean {
    return this.session !== null;
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
