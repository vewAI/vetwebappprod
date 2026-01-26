import { resolveChatPersonaRoleKey } from "@/features/chat/utils/persona-guardrails";
import type { AllowedChatPersonaKey } from "@/features/chat/utils/persona-guardrails";
import { isAllowedChatPersonaKey } from "@/features/chat/utils/persona-guardrails";

export type PersonaSelectionInputs = {
  userPersonaKey?: string | null;
  selectedPersonaAtSend?: string | null;
  lastSentPersona?: string | null;
  responsePersonaKey?: string | null;
  activePersona?: string | null;
  stageRole?: string | null;
  roleName?: string | null;
};

export function chooseSafePersonaKey(inputs: PersonaSelectionInputs): AllowedChatPersonaKey {
  const {
    userPersonaKey,
    selectedPersonaAtSend,
    lastSentPersona,
    responsePersonaKey,
    activePersona,
    stageRole,
    roleName,
  } = inputs;

  // Prefer explicit assignment on the user message
  if (userPersonaKey && isAllowedChatPersonaKey(userPersonaKey)) {
    return userPersonaKey as AllowedChatPersonaKey;
  }

  // If the user explicitly selected a persona at send time (UI tab), prefer it
  if (selectedPersonaAtSend && isAllowedChatPersonaKey(selectedPersonaAtSend)) {
    return selectedPersonaAtSend as AllowedChatPersonaKey;
  }

  // Then fall back to the last-sent persona marker
  if (lastSentPersona && isAllowedChatPersonaKey(lastSentPersona)) {
    return lastSentPersona as AllowedChatPersonaKey;
  }

  // Then prefer a server-provided persona if it is valid
  if (responsePersonaKey && isAllowedChatPersonaKey(responsePersonaKey)) {
    return responsePersonaKey as AllowedChatPersonaKey;
  }

  // Then prefer the active UI persona if valid
  if (activePersona && isAllowedChatPersonaKey(activePersona)) {
    return activePersona as AllowedChatPersonaKey;
  }

  // Final fallback: resolve from stage or roleName
  return resolveChatPersonaRoleKey(stageRole ?? null, roleName ?? null);
}
