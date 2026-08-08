"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Mic, PhoneOff, Volume2, VolumeX } from "lucide-react";
import type { LiveSessionStatus } from "../types";
import { StageAdvanceHint } from "./stage-advance-hint";
import { PersonaButton } from "@/features/chat/components/PersonaButton";

export type LivePersonaRoleKey = "owner" | "veterinary-nurse" | "lab-technician";

export type LivePersonaDef = {
  roleKey: LivePersonaRoleKey;
  label: string;
  portraitUrl?: string;
  fallbackText: string;
  isActive: boolean;
};

type LiveControlsProps = {
  status: LiveSessionStatus;
  isRecording: boolean;
  isSpeaking: boolean;
  canAdvance: boolean;
  isMuted: boolean;
  showAdvanceHint: boolean;
  elapsedTime?: string;
  /** Persona defs for owner, nurse and lab (all three; active one highlighted). */
  personas: LivePersonaDef[];
  onToggleMic: () => void;
  onSelectPersona: (roleKey: LivePersonaRoleKey) => void;
  onAdvanceStage: () => void;
  onEndSession: () => void;
  onToggleMute: () => void;
};

export function LiveControls({
  status,
  isRecording,
  isSpeaking,
  canAdvance,
  isMuted,
  showAdvanceHint,
  elapsedTime,
  personas,
  onToggleMic,
  onSelectPersona,
  onAdvanceStage,
  onEndSession,
  onToggleMute,
}: LiveControlsProps) {
  const isConnected = status === "connected";
  const isConnecting = status === "connecting";

  const owner = personas.find((p) => p.roleKey === "owner");
  const nurse = personas.find((p) => p.roleKey === "veterinary-nurse");
  const lab = personas.find((p) => p.roleKey === "lab-technician");
  const isLabActive = lab?.isActive ?? false;
  // Mirror the legacy chat UI: left = OWNER, right = NURSE — and when the lab
  // technician is active, show NURSE beside LAB so the user can switch back.
  const rightPersonas = isLabActive ? [nurse, lab] : [nurse];

  const micStatusLabel = isRecording
    ? "Listening…"
    : isSpeaking
      ? "Speaking…"
      : "SPEAK";

  return (
    <div className="flex flex-col items-center gap-3 px-4 pb-6 pt-2">
      {/* Main control cluster: OWNER avatar · mic · NURSE/LAB avatar · NEXT STAGE */}
      <div className="flex items-center justify-center gap-4 sm:gap-8 w-full max-w-3xl">
        {owner && (
          <PersonaButton
            roleKey="owner"
            label={owner.label}
            portraitUrl={owner.portraitUrl}
            fallbackText={owner.fallbackText}
            isActive={owner.isActive}
            onClick={() => onSelectPersona("owner")}
            testId="live-persona-owner"
            align="end"
          />
        )}

        {/* Central mic control */}
        <div className="flex flex-col items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onToggleMic}
            disabled={!isConnected}
            aria-pressed={isRecording}
            aria-label={isRecording ? "Stop listening" : "Start speaking"}
            className={cn(
              "relative h-16 w-16 sm:h-20 sm:w-20 flex items-center justify-center rounded-full shadow-lg transition-all duration-300",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              "bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-400 hover:from-amber-600 hover:via-orange-600 hover:to-yellow-500",
              isRecording && "scale-105 shadow-[0_0_24px_rgba(239,68,68,0.45)]"
            )}
          >
            <Mic className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
            {isRecording && (
              <span className="absolute inset-0 rounded-full animate-ping bg-red-400/40" />
            )}
          </button>
          <button
            id="mic-status-button"
            type="button"
            onClick={onToggleMic}
            disabled={!isConnected}
            aria-pressed={isRecording}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-semibold transition-colors",
              isRecording
                ? "bg-red-500 text-white"
                : isSpeaking
                  ? "bg-primary text-primary-foreground"
                  : "bg-amber-500 text-white",
              !isConnected && "bg-muted text-muted-foreground opacity-50"
            )}
          >
            {isConnecting ? "Connecting…" : !isConnected ? "Offline" : micStatusLabel}
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {rightPersonas.map((p) =>
            p ? (
              <PersonaButton
                key={p.roleKey}
                roleKey={p.roleKey}
                label={p.label}
                portraitUrl={p.portraitUrl}
                fallbackText={p.fallbackText}
                isActive={p.isActive}
                onClick={() => onSelectPersona(p.roleKey)}
                testId={`live-persona-${p.roleKey}`}
                align="start"
              />
            ) : null
          )}
        </div>

        {/* NEXT STAGE */}
        <div className="relative flex flex-col items-center gap-1">
          <StageAdvanceHint visible={showAdvanceHint && canAdvance} />
          <Button
            type="button"
            onClick={onAdvanceStage}
            size="lg"
            className={cn(
              "px-4 py-3 sm:px-6 text-xs sm:text-sm font-semibold text-white border-none transition-all duration-300",
              canAdvance
                ? "bg-gradient-to-l from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 shadow-lg hover:shadow-xl scale-105"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            NEXT STAGE
          </Button>
        </div>
      </div>

      {/* Who you are talking to + switch hint */}
      {isConnected && (
        <p className="text-[11px] text-muted-foreground/80 text-center">
          You are talking to {personas.find((p) => p.isActive)?.label ?? "the current persona"} —
          click an avatar to switch who you speak with.
        </p>
      )}

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

        {elapsedTime && isConnected && (
          <span className="text-xs text-muted-foreground tabular-nums">{elapsedTime}</span>
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
