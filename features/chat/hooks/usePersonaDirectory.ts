"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { isAllowedChatPersonaKey, classifyChatPersonaLabel } from "@/features/chat/utils/persona-guardrails";

/**
 * Persona metadata entry for owner, nurse, or other chat personas.
 */
export type PersonaEntry = {
  displayName?: string;
  portraitUrl?: string;
  voiceId?: string;
  sex?: "male" | "female";
};

export type UsePersonaDirectoryResult = {
  /** Current persona directory (reactive state) */
  personaDirectory: Record<string, PersonaEntry>;
  /** Whether the directory has finished loading */
  isReady: boolean;
  /** Get persona metadata by role key (uses ref for stability) */
  getPersonaMetadata: (roleKey: string | null | undefined) => PersonaEntry | undefined;
  /** Update or insert persona entry */
  upsertPersona: (roleKey: string | null | undefined, entry: Partial<PersonaEntry>) => void;
  /** Wait for directory to be ready (useful for async flows) */
  waitForReady: () => Promise<void>;
};

/**
 * Normalize sex value to "male" | "female" | undefined
 */
function normalizeSex(value: string | undefined | null): "male" | "female" | undefined {
  if (!value) return undefined;
  const lower = String(value).toLowerCase().trim();
  if (lower === "male" || lower === "m") return "male";
  if (lower === "female" || lower === "f") return "female";
  return undefined;
}

/**
 * Resolve a role key to its normalized directory key.
 */
function resolveDirectoryPersonaKey(key: string | null | undefined): string | null {
  if (!key) return null;
  if (isAllowedChatPersonaKey(key)) return key;
  const classified = classifyChatPersonaLabel(key);
  return classified ?? null;
}

/**
 * Hook to manage persona directory loading and caching.
 *
 * Loads personas ONCE per caseId and provides stable accessors.
 * This prevents repeated API calls and UI flickering.
 */
