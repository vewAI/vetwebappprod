"use client";

import type React from "react";

import { useState, useRef, useEffect } from "react";
import { SendIcon, PenLine, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSTT } from "@/features/speech/hooks/useSTT";
import { useMicButton } from "@/features/speech/hooks/useMicButton";
import { useTTS } from "@/features/speech/hooks/useTTS";
import {
  speakRemote,
  speakRemoteStream,
} from "@/features/speech/services/ttsService";
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
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(
    () => Boolean(attemptId) || true
  );
  // When true, the assistant will speak first and the message text will only
  // appear after the voice playback completes. This helps focus attention on
  // the audio but may cause users to read ahead — make it optional.
  const [voiceFirst, setVoiceFirst] = useState<boolean>(
    () => Boolean(attemptId) || true
  );
  // Voice Mode (mic) should default ON when an attempt is open; otherwise off.
  const [voiceMode, setVoiceMode] = useState<boolean>(() => Boolean(attemptId));

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
  const sendUserMessage = async (text: string, existingMessageId?: string) => {
    const trimmed = String(text ?? "").trim();
    if (!trimmed || isLoading) return;

    let userMessage = null as Message | null;
    let snapshot: Message[] = [];

    if (existingMessageId) {
      // Mark existing message as pending and reuse it
      snapshot = messages.map((m) =>
        m.id === existingMessageId ? { ...m, status: "pending" } : m
      );
      setMessages(snapshot);
      userMessage = snapshot.find((m) => m.id === existingMessageId) ?? null;
    } else {
      userMessage = chatService.createUserMessage(trimmed, currentStageIndex);
      snapshot = [...messages, userMessage];
      setMessages(snapshot);
    }
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

      // Speak the assistant response when TTS is enabled. We support a
      // "voice-first" mode where the spoken audio plays first and the
      // message text is appended after playback completes.
      if (ttsEnabled && response.content) {
        try {
          if (isListening) {
            resumeListeningRef.current = true;
            stop();
          }

          // If voice-first is enabled, attempt streaming playback and only
          // append the assistant text after playback completes. If streaming
          // fails we fall back to showing the text immediately and then
          // trying other TTS fallbacks.
          if (voiceFirst) {
            try {
              await speakRemoteStream(response.content);
              // Append the message only after playback completed
              setMessages((prev) => [...prev, aiMessage]);
            } catch (streamErr) {
              console.warn(
                "Streaming TTS failed, falling back to text-first:",
                streamErr
              );
              // Show text immediately and try non-streamed/fallback TTS
              setMessages((prev) => [...prev, aiMessage]);
              try {
                await speakRemote(response.content);
              } catch (err) {
                try {
                  if (ttsAvailable && speakAsync) {
                    await speakAsync(response.content);
                  } else if (ttsAvailable) {
                    speak(response.content);
                  }
                } catch (e) {
                  console.error("TTS failed:", e);
                }
              }
            }
          } else {
            // Default behavior: show the text immediately, then play audio
            setMessages((prev) => [...prev, aiMessage]);
            try {
              // Prefer streaming variant for faster start when available
              await speakRemoteStream(response.content).catch(() =>
                speakRemote(response.content)
              );
            } catch (err) {
              // Last-resort fallback to browser TTS
              try {
                if (ttsAvailable && speakAsync) {
                  await speakAsync(response.content);
                } else if (ttsAvailable) {
                  speak(response.content);
                }
              } catch (e) {
                console.error("TTS failed:", e);
              }
            }
          }

          // After TTS completes, resume listening if we previously stopped and
          // voiceMode is still active.
          if (resumeListeningRef.current) {
            resumeListeningRef.current = false;
            if (voiceMode) {
              setTimeout(() => start(), 50);
            }
          }
          // Mark the user message as sent (clear pending)
          if (userMessage) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === userMessage!.id ? { ...m, status: "sent" } : m
              )
            );
          }
        } catch (e) {
          console.error("Error during TTS handling:", e);
          // If anything falls through, ensure message is visible
          setMessages((prev) => [...prev, aiMessage]);
        }
      } else {
        // TTS disabled — just show the message
        setMessages((prev) => [...prev, aiMessage]);
        // Mark user message as sent
        if (userMessage) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === userMessage!.id ? { ...m, status: "sent" } : m
            )
          );
        }
      }
    } catch (error) {
      console.error("Error getting chat response (auto-send):", error);
      // Mark the user message as failed so the UI can offer retry
      if (userMessage) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === userMessage!.id ? { ...m, status: "failed" } : m
          )
        );
      }
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

  const retryUserMessage = async (messageId: string) => {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;
    await sendUserMessage(msg.content, messageId);
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
        // Also disable TTS so the related UI toggles off automatically.
        stopAndMaybeSend();
        try {
          // Cancel any playing speech and turn off TTS toggle
          cancel();
        } catch (e) {
          // ignore
        }
        setTtsEnabled(false);
      }
      return next;
    });
  };

  // Update input when transcript changes
  // Update input when interim or final transcripts arrive. When listening,
  // show the live interim transcript in the textarea so users see dictation
  // as it happens. When interim is empty, show the last final transcript.
  useEffect(() => {
    if (isListening) {
      if (interimTranscript && interimTranscript.trim()) {
        setInput(interimTranscript);
        return;
      }
      if (transcript && transcript.trim()) {
        setInput(transcript);
      }
    }
  }, [interimTranscript, transcript, isListening]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Intro toast: central, non-blocking pop-up shown when an attempt opens.
  const introShownRef = useRef(false);
  const [introMounted, setIntroMounted] = useState(false);
  const [showIntroToast, setShowIntroToast] = useState(false);
  useEffect(() => {
    if (!attemptId) return;
    if (introShownRef.current) return;
    introShownRef.current = true;
    setIntroMounted(true);
    setShowIntroToast(true);
    // Hide after 7s (fade handled by CSS transition)
    const t1 = window.setTimeout(() => setShowIntroToast(false), 7000);
    // Remove from DOM after fade (0.8s)
    const t2 = window.setTimeout(() => setIntroMounted(false), 7800);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [attemptId]);

  // Auto-focus textarea when loaded
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  // Ensure Voice Mode becomes active when an attempt opens (attemptId
  // appears). If the attempt opens after mount, enable voiceMode and start
  // listening. Use a ref to avoid repeated starts.
  const startedListeningRef = useRef(false);
  const prevAttemptIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!attemptId) return;

    // Only initialize voice mode once per attemptId. Some hooks (start/reset)
    // may change identity during runtime which could re-run this effect and
    // inadvertently re-enable voice mode after the user explicitly toggled
    // it off. Use prevAttemptIdRef to ensure we only run this initialization
    // when the attemptId actually changes.
    if (prevAttemptIdRef.current === attemptId) return;
    prevAttemptIdRef.current = attemptId;

    // Ensure voiceMode state is ON when an attempt opens
    setVoiceMode(true);

    // Start listening once when an attempt opens. Don't gate on the
    // `voiceMode` state variable (it may not have updated yet in this
    // render), instead use the startedListeningRef to ensure we only start
    // once.
    if (!startedListeningRef.current) {
      try {
        reset();
        setInput("");
        start();
        startedListeningRef.current = true;
      } catch (e) {
        console.error("Failed to start STT after attempt opened:", e);
      }
    }
    // Run only when attemptId changes; intentionally omit start/reset from
    // the dependency list to avoid re-running due to identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

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
      {/* Intro toast (central, non-blocking) */}
      {introMounted && (
        <div className="fixed inset-0 flex items-start justify-center pt-24 pointer-events-none z-50">
          <div
            // Allow clicks inside the card so the user can dismiss it early.
            className={`max-w-xl w-full mx-4 transition-opacity duration-700 ${
              showIntroToast ? "opacity-100" : "opacity-0"
            }`}
          >
            <div
              role="status"
              aria-live="polite"
              onClick={() => {
                // Start fade-out immediately, then remove from DOM after the
                // transition completes (matching the 0.8s fade used earlier).
                setShowIntroToast(false);
                window.setTimeout(() => setIntroMounted(false), 800);
              }}
              className="cursor-pointer pointer-events-auto bg-orange-500 text-white px-6 py-4 rounded-lg shadow-lg text-center"
            >
              <div className="text-sm leading-relaxed">
                You are about to start the clinical interview. Greet the owner,
                then proceed with history-taking and physical exam questions.
                <div className="mt-2 font-semibold">Voice Mode is enabled:</div>
                <div className="text-xs mt-1">
                  the app will listen and speak. To switch to text-only, click
                  the 'Voice Mode' button to disable listening and speaking.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Chat messages area */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              stages={stages}
              onRetry={retryUserMessage}
            />
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

              {/* Voice-first toggle: when enabled, play audio first and show text after */}
              <Button
                variant={voiceFirst ? "destructive" : "secondary"}
                size="sm"
                className="flex items-center gap-1 text-xs"
                onClick={() => setVoiceFirst((v) => !v)}
                title={
                  voiceFirst
                    ? "Voice-first: audio plays before text"
                    : "Text-first: show text immediately"
                }
              >
                {voiceFirst ? "Voice-first: On" : "Voice-first: Off"}
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
