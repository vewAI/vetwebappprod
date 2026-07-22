"use client";

import React from "react";
import { cn } from "@/lib/utils";
import type { AllowedChatPersonaKey } from "@/features/chat/utils/persona-guardrails";

export type LivePersonaKey = AllowedChatPersonaKey | "lab-technician";

export type PersonaTabDef = {
  key: LivePersonaKey;
  label: string;
  disabled?: boolean;
  disabledReason?: string;
  isSpeaking?: boolean;
};

export type PersonaTabsProps = {
  activePersona: AllowedChatPersonaKey;
  onChange: (k: string) => void;
  /** Optional extended tabs for Live (includes LAB). Falls back to OWNER/NURSE only. */
  extendedTabs?: PersonaTabDef[];
};

export const PersonaTabs: React.FC<PersonaTabsProps> = ({
  activePersona,
  onChange,
  extendedTabs,
}) => {
  const tabs: PersonaTabDef[] = extendedTabs ?? [
    { key: "owner", label: "OWNER" },
    { key: "veterinary-nurse", label: "NURSE" },
  ];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const currentIdx = tabs.findIndex((t) => t.key === activePersona);
      if (e.key === "ArrowRight" && currentIdx < tabs.length - 1) {
        const next = tabs[currentIdx + 1];
        if (!next.disabled && next.key !== "lab-technician") {
          onChange(next.key as AllowedChatPersonaKey);
        }
      }
      if (e.key === "ArrowLeft" && currentIdx > 0) {
        const prev = tabs[currentIdx - 1];
        if (!prev.disabled && prev.key !== "lab-technician") {
          onChange(prev.key as AllowedChatPersonaKey);
        }
      }
    }
  };

  return (
    <div
      id="persona-tabs"
      role="tablist"
      aria-label="Persona tabs"
      className="flex gap-2 mb-4"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {tabs.map((tab) => {
        const isActive = activePersona === tab.key;
        const isDisabled = tab.disabled && !isActive;

        return (
          <button
            key={tab.key}
            role="tab"
            aria-controls="chat-messages"
            aria-selected={isActive}
            data-testid={`persona-${tab.key}`}
            tabIndex={0}
            disabled={isDisabled}
            title={isDisabled ? tab.disabledReason : undefined}
            className={cn(
              "relative px-3 py-1 rounded-md transition-all",
              isActive && "bg-blue-600 text-white",
              !isActive && !isDisabled && "bg-muted hover:bg-muted/80 cursor-pointer",
              isDisabled && "bg-muted/50 text-muted-foreground cursor-not-allowed opacity-60"
            )}
            onClick={() => {
              if (!isDisabled) {
                onChange(tab.key);
              }
            }}
          >
            {tab.label}
            {/* Speaking indicator dot */}
            {tab.isSpeaking && !isActive && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default PersonaTabs;
