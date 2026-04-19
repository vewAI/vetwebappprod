"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, SkipForward, PhoneOff, Volume2, VolumeX } from "lucide-react";
import type { LiveSessionStatus } from "../types";

type LiveControlsProps = {
  status: LiveSessionStatus;
  isRecording: boolean;
  canAdvance: boolean;
  isMuted: boolean;
  onToggleMic: () => void;
  onInterrupt: () => void;
  onAdvanceStage: () => void;
  onEndSession: () => void;
  onToggleMute: () => void;
};

export function LiveControls({
  status,
  isRecording,
  canAdvance,
  isMuted,
  onToggleMic,
  onInterrupt,
  onAdvanceStage,
  onEndSession,
  onToggleMute,
}: LiveControlsProps) {
  const isConnected = status === "connected";
  const isConnecting = status === "connecting";

  return (
    <div className="flex flex-col items-center gap-4 px-4 pb-6 pt-2">
      {/* Main mic button */}
      <button
        onClick={onToggleMic}
        disabled={!isConnected}
        className={cn(
          "relative flex h-20 w-20 items-center justify-center rounded-full transition-all duration-300",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          isRecording
            ? "bg-red-500 hover:bg-red-600 shadow-[0_0_24px_rgba(239,68,68,0.4)] scale-110"
            : "bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl"
        )}
      >
        {isRecording ? (
          <MicOff className="h-8 w-8 text-white" />
        ) : (
          <Mic className="h-8 w-8 text-primary-foreground" />
        )}
        {isRecording && (
          <span className="absolute inset-0 rounded-full animate-ping bg-red-400 opacity-30" />
        )}
      </button>

      <p className="text-xs text-muted-foreground">
        {isConnecting
          ? "Connecting..."
          : !isConnected
            ? "Disconnected"
            : isRecording
              ? "Tap to stop"
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
        >
          {isMuted ? (
            <VolumeX className="h-5 w-5 text-muted-foreground" />
          ) : (
            <Volume2 className="h-5 w-5" />
          )}
        </Button>

        {canAdvance && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAdvanceStage}
            className="gap-2 rounded-full px-4"
          >
            <SkipForward className="h-4 w-4" />
            Next Stage
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={onEndSession}
          className="h-11 w-11 rounded-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
        >
          <PhoneOff className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
