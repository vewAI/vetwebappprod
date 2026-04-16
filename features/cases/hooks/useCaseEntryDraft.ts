"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type { CaseFieldKey } from "../fieldMeta";

const STORAGE_KEY = "case-entry-draft";

export type DraftData = {
  form: Record<CaseFieldKey, string>;
  intakeText: string;
  savedCaseId: string;
  savedAt: string;
};

export function useCaseEntryDraft() {
  const [hasDraft, setHasDraft] = useState(false);
  const [draftTimestamp, setDraftTimestamp] = useState<string | null>(null);
  const lastSavedJson = useRef<string>("");

  // Check for existing draft on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DraftData;
        if (parsed.form && typeof parsed.form === "object") {
          setHasDraft(true);
          setDraftTimestamp(parsed.savedAt ?? null);
        }
      }
    } catch {
      // Corrupted data — ignore
    }
  }, []);

  const restore = useCallback((): DraftData | null => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as DraftData;
      if (parsed.form && typeof parsed.form === "object") {
        lastSavedJson.current = raw;
        return parsed;
      }
    } catch {
      // Corrupted — clear it
      localStorage.removeItem(STORAGE_KEY);
    }
    return null;
  }, []);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    lastSavedJson.current = "";
    setHasDraft(false);
    setDraftTimestamp(null);
  }, []);

  const saveDraft = useCallback((data: Omit<DraftData, "savedAt">) => {
    const full: DraftData = {
      ...data,
      savedAt: new Date().toISOString(),
    };
    const json = JSON.stringify(full);
    // Skip write if nothing changed
    if (json === lastSavedJson.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, json);
      lastSavedJson.current = json;
      setHasDraft(true);
      setDraftTimestamp(full.savedAt);
    } catch {
      // localStorage full or unavailable — non-blocking
    }
  }, []);

  return { hasDraft, draftTimestamp, restore, clearDraft, saveDraft };
}
