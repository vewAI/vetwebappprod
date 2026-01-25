import React from "react";
import type { AllowedChatPersonaKey } from "@/features/chat/utils/persona-guardrails";

export type PersonaTabsProps = {
  activePersona: AllowedChatPersonaKey;
  onChange: (k: AllowedChatPersonaKey) => void;
};

export const PersonaTabs: React.FC<PersonaTabsProps> = ({ activePersona, onChange }) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Support Left/Right navigation between OWNER <-> NURSE
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      if (activePersona === "owner" && e.key === "ArrowRight") return onChange("veterinary-nurse");
      if (activePersona === "veterinary-nurse" && e.key === "ArrowLeft") return onChange("owner");
    }
  };

  return (
    <div id="persona-tabs" role="tablist" aria-label="Persona tabs" className="flex gap-2 mb-4" onKeyDown={handleKeyDown} tabIndex={0}>
      <button
        role="tab"
        aria-controls="chat-messages"
        aria-selected={activePersona === "owner"}
        data-testid="persona-owner"
        tabIndex={0}
        className={`px-3 py-1 rounded-md ${activePersona === "owner" ? "bg-blue-600 text-white" : "bg-muted"}`}
        onClick={() => onChange("owner")}
      >
        OWNER
      </button>
      <button
        role="tab"
        aria-controls="chat-messages"
        aria-selected={activePersona === "veterinary-nurse"}
        data-testid="persona-nurse"
        tabIndex={0}
        className={`px-3 py-1 rounded-md ${activePersona === "veterinary-nurse" ? "bg-blue-600 text-white" : "bg-muted"}`}
        onClick={() => onChange("veterinary-nurse")}
      >
        NURSE
      </button>
    </div>
  );
};

export default PersonaTabs;
