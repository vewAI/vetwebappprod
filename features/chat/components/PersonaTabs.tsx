import React from "react";
import type { AllowedChatPersonaKey } from "@/features/chat/utils/persona-guardrails";

export type PersonaTabsProps = {
  activePersona: AllowedChatPersonaKey;
  onChange: (k: AllowedChatPersonaKey) => void;
};

export const PersonaTabs: React.FC<PersonaTabsProps> = ({ activePersona, onChange }) => {
  return (
    <div role="tablist" aria-label="Persona tabs" className="flex gap-2 mb-4">
      <button
        role="tab"
        aria-selected={activePersona === "owner"}
        className={`px-3 py-1 rounded-md ${activePersona === "owner" ? "bg-blue-600 text-white" : "bg-muted"}`}
        onClick={() => onChange("owner")}
      >
        OWNER
      </button>
      <button
        role="tab"
        aria-selected={activePersona === "veterinary-nurse"}
        className={`px-3 py-1 rounded-md ${activePersona === "veterinary-nurse" ? "bg-blue-600 text-white" : "bg-muted"}`}
        onClick={() => onChange("veterinary-nurse")}
      >
        NURSE
      </button>
    </div>
  );
};

export default PersonaTabs;
