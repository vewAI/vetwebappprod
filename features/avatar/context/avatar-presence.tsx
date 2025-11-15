"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { TtsEventDetail } from "@/features/speech/models/tts-events";
import { normalizeRoleKey } from "@/features/avatar/utils/role-utils";

export interface AvatarPresenceState {
  activeRoleKey: string | null;
  activeDisplayName: string | null;
  activeCaseId: string | null;
  isSpeaking: boolean;
  lastSpokenAt: number | null;
  setActiveSpeaker: (
    roleKey: string | null,
    displayName?: string | null,
    caseId?: string | null
  ) => void;
}

const AvatarPresenceContext = createContext<AvatarPresenceState | undefined>(
  undefined
);

export const AvatarPresenceProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [activeRoleKey, setActiveRoleKey] = useState<string | null>(null);
  const [activeDisplayName, setActiveDisplayName] = useState<string | null>(
    null
  );
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastSpokenAt, setLastSpokenAt] = useState<number | null>(null);

  useEffect(() => {
    const handleStart = (event: Event) => {
      const detail = (event as CustomEvent<TtsEventDetail>).detail;
      const roleKey = normalizeRoleKey(
        detail?.roleKey ?? detail?.role ?? detail?.displayRole
      );
      const label = detail?.displayRole ?? detail?.role ?? roleKey;
      setActiveRoleKey(roleKey);
      setActiveDisplayName(label ?? null);
      setActiveCaseId(detail?.caseId ?? null);
      setIsSpeaking(true);
      setLastSpokenAt(Date.now());
    };

    const handleEnd = () => {
      setIsSpeaking(false);
      setLastSpokenAt(Date.now());
    };

    window.addEventListener("vw:tts-start", handleStart as EventListener);
    window.addEventListener("vw:tts-end", handleEnd as EventListener);

    return () => {
      window.removeEventListener("vw:tts-start", handleStart as EventListener);
      window.removeEventListener("vw:tts-end", handleEnd as EventListener);
    };
  }, []);

  const value = useMemo<AvatarPresenceState>(
    () => ({
      activeRoleKey,
      activeDisplayName,
      activeCaseId,
      isSpeaking,
      lastSpokenAt,
      setActiveSpeaker: (roleKey, label, caseId) => {
        setActiveRoleKey(roleKey);
        setActiveDisplayName(label ?? null);
        setActiveCaseId(caseId ?? null);
        setIsSpeaking(Boolean(roleKey));
        setLastSpokenAt(roleKey ? Date.now() : lastSpokenAt);
      },
    }),
    [activeRoleKey, activeDisplayName, activeCaseId, isSpeaking, lastSpokenAt]
  );

  return (
    <AvatarPresenceContext.Provider value={value}>
      {children}
    </AvatarPresenceContext.Provider>
  );
};

export function useAvatarPresence() {
  const ctx = useContext(AvatarPresenceContext);
  if (!ctx) {
    throw new Error(
      "useAvatarPresence must be used inside AvatarPresenceProvider"
    );
  }
  return ctx;
}
