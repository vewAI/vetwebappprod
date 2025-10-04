import axios from "axios";
import type { Message } from "@/features/chat/models/chat";

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
    caseId: string
  ): Promise<{ content: string }> => {
    try {
      // Format messages for the API
      const apiMessages = messages.map((msg) => ({
        role: msg.role as "system" | "user" | "assistant",
        content: msg.content,
      }));

      // Call the API using axios
      const response = await axios.post("/api/chat", {
        messages: apiMessages,
        stageIndex,
        caseId,
      });

      return response.data as { content: string };
    } catch (error) {
      console.error("Error getting chat response:", error);
      throw error;
    }
  },

  /**
   * Create a user message object
   * @param content Message content
   * @param stageIndex Current stage index
   * @returns User message object
   */
  createUserMessage: (content: string, stageIndex: number): Message => ({
    id: Date.now().toString(),
    role: "user",
    content,
    timestamp: new Date().toISOString(),
    stageIndex,
    displayRole: "You",
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
    roleName: string
  ): Message => ({
    id: (Date.now() + 1).toString(),
    role: "assistant",
    content,
    timestamp: new Date().toISOString(),
    stageIndex,
    displayRole: roleName,
  }),

  /**
   * Create a system message object
   * @param content Message content
   * @param stageIndex Current stage index
   * @returns System message object
   */
  createSystemMessage: (content: string, stageIndex: number): Message => ({
    id: `system-${Date.now()}`,
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
    id: `error-${Date.now()}`,
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
