import { useState } from "react";
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
  
  /**
   * Save the current attempt progress
   * 
   * @param stageIndex - The current stage index
   * @param messages - The messages to save
   * @param timeSpentSeconds - The time spent in seconds
   * @returns A promise that resolves to a boolean indicating success
   */
  const saveProgress = async (
    stageIndex: number,
    messages: Message[],
    timeSpentSeconds: number
  ): Promise<boolean> => {
    // If no attemptId or already saving, return early
    if (!attemptId || isSaving) return false;
    
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
      setIsSaving(false);
    }
  };
  
  return {
    saveProgress,
    isSaving,
    saveSuccess
  };
}
