"use client";

import { useEffect, useState } from "react";
import {
  getSession,
  getSessionAttempts,
} from "../services/caseSessionService";
import type { CaseSession, SessionAttemptRow } from "../models/caseSession";

export function useCaseSessionDetail(sessionId: string) {
  const [session, setSession] = useState<CaseSession | null>(null);
  const [attempts, setAttempts] = useState<SessionAttemptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [s, a] = await Promise.all([
          getSession(sessionId),
          getSessionAttempts(sessionId),
        ]);
        if (!cancelled) {
          setSession(s);
          setAttempts(a);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
          setSession(null);
          setAttempts([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return { session, attempts, loading, error };
}
