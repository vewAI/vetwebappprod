"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Send, SkipForward, PhoneOff, Volume2, VolumeX } from "lucide-react";
import type { LiveSessionStatus } from "../types";
import { StageAdvanceHint } from "./stage-advance-hint";

type LiveControlsProps = {
  status: LiveSessionStatus;
  isRecording: boolean;
  isTextMode: boolean;
  textInput: string;
  canAdvance: boolean;
  isMuted: boolean;
  showAdvanceHint: boolean;
  onToggleMic: () => void;
  onTextInputChange: (value: string) => void;
  onSendText: () => void;
  onAdvanceStage: () => void;
  onEndSession: () => void;
  onToggleMute: () => void;
};

export function LiveControls({
  status,
  isRecording,
  isTextMode,
  textInput,
  canAdvance,
  isMuted,
  showAdvanceHint,
  onToggleMic,
  onTextInputChange,
  onSendText,
  onAdvanceStage,
  onEndSession,
  onToggleMute,
}: LiveControlsProps) {
  const isConnected = status === "connected";
  const isConnecting = status === "connecting";
  const canSendText = isConnected && isTextMode && textInput.trim().length > 0;

  return (
    <div className="flex flex-col items-center gap-3 px-4 pb-5 pt-2">
      {isTextMode && isConnected && (
        <div className="w-full max-w-xl rounded-lg border border-primary/25 bg-primary/5 p-3">
          <p className="mb-2 text-center text-xs text-muted-foreground">
            Prefer to write? Type your message below. To continue speaking, click the microphone again.
          </p>
          <div className="flex items-end gap-2">
            <textarea
              autoFocus
              value={textInput}
              onChange={(event) => onTextInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (canSendText) onSendText();
                }
              }}
              placeholder="Write your message..."
              rows={2}
              maxLength={2000}
              className="min-h-12 flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Write a message"
            />
            <Button
              type="button"
              size="icon"
              onClick={onSendText}
              disabled={!canSendText}
              aria-label="Send written message"
              className="h-10 w-10 shrink-0 rounded-full"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Press Enter to send · Shift+Enter for a new line
          </p>
        </div>
      )}

      {/* Main mic button. When recording, clicking it switches to writing mode. */}
      <button
        type="button"
        onClick={onToggleMic}
        disabled={!isConnected}
        aria-label={isRecording ? "Stop speaking and write instead" : "Use microphone to speak"}
        className={cn(
          "relative flex h-20 w-20 items-center justify-center rounded-full transition-all duration-300",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-40",
          isRecording
            ? "scale-110 bg-red-500 shadow-[0_0_24px_rgba(239,68,68,0.4)] hover:bg-red-600"
            : "bg-primary shadow-lg hover:bg-primary/90 hover:shadow-xl",
        )}
      >
        {isRecording ? (
          <MicOff className="h-8 w-8 text-white" />
        ) : (
          <Mic className="h-8 w-8 text-primary-foreground" />
        )}
        {isRecording && (
          <span className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-30" />
        )}
      </button>

      <p className="text-xs text-muted-foreground">
        {isConnecting
          ? "Connecting..."
          : !isConnected
            ? "Disconnected"
            : isRecording
              ? "Tap the mic to write instead"
              : isTextMode
                ? "Tap the mic to speak"
                : "Tap to speak"}
      </p>

      {/* Secondary controls */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleMute}
          disabled={!isConnected}
          className="h-11 w-11 rounded-full"
          aria-label={isMuted ? "Unmute avatar" : "Mute avatar"}
        >
          {isMuted ? (
            <VolumeX className="h-5 w-5 text-muted-foreground" />
          ) : (
            <Volume2 className="h-5 w-5" />
          )}
        </Button>

        <div className="relative">
          <StageAdvanceHint visible={showAdvanceHint && canAdvance} />
          <Button
            variant="outline"
            size="sm"
            onClick={onAdvanceStage}
            className={cn(
              "gap-2 rounded-full px-4",
              canAdvance
                ? "border-yellow-400/50 text-yellow-400 hover:bg-yellow-400/10"
                : "border-muted text-muted-foreground hover:bg-muted/50",
            )}
          >
            <SkipForward className="h-4 w-4" />
            Next Stage
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onEndSession}
          className="h-11 w-11 rounded-full text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20"
          aria-label="End session"
        >
          <PhoneOff className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
