"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import type { PersonaInstruction } from "../types";
import { AudioWaveform } from "./audio-waveform";

type PersonaHeaderProps = {
  persona: PersonaInstruction | null;
  stageTitle: string;
  isSpeaking: boolean;
  waveformMode?: "speaking" | "listening" | "idle";
  /** Real-time audio level source so the waveform reflects actual sound. */
  getLevel?: () => number;
};

// Horizontal header: avatar + identity on the left, stage and voice activity
// on the right — keeps the vertical space for the conversation transcript.
export function PersonaHeader({ persona, stageTitle, isSpeaking, waveformMode = "idle", getLevel }: PersonaHeaderProps) {
  const roleLabel =
    persona?.roleKey === "owner"
      ? "Pet Owner"
      : persona?.roleKey === "veterinary-nurse"
        ? "Veterinary Nurse"
        : persona?.roleKey === "lab-technician"
          ? "Lab Technician"
          : "";

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-4 border-b px-4 py-3 sm:gap-5 sm:px-6",
        isSpeaking
          ? "border-primary/40 bg-primary/10"
          : "border-border bg-primary/5"
      )}
    >
      {/* Portrait (current speaker — highlighted) */}
      <div
        className={cn(
          "relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-[3px] transition-all duration-500 sm:h-[4.5rem] sm:w-[4.5rem]",
          isSpeaking
            ? "border-primary shadow-[0_0_22px_rgba(59,130,246,0.55)] scale-105"
            : "border-primary/50 shadow-md"
        )}
      >
        {persona?.portraitUrl ? (
          <Image
            src={persona.portraitUrl}
            alt={persona.displayName}
            fill
            className="object-cover"
            sizes="72px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted text-xl font-semibold text-muted-foreground">
            {persona?.displayName?.charAt(0) ?? "?"}
          </div>
        )}
      </div>

      {/* Identity */}
      <div className="min-w-0">
        <h2 className="truncate text-xl font-bold leading-tight tracking-tight sm:text-2xl">
          {persona?.displayName ?? "Connecting..."}
        </h2>
        <p className="truncate text-sm text-primary/90">{roleLabel}</p>
      </div>

      {/* Stage + voice activity on the right */}
      <div className="ml-auto flex shrink-0 items-center gap-3">
        <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          {stageTitle}
        </div>
        {waveformMode !== "idle" && (
          <div className="h-8 w-24">
            <AudioWaveform
              isActive={true}
              mode={waveformMode}
              getLevel={getLevel}
              className="h-8 w-24"
            />
          </div>
        )}
      </div>
    </div>
  );
}