export function usePersonaDirectory(caseId: string): UsePersonaDirectoryResult {
  const [personaDirectory, setPersonaDirectory] = useState<Record<string, PersonaEntry>>({});
  const [isReady, setIsReady] = useState(false);

  // Refs for stable access without re-renders
  const directoryRef = useRef<Record<string, PersonaEntry>>({});
  const readyResolveRef = useRef<(() => void) | null>(null);
  const readyPromiseRef = useRef<Promise<void> | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    directoryRef.current = personaDirectory;
  }, [personaDirectory]);

  // Initialize ready promise
  useEffect(() => {
    readyPromiseRef.current = new Promise<void>((resolve) => {
      readyResolveRef.current = resolve;
    });
  }, [caseId]);

  // Load personas on caseId change
  useEffect(() => {
    let cancelled = false;
    setIsReady(false);
    setPersonaDirectory({});
    directoryRef.current = {};

    // Reset ready promise
    readyPromiseRef.current = new Promise<void>((resolve) => {
      readyResolveRef.current = resolve;
    });

    async function loadPersonaDirectory() {
      try {
        const token = await (async () => {
          try {
            const { getAccessToken } = await import("@/lib/auth-headers");
            return await getAccessToken();
          } catch {
            return null;
          }
        })();

        const fetchOpts: RequestInit = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

        let response = await fetch(`/api/personas?caseId=${encodeURIComponent(caseId)}`, fetchOpts);

        let personasToProcess: any[] | undefined;

        // If case-specific personas fail, fall back to global personas
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            try {
              console.warn(`/api/personas returned ${response.status} — attempting /api/global-personas fallback`);
              const globalResp = await fetch(`/api/global-personas`, fetchOpts);
              if (globalResp.ok) {
                const globalPayload = await globalResp.json().catch(() => ({ personas: [] }));
                personasToProcess = Array.isArray(globalPayload?.personas) ? globalPayload.personas : [];
              } else {
                console.warn(`/api/global-personas also returned ${globalResp.status}; using empty directory`);
                personasToProcess = [];
              }
            } catch (globalErr) {
              console.warn("Fallback to global personas failed", globalErr);
              personasToProcess = [];
            }
          } else {
            throw new Error(`Failed to load personas: ${response.status}`);
          }
        }

        // Parse response if not already set from fallback
        if (typeof personasToProcess === "undefined") {
          const payload = await response.json().catch(() => ({ personas: [] }));
          personasToProcess = Array.isArray(payload?.personas) ? payload.personas : [];
        }

        const personas = personasToProcess || [];
        const next: Record<string, PersonaEntry> = {};

        for (const row of personas) {
          const rawKey = typeof row?.role_key === "string" ? row.role_key : "";
          const normalizedKey = isAllowedChatPersonaKey(rawKey) ? rawKey : classifyChatPersonaLabel(rawKey);
          if (!normalizedKey) continue;

          const metadata = row && typeof row.metadata === "object" && row.metadata !== null ? (row.metadata as Record<string, unknown>) : {};
          const identity =
            metadata && typeof metadata.identity === "object"
              ? (metadata.identity as { fullName?: string; voiceId?: string; sex?: string })
              : undefined;

          // Build candidate entry from this row
          const candidateDisplayName = typeof row?.display_name === "string" ? row.display_name : identity?.fullName;
          const candidatePortraitUrl = typeof row?.image_url === "string" ? row.image_url : undefined;
          const candidateVoiceId =
            typeof metadata?.voiceId === "string"
              ? (metadata.voiceId as string)
              : typeof identity?.voiceId === "string"
                ? identity.voiceId
                : undefined;
          const candidateSex =
            normalizeSex(typeof row?.sex === "string" ? row.sex : undefined) ??
            normalizeSex(typeof metadata?.sex === "string" ? (metadata.sex as string) : undefined) ??
            normalizeSex(typeof identity?.sex === "string" ? identity.sex : undefined);

          // Merge with existing entry - prefer values that exist
          const existing = next[normalizedKey];
          next[normalizedKey] = {
            displayName: candidateDisplayName ?? existing?.displayName,
            portraitUrl: candidatePortraitUrl ?? existing?.portraitUrl,
            voiceId: candidateVoiceId ?? existing?.voiceId,
            sex: candidateSex ?? existing?.sex,
          };

          console.debug("personaDirectory load", {
            key: normalizedKey,
            sex: next[normalizedKey].sex,
            displayName: next[normalizedKey].displayName,
            portraitUrl: next[normalizedKey].portraitUrl ? "[present]" : "[missing]",
          });
        }

        if (!cancelled) {
          setPersonaDirectory(next);
          directoryRef.current = next;
          setIsReady(true);
          readyResolveRef.current?.();
          readyResolveRef.current = null;
        }
      } catch (err) {
        console.warn("Failed to load persona directory", err);
        if (!cancelled) {
          setIsReady(true);
          readyResolveRef.current?.();
          readyResolveRef.current = null;
        }
      }
    }

    void loadPersonaDirectory();
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  // Stable getter that uses ref (doesn't cause re-renders on read)
  const getPersonaMetadata = useCallback((roleKey: string | null | undefined): PersonaEntry | undefined => {
    if (!roleKey) return undefined;
    const normalized = resolveDirectoryPersonaKey(roleKey);
    if (!normalized) return undefined;
    return directoryRef.current[normalized];
  }, []);

  // Upsert function to add/update persona entries
  const upsertPersona = useCallback((roleKey: string | null | undefined, entry: Partial<PersonaEntry>) => {
    const normalized = resolveDirectoryPersonaKey(roleKey);
    if (!normalized) return;

    setPersonaDirectory((prev) => {
      const existing = prev[normalized] ?? {};
      const updated = {
        ...prev,
        [normalized]: {
          ...existing,
          ...entry,
        },
      };
      directoryRef.current = updated;
      return updated;
    });
  }, []);

  // Wait for ready (useful for async flows that need persona data)
  const waitForReady = useCallback(async (): Promise<void> => {
    if (isReady) return;
    if (readyPromiseRef.current) {
      await readyPromiseRef.current;
    }
  }, [isReady]);

  return {
    personaDirectory,
    isReady,
    getPersonaMetadata,
    upsertPersona,
    waitForReady,
  };
}

export default usePersonaDirectory;
