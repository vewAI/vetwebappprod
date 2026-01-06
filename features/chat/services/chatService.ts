import axios from "axios";
import type { Message } from "@/features/chat/models/chat";
import type { CaseMediaItem } from "@/features/cases/models/caseMedia";
import { buildAuthHeaders, getAccessToken } from "@/lib/auth-headers";
import { debugEventBus } from "@/lib/debug-events-fixed";

/**
 * Service for handling chat API communication
 */
export const chatService = {
  /**
   * Send a message to the chat API and get the response
   * @param messages Array of messages to send to the API
   * @param stageIndex Current stage index
   * @param caseId ID of the current case
   * @returns The AI response content
   */
  sendMessage: async (
    messages: Message[],
    stageIndex: number,
    caseId: string,
    options?: { attemptId?: string }
  ): Promise<{
    content: string;
    displayRole?: string;
    portraitUrl?: string;
    voiceId?: string;
    personaSex?: string;
    personaRoleKey?: string;
    media?: CaseMediaItem[];
  }> => {
    const startTime = Date.now();
    try {
      debugEventBus.emitEvent('info', 'ChatService', 'Sending message to API', { 
        messageCount: messages.length, 
        stageIndex, 
        caseId 
      });

      // Format messages for the API
      const apiMessages = messages.map((msg) => ({
        role: msg.role as "system" | "user" | "assistant",
        content: msg.content,
      }));
      // If the browser is offline, throw immediately to avoid noisy network
      // errors from the XHR layer.
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw new Error("Network unavailable - please check your connection.");
      }

      const token = await getAccessToken();
      if (!token) {
        throw new Error("Not authenticated");
      }
      const authHeaders = await buildAuthHeaders({}, token);

      // Call the API using axios with a small retry loop for transient
      // network errors (no response). This reduces noisy "Network Error"
      // console traces when the dev server briefly hiccups.
      const maxAttempts = 3;
      let attempt = 0;
      let lastErr: unknown = null;
      while (attempt < maxAttempts) {
        try {
          const payload = {
            messages: apiMessages,
            stageIndex,
            caseId,
            ...(options?.attemptId ? { attemptId: options.attemptId } : {}),
          };
          const response = await axios.post("/api/chat", payload, {
            headers: authHeaders,
          });
          debugEventBus.emitEvent('success', 'ChatService', `Response received in ${Date.now() - startTime}ms`);
          return response.data as {
            content: string;
            displayRole?: string;
            portraitUrl?: string;
            voiceId?: string;
            personaSex?: string;
            personaRoleKey?: string;
            media?: CaseMediaItem[];
          };
        } catch (err) {
          lastErr = err;
          // If the error looks like an HTTP response from the server,
          // rethrow (don't retry) so callers get the server status/message.
          const aerr = err as any;
          if (aerr && aerr.response) {
            throw err;
          }

          // Otherwise it's likely a network/transient error. Backoff then retry.
          attempt += 1;
          const backoffMs = 200 * attempt; // 200ms, 400ms, ...
          await new Promise((res) => setTimeout(res, backoffMs));
        }
      }

      // If we exhausted retries, throw a normalized error so callers don't
      // receive an AxiosError object with noisy stack traces in console.
      const msg =
        lastErr && (lastErr as any)?.message
          ? String((lastErr as any).message)
          : "Network Error";
      throw new Error(msg);
    } catch (error) {
      debugEventBus.emitEvent('error', 'ChatService', 'Failed to send message', { 
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      });
      console.error("Error getting chat response:", error);
      // Normalize to Error for callers
      if (error instanceof Error) throw error;
      throw new Error(String(error));
    }
  },
  /**
   * Check whether a user fragment is likely complete or needs continuation.
   * Uses server-side classification at /api/chat/check-complete.
   */
  checkCompleteness: async (
    fragment: string,
    caseId?: string,
    stageIndex?: number
  ): Promise<{ complete: boolean; canonical?: string | null; type?: string | null }> => {
    try {
      const token = await getAccessToken();
      const authHeaders = await buildAuthHeaders({}, token || undefined);
      const resp = await axios.post(
        "/api/chat/check-complete",
        { fragment, caseId, stageIndex },
        { headers: authHeaders }
      );
      return resp.data as { complete: boolean; canonical?: string | null; type?: string | null };
    } catch (e) {
      // On errors, default to complete to avoid blocking user input
      console.warn("checkCompleteness failed, defaulting to complete", e);
      return { complete: true };
    }
  },

  /**
   * Create a user message object
   * @param content Message content
   * @param stageIndex Current stage index
   * @returns User message object
   */
  createUserMessage: (content: string, stageIndex: number): Message => ({
    // Use crypto.randomUUID when available to avoid server/client hydration differences
    id:
      typeof crypto !== "undefined" && (crypto as any).randomUUID
        ? (crypto as any).randomUUID()
        : Date.now().toString(),
    role: "user",
    content,
    timestamp: new Date().toISOString(),
    stageIndex,
    displayRole: "You",
    portraitUrl: undefined,
    status: "pending",
  }),

  /**
   * Create an AI assistant message object
   * @param content Message content
   * @param stageIndex Current stage index
   * @param roleName Display role name for the message
   * @returns Assistant message object
   */
  createAssistantMessage: (
    content: string,
    stageIndex: number,
    roleName: string,
    portraitUrl?: string,
    voiceId?: string,
    personaSex?: string,
    personaRoleKey?: string,
    media?: CaseMediaItem[]
  ): Message => ({
    id:
      typeof crypto !== "undefined" && (crypto as any).randomUUID
        ? `${(crypto as any).randomUUID()}`
        : (Date.now() + 1).toString(),
    role: "assistant",
    content,
    timestamp: new Date().toISOString(),
    stageIndex,
    displayRole: roleName,
    portraitUrl,
    voiceId,
    personaSex,
    personaRoleKey,
    media,
  }),

  /**
   * Create a system message object
   * @param content Message content
   * @param stageIndex Current stage index
   * @returns System message object
   */
  createSystemMessage: (content: string, stageIndex: number): Message => ({
    id:
      typeof crypto !== "undefined" && (crypto as any).randomUUID
        ? `system-${(crypto as any).randomUUID()}`
        : `system-${Date.now()}`,
    role: "system",
    content,
    timestamp: new Date().toISOString(),
    stageIndex,
    displayRole: "Virtual Examiner",
  }),

  /**
   * Create an error message object
   * @param error Error message or object
   * @param stageIndex Current stage index
   * @returns Error message object
   */
  createErrorMessage: (error: unknown, stageIndex: number): Message => ({
    id:
      typeof crypto !== "undefined" && (crypto as any).randomUUID
        ? `error-${(crypto as any).randomUUID()}`
        : `error-${Date.now()}`,
    role: "system",
    content:
      typeof error === "string"
        ? error
        : "Sorry, there was an error processing your request. Please try again.",
    timestamp: new Date().toISOString(),
    stageIndex,
    displayRole: "Virtual Examiner",
  }),
};
