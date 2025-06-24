import { RefObject } from "react";

type TextareaRef = RefObject<HTMLTextAreaElement | null>;

/**
 * Custom hook for handling microphone button interactions
 * Provides unified handlers for both mouse and touch events
 */
export function useMicButton(
  textareaRef: TextareaRef,
  isListening: boolean,
  start: () => void,
  stop: () => void,
  reset: () => void,
  setInput: (value: string) => void
) {
  /**
   * Handle start recording (mouse down or touch start)
   */
  const handleStart = () => {
    reset();
    setInput("");
    start();
  };
  
  /**
   * Handle stop recording (mouse up or touch end)
   */
  const handleStop = () => {
    if (isListening) {
      stop();
      // Focus the textarea after a short delay to allow transcript to update
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 100);
    }
  };
  
  /**
   * Handle cancel recording (mouse leave)
   */
  const handleCancel = () => {
    if (isListening) {
      stop();
    }
  };
  
  return {
    handleStart,
    handleStop,
    handleCancel
  };
}
