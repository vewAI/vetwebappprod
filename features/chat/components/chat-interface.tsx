"use client";

import type React from "react";

import { useState, useRef, useEffect } from "react";
import { SendIcon, PenLine, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSTT } from "@/features/speech/hooks/useSTT";
import { useMicButton } from "@/features/speech/hooks/useMicButton";
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Speech-to-text functionality
  const { isListening, transcript, interimTranscript, start, stop, reset } =
    useSTT();

  // Microphone button handlers
  const { handleStart, handleStop, handleCancel } = useMicButton(
    textareaRef,
    isListening,
    start,
    stop,
    reset,
    setInput
  );

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
    if (!input.trim() || isLoading) return;

    // Create user message using the chatService
    const userMessage = chatService.createUserMessage(input, currentStageIndex);

    // Add user message to the chat
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Send message to API using chatService
      const response = await chatService.sendMessage(
        messages.concat(userMessage),
        currentStageIndex,
        caseId
      );

      // Create and add AI response to messages. Use per-case displayRole when provided
      // by the server (derived from owner_background) otherwise fall back to the
      // static stage role.
      const roleName = response.displayRole ?? stages[currentStageIndex].role;
      const aiMessage = chatService.createAssistantMessage(
        response.content,
        currentStageIndex,
        roleName
      );

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("Error getting chat response:", error);

      // Create and add error message using the chatService
      const errorMessage = chatService.createErrorMessage(
        error,
        currentStageIndex
      );
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
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

            <div className="flex gap-2">
              {attemptId && (
                <SaveAttemptButton
                  attemptId={attemptId}
                  stageIndex={currentStageIndex}
                  messages={messages}
                  timeSpentSeconds={timeSpentSeconds}
                />
              )}

              <FeedbackButton
                messages={messages}
                stage={stages[currentStageIndex]}
                stageIndex={currentStageIndex}
                caseId={caseId}
                attemptId={attemptId || ""}
              />
            </div>
          </div>

          {/* Input area */}
          <form onSubmit={handleSubmit} className="relative">
            <Textarea
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
              onMouseDown={handleStart}
              onMouseUp={handleStop}
              onMouseLeave={handleCancel}
              // Touch support for mobile devices
              onTouchStart={handleStart}
              onTouchEnd={handleStop}
              className={`absolute bottom-2 right-12 ${
                isListening
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-blue-400 hover:bg-blue-500 text-white"
              }`}
              title="Hold to record, release to send"
            >
              <Mic className="h-5 w-5" />
            </Button>
            {/* Send button */}
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !input.trim()}
              className={`absolute bottom-2 right-2 ${
                input.trim()
                  ? "bg-gradient-to-l from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 border-none"
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
