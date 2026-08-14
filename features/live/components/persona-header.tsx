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
};

export function PersonaHeader({ persona, stageTitle, isSpeaking, waveformMode = "idle" }: PersonaHeaderProps) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-2 px-4 pb-1 pt-3 sm:gap-2 sm:pt-4">
      {/* Portrait */}
      <div
        className={cn(
          "relative h-20 w-20 overflow-hidden rounded-full border-4 transition-all duration-500 sm:h-24 sm:w-24",
          isSpeaking
            ? "border-primary shadow-[0_0_24px_rgba(59,130,246,0.4)] scale-105"
            : "border-muted shadow-md"
        )}
      >
        {persona?.portraitUrl ? (
          <Image
            src={persona.portraitUrl}
            alt={persona.displayName}
            fill
            className="object-cover"
            sizes="96px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted text-2xl font-semibold text-muted-foreground">
            {persona?.displayName?.charAt(0) ?? "?"}
          </div>
        )}
      </div>

      {/* Name and role */}
      <div className="text-center">
        <h2 className="text-base font-semibold leading-tight sm:text-lg">
          {persona?.displayName ?? "Connecting..."}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
          {persona?.roleKey === "owner"
            ? "Pet Owner"
            : persona?.roleKey === "veterinary-nurse"
              ? "Veterinary Nurse"
              : persona?.roleKey === "lab-technician"
                ? "Lab Technician"
                : ""}
        </p>
      </div>

      {/* Stage indicator */}
      <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
        {stageTitle}
      </div>

      {/* Compact speaking/listening animation; keep the center workspace available for the transcript. */}
      {waveformMode !== "idle" && (
        <div className="h-5 w-16 sm:h-6 sm:w-20">
          <AudioWaveform
            isActive={true}
            mode={waveformMode}
            className="h-5 w-16 sm:h-6 sm:w-20"
          />
        </div>
      )}
    </div>
  );
}
