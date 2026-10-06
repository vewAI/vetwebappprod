import { useState, useRef, useCallback } from "react";
import { saveAttemptProgress } from "../services/attemptService";
import type { Message } from "@/features/chat/models/chat";

/**
 * Custom hook for saving attempt progress
 * 
 * @param attemptId - The ID of the attempt to save
 * @returns An object containing the save function, loading state, and success state
 */
export function useSaveAttempt(attemptId: string | undefined | null) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef<{
    stageIndex: number;
    messages: Message[];
    timeSpentSeconds: number;
  } | null>(null);

  /**
   * Save the current attempt progress
   * 
   * @param stageIndex - The current stage index
   * @param messages - The messages to save
   * @param timeSpentSeconds - The time spent in seconds
   * @returns A promise that resolves to a boolean indicating success
   */
  const saveProgress = useCallback(
    async (
      stageIndex: number,
      messages: Message[],
      timeSpentSeconds: number
    ): Promise<boolean> => {
      // If no attemptId, return early
      if (!attemptId) return false;

      // If already saving, queue the latest progress update instead of dropping it
      if (isSavingRef.current) {
        pendingSaveRef.current = { stageIndex, messages, timeSpentSeconds };
        return true;
      }

      isSavingRef.current = true;
      setIsSaving(true);
      setSaveSuccess(false);

      try {
        const success = await saveAttemptProgress(
          attemptId,
          stageIndex,
          messages,
          timeSpentSeconds
        );

        if (success) {
          setSaveSuccess(true);

          // Reset success status after 3 seconds
          setTimeout(() => {
            setSaveSuccess(false);
          }, 3000);
        }

        return success;
      } catch (error) {
        console.error("Error saving attempt progress:", error);
        return false;
      } finally {
        isSavingRef.current = false;
        setIsSaving(false);

        // If another save was queued while this one was in-flight, flush it immediately
        if (pendingSaveRef.current) {
          const pending = pendingSaveRef.current;
          pendingSaveRef.current = null;
          void saveProgress(pending.stageIndex, pending.messages, pending.timeSpentSeconds);
        }
      }
    },
    [attemptId]
  );

  return {
    saveProgress,
    isSaving,
    saveSuccess,
  };
}
