"use client";

import type React from "react";

import { useState, useRef, useEffect } from "react";
import { SendIcon, PenLine, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSTT } from "@/features/speech/hooks/useSTT";
import { useMicButton } from "@/features/speech/hooks/useMicButton";
import { useTTS } from "@/features/speech/hooks/useTTS";
import { speakRemote } from "@/features/speech/services/ttsService";
import { ChatMessage } from "@/features/chat/components/chat-message";
import { Notepad } from "@/features/chat/components/notepad";
import { FeedbackButton } from "@/features/feedback/components/feedback-button";
import { SaveAttemptButton } from "@/features/attempts/components/save-attempt-button";
import { useSaveAttempt } from "@/features/attempts/hooks/useSaveAttempt";
import type { Message } from "@/features/chat/models/chat";
import type { Stage } from "@/features/stages/types";
import { getStageTransitionMessage } from "@/features/stages/services/stageService";
import { chatService } from "@/features/chat/services/chatService";

type ChatInterfaceProps = {
  caseId: string;
  attemptId?: string;
  initialMessages?: Message[];
  currentStageIndex: number;
  stages: Stage[];
  onProceedToNextStage: (
    messages?: Message[],
    timeSpentSeconds?: number
  ) => void;
};

export function ChatInterface({
  caseId,
  attemptId,
  initialMessages = [],
  currentStageIndex,
  stages,
  onProceedToNextStage,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showNotepad, setShowNotepad] = useState(false);
  const [timeSpentSeconds, setTimeSpentSeconds] = useState(0);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [voiceMode, setVoiceMode] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Speech-to-text functionality. Provide an onFinal handler to auto-send when
  // voiceMode is active.

  // Refs to manage auto-send timer and pending final text
  const autoSendTimerRef = useRef<number | null>(null);
  const autoSendPendingTextRef = useRef<string | null>(null);

  const { isListening, transcript, interimTranscript, start, stop, reset } =
    useSTT((finalText: string) => {
      console.debug(
        "STT onFinal fired, voiceMode=",
        voiceMode,
        "finalText=",
        finalText
      );
      if (voiceMode && finalText && finalText.trim()) {
        const trimmed = finalText.trim();
        // Clear any pending timer and pending buffer
        if (autoSendTimerRef.current) {
          window.clearTimeout(autoSendTimerRef.current);
          autoSendTimerRef.current = null;
        }
        autoSendPendingTextRef.current = null;

        // Immediately send the final transcript when voiceMode is active.
        // This emulates pressing the send button as soon as speech is
        // transcribed to a final chunk.
        try {
          console.debug("Auto-send (immediate) firing with text:", trimmed);
          // Trigger auto-send with visual flash on the send button
          void triggerAutoSend(trimmed);
        } catch (e) {
          console.error("Failed to auto-send final transcript:", e);
        }
      }
    });

  // clear timers on unmount
  useEffect(() => {
    return () => {
      if (autoSendTimerRef.current) {
        window.clearTimeout(autoSendTimerRef.current);
        autoSendTimerRef.current = null;
      }
      autoSendPendingTextRef.current = null;
    };
  }, []);

  // Text-to-speech
  const {
    available: ttsAvailable,
    isSpeaking,
    speak,
    speakAsync,
    cancel,
  } = useTTS();

  // When TTS plays we may want to temporarily stop STT so the assistant voice
  // is not transcribed. Use a ref to remember whether we should resume.
  const resumeListeningRef = useRef<boolean>(false);

  // Microphone button handlers
  const { handleStart, handleStop, handleCancel } = useMicButton(
    textareaRef,
    isListening,
    start,
    stop,
    reset,
    setInput
  );

  // Helper: stop listening and (when voiceMode is active) send the current
  // transcript automatically. Uses a short delay to allow STT final event to
  // flush into `transcript` state when necessary.
  const stopAndMaybeSend = () => {
    try {
      stop();
    } catch (e) {
      // ignore
    }
    // Give STT a short moment to emit final transcript
    setTimeout(() => {
      try {
        const t = transcript?.trim();
        if (voiceMode && t) {
          // Use the trigger wrapper so the send button flashes when auto-sent
          void triggerAutoSend(t);
        }
      } catch (e) {
        console.error("Error auto-sending after stop:", e);
      }
    }, 150);
  };

  // sendUserMessage helper (used by manual submit and auto-send)
  const sendUserMessage = async (text: string) => {
    const trimmed = String(text ?? "").trim();
    if (!trimmed || isLoading) return;

    const userMessage = chatService.createUserMessage(
      trimmed,
      currentStageIndex
    );
    const snapshot = [...messages, userMessage];
    setMessages(snapshot);
    setInput("");
    setIsLoading(true);

    try {
      const response = await chatService.sendMessage(
        snapshot,
        currentStageIndex,
        caseId
      );
      const roleName = response.displayRole ?? stages[currentStageIndex].role;
      const aiMessage = chatService.createAssistantMessage(
        response.content,
        currentStageIndex,
        roleName
      );
      setMessages((prev) => [...prev, aiMessage]);

      // Speak the assistant response when TTS is enabled. Prefer server TTS
      if (ttsEnabled && response.content) {
        try {
          // If we're currently listening, stop to avoid transcribing the
          // assistant's spoken reply. Remember to resume afterwards only if
          // voiceMode is active.
          if (isListening) {
            resumeListeningRef.current = true;
            stop();
          }

          // Prefer server TTS and await playback completion
          try {
            await speakRemote(response.content);
          } catch (err) {
            // Fallback to browser TTS and await completion when available
            try {
              if (ttsAvailable && speakAsync) {
                await speakAsync(response.content);
              } else if (ttsAvailable) {
                // speak() is fire-and-forget; call it but we won't await
                speak(response.content);
              }
            } catch (e) {
              console.error("TTS failed:", e);
            }
          }

          // After TTS completes, resume listening if we previously stopped and
          // voiceMode is still active.
          if (resumeListeningRef.current) {
            resumeListeningRef.current = false;
            if (voiceMode) {
              // small delay to ensure audio resources are released
              setTimeout(() => start(), 50);
            }
          }
        } catch (e) {
          console.error("Error during TTS handling:", e);
        }
      }
    } catch (error) {
      console.error("Error getting chat response (auto-send):", error);
      const errorMessage = chatService.createErrorMessage(
        error,
        currentStageIndex
      );
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      // Reset interim transcripts after a send
      reset();
    }
  };

  // Trigger an auto-send that also flashes the Send button briefly so the
  // user sees that the message was submitted automatically.
  const [autoSendFlash, setAutoSendFlash] = useState(false);
  const triggerAutoSend = async (text: string) => {
    try {
      // flash briefly
      setAutoSendFlash(true);
      window.setTimeout(() => setAutoSendFlash(false), 600);
    } catch (e) {
      // ignore
    }
    return sendUserMessage(text);
  };

  // Toggle voice mode (persistent listening until toggled off)
  const toggleVoiceMode = () => {
    setVoiceMode((v) => {
      const next = !v;
      if (next) {
        // enable voice mode -> start listening
        reset();
        setInput("");
        start();
      } else {
        // disable voice mode -> stop listening and auto-send transcript
        stopAndMaybeSend();
      }
      return next;
    });
  };

  // Update input when transcript changes
  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-focus textarea when loaded
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  // Timer to track time spent on the case
  useEffect(() => {
    // Only start the timer if we have an attempt ID
    if (!attemptId) return;

    // Set up a timer that increments every second
    const timer = setInterval(() => {
      setTimeSpentSeconds((prev) => prev + 1);
    }, 1000);

    // Clean up the timer when the component unmounts
    return () => clearInterval(timer);
  }, [attemptId]);

  // Auto-save (throttled) — keeps the existing delete+insert server behavior
  const { saveProgress } = useSaveAttempt(attemptId);
  const lastSavedAtRef = useRef<number>(0);
  const lastSavedSnapshotRef = useRef<string>("");

  useEffect(() => {
    if (!attemptId) return;

    const intervalMs = 30_000; // auto-save every 30s
    const throttleMs = 15_000; // don't save more often than every 15s

    let mounted = true;

    const doAutoSave = async () => {
      // Snapshot messages to detect changes
      const snapshot = JSON.stringify(messages);

      // Nothing changed since last save
      if (snapshot === lastSavedSnapshotRef.current) return;

      const now = Date.now();
      if (now - lastSavedAtRef.current < throttleMs) return;

      // Avoid saving empty conversations
      if (!messages || messages.length === 0) return;

      lastSavedAtRef.current = now;
      try {
        const success = await saveProgress(
          currentStageIndex,
          messages,
          timeSpentSeconds
        );
        if (success) {
          lastSavedSnapshotRef.current = snapshot;
        }
      } catch (err) {
        console.error("Auto-save failed:", err);
      }
    };

    // Periodic interval
    const timer = setInterval(() => {
      if (!mounted) return;
      void doAutoSave();
    }, intervalMs);

    // Save when the page is hidden / unloaded so we don't lose recent changes
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        void doAutoSave();
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Attempt a final save (best-effort)
      void doAutoSave();
      // Let the unload proceed; do not block
      delete e.returnValue;
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("beforeunload", handleBeforeUnload);

    // Run an immediate save shortly after mount to capture any resumed state
    void doAutoSave();

    return () => {
      mounted = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [attemptId, messages, currentStageIndex, timeSpentSeconds, saveProgress]);

  // Handle stage transitions
  useEffect(() => {
    if (currentStageIndex > 0) {
      // Get the custom transition message for this case and stage
      const transitionMessage = getStageTransitionMessage(
        caseId,
        currentStageIndex
      );

      // Add the transition message to the chat with a unique ID
      const displayMessage = {
        ...transitionMessage,
        id: `${transitionMessage.id}-${Date.now()}`,
        displayRole: "Virtual Examiner",
      };

      setMessages((prev) => [...prev, displayMessage]);
    }
  }, [currentStageIndex, caseId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Delegate to shared sendUserMessage helper
    await sendUserMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const isLastStage = currentStageIndex === stages.length - 1;
  const nextStageTitle = isLastStage
    ? "Complete Examination"
    : `Proceed to ${stages[currentStageIndex + 1]?.title || "Next Stage"}`;

  return (
    <div className="relative flex h-full flex-col">
      {/* Chat messages area */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} stages={stages} />
          ))}
          {isLoading && (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <div className="animate-pulse">Thinking...</div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Proceed to Next Stage button */}
      <div className="border-t bg-background p-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex justify-between items-center mb-4 gap-4">
            <Button
              onClick={() => onProceedToNextStage(messages, timeSpentSeconds)}
              disabled={false}
              className={`flex-1 ${
                isLastStage
                  ? "bg-gradient-to-l from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600"
                  : "bg-gradient-to-l from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
              } 
                text-white border-none transition-all duration-300`}
              variant="outline"
            >
              {nextStageTitle}
            </Button>

            <div className="flex gap-2 items-center">
              {/* Big voice-mode toggle */}
              <Button
                type="button"
                size="sm"
                variant={voiceMode ? "destructive" : "secondary"}
                className="flex items-center gap-2 px-4"
                onClick={toggleVoiceMode}
                title={
                  voiceMode
                    ? "Disable voice mode"
                    : "Enable voice mode (toggle)"
                }
              >
                <Mic className="h-4 w-4" />
                {voiceMode ? "Voice Mode: On" : "Voice Mode: Off"}
              </Button>

              {attemptId && (
                <SaveAttemptButton
                  attemptId={attemptId}
                  stageIndex={currentStageIndex}
                  messages={messages}
                  timeSpentSeconds={timeSpentSeconds}
                />
              )}

              {/* TTS toggle */}
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center gap-1 text-xs"
                onClick={() => {
                  // When disabling, cancel any in-progress speech
                  setTtsEnabled((v) => {
                    const next = !v;
                    if (!next) cancel();
                    return next;
                  });
                }}
                title={ttsEnabled ? "Disable speech" : "Enable speech"}
              >
                {ttsEnabled ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <VolumeX className="h-4 w-4" />
                )}
              </Button>

              <FeedbackButton
                messages={messages}
                stage={stages[currentStageIndex]}
                stageIndex={currentStageIndex}
                caseId={caseId}
                attemptId={attemptId || ""}
              />
            </div>
          </div>

          {/* ...existing UI above the input area... */}

          {/* Input area */}
          <form onSubmit={handleSubmit} className="relative">
            <Textarea
              id="chat-input"
              name="chat-message"
              autoComplete="off"
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isListening
                  ? `${interimTranscript || "Listening..."}`
                  : "Type or record your message..."
              }
              className="min-h-[60px] w-full resize-none pr-24"
              rows={1}
            />
            {/* Mic button */}
            <Button
              type="button"
              size="icon"
              onClick={() => {
                // When voiceMode is enabled the big toggle controls listening and
                // the mic button should be passive (no click toggle required).
                if (voiceMode) return;
              }}
              onMouseDown={!voiceMode ? handleStart : undefined}
              onMouseUp={!voiceMode ? handleStop : undefined}
              onMouseLeave={!voiceMode ? handleCancel : undefined}
              // Touch support for mobile devices when not in toggle mode
              onTouchStart={!voiceMode ? handleStart : undefined}
              onTouchEnd={!voiceMode ? handleStop : undefined}
              className={`absolute bottom-2 right-12 ${
                isListening
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-blue-400 hover:bg-blue-500 text-white"
              }`}
              title={
                voiceMode
                  ? isListening
                    ? "Stop listening"
                    : "Start listening"
                  : "Hold to record, release to send"
              }
            >
              {isListening ? (
                <MicOff className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </Button>
            {/* Send button */}
            <Button
              type="submit"
              id="send-button"
              size="icon"
              disabled={isLoading || !input.trim()}
              className={`absolute bottom-2 right-2 ${
                input.trim()
                  ? "bg-gradient-to-l from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 border-none"
                  : ""
              } ${
                autoSendFlash
                  ? "animate-pulse ring-2 ring-offset-1 ring-blue-300"
                  : ""
              }`}
            >
              <SendIcon className="h-5 w-5" />
            </Button>
          </form>

          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-1 text-xs"
              onClick={() => setShowNotepad(!showNotepad)}
            >
              <PenLine className="h-3.5 w-3.5" />
              {showNotepad ? "Hide Notepad" : "Show Notepad"}
            </Button>
            <span>Press Enter to send, Shift+Enter for new line</span>
          </div>
        </div>
      </div>

      {/* Notepad */}
      <Notepad isOpen={showNotepad} onClose={() => setShowNotepad(false)} />
    </div>
  );
}
