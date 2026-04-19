"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import type { PersonaInstruction } from "../types";

type PersonaHeaderProps = {
  persona: PersonaInstruction | null;
  stageTitle: string;
  isSpeaking: boolean;
};

export function PersonaHeader({ persona, stageTitle, isSpeaking }: PersonaHeaderProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 pt-6 pb-2">
      {/* Portrait */}
      <div
        className={cn(
          "relative h-28 w-28 rounded-full overflow-hidden border-4 transition-all duration-500",
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
            sizes="112px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted text-3xl font-semibold text-muted-foreground">
            {persona?.displayName?.charAt(0) ?? "?"}
          </div>
        )}
      </div>

      {/* Name and role */}
      <div className="text-center">
        <h2 className="text-lg font-semibold leading-tight">
          {persona?.displayName ?? "Connecting..."}
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
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

      {/* Speaking indicator */}
      {isSpeaking && (
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse delay-100" />
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse delay-200" />
        </div>
      )}
    </div>
  );
}
