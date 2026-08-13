"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Send, SkipForward, PhoneOff, Volume2, VolumeX } from "lucide-react";
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
  isTextMode: boolean;
  textInput: string;
  canAdvance: boolean;
  isMuted: boolean;
  showAdvanceHint: boolean;
  elapsedTime?: string;
  personas: LivePersonaDef[];
  onToggleMic: () => void;
  onSelectPersona: (roleKey: LivePersonaRoleKey) => void;
  onTextInputChange: (value: string) => void;
  onSendText: () => void;
  onAdvanceStage: () => void;
  onEndSession: () => void;
  onToggleMute: () => void;
};

export function LiveControls({
  status,
  isRecording,
  isSpeaking,
  isTextMode,
  textInput,
  canAdvance,
  isMuted,
  showAdvanceHint,
  elapsedTime,
  personas,
  onToggleMic,
  onSelectPersona,
  onTextInputChange,
  onSendText,
  onAdvanceStage,
  onEndSession,
  onToggleMute,
}: LiveControlsProps) {
  const isConnected = status === "connected";
  const isConnecting = status === "connecting";
  const canSendText = isConnected && isTextMode && textInput.trim().length > 0;
  const owner = personas.find((persona) => persona.roleKey === "owner");
  const nurse = personas.find((persona) => persona.roleKey === "veterinary-nurse");
  const lab = personas.find((persona) => persona.roleKey === "lab-technician");
  const rightPersonas = lab?.isActive ? [nurse, lab] : [nurse];

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

      {/* Legacy-style persona switcher around the central microphone. */}
      <div className="flex w-full max-w-3xl items-center justify-center gap-3 sm:gap-6">
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

        <div className="flex shrink-0 flex-col items-center gap-2">
          <button
            type="button"
            onClick={onToggleMic}
            disabled={!isConnected}
            aria-label={isRecording ? "Stop speaking and write instead" : "Use microphone to speak"}
            className={cn(
              "relative flex h-16 w-16 items-center justify-center rounded-full transition-all duration-300 sm:h-20 sm:w-20",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "disabled:cursor-not-allowed disabled:opacity-40",
              isRecording
                ? "scale-105 bg-red-500 shadow-[0_0_24px_rgba(239,68,68,0.4)] hover:bg-red-600"
                : "bg-primary shadow-lg hover:bg-primary/90 hover:shadow-xl",
            )}
          >
            {isRecording ? <MicOff className="h-7 w-7 text-white sm:h-8 sm:w-8" /> : <Mic className="h-7 w-7 text-primary-foreground sm:h-8 sm:w-8" />}
            {isRecording && <span className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-30" />}
          </button>
          <p className="text-center text-[11px] text-muted-foreground">
            {isConnecting
              ? "Connecting..."
              : !isConnected
                ? "Disconnected"
                : isRecording
                  ? "Tap mic to write"
                  : isTextMode
                    ? "Tap mic to speak"
                    : isSpeaking
                      ? "Speaking..."
                      : "Tap to speak"}
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {rightPersonas.map((persona) =>
            persona ? (
              <PersonaButton
                key={persona.roleKey}
                roleKey={persona.roleKey}
                label={persona.label}
                portraitUrl={persona.portraitUrl}
                fallbackText={persona.fallbackText}
                isActive={persona.isActive}
                onClick={() => onSelectPersona(persona.roleKey)}
                testId={`live-persona-${persona.roleKey}`}
                align="start"
              />
            ) : null,
          )}
        </div>
      </div>

      {isConnected && (
        <p className="text-center text-[11px] text-muted-foreground/80">
          You are talking to {personas.find((persona) => persona.isActive)?.label ?? "the current persona"} — click an avatar to switch.
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
          aria-label={isMuted ? "Unmute avatar" : "Mute avatar"}
        >
          {isMuted ? (
            <VolumeX className="h-5 w-5 text-muted-foreground" />
          ) : (
            <Volume2 className="h-5 w-5" />
          )}
        </Button>

        {elapsedTime && isConnected && (
          <span className="text-xs tabular-nums text-muted-foreground">{elapsedTime}</span>
        )}

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
