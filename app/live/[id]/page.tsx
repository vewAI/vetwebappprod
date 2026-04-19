"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/features/auth/services/authService";
import { fetchCaseById } from "@/features/case-selection/services/caseService";
import { usePersonaDirectory } from "@/features/chat/hooks/usePersonaDirectory";
import { caseStageRowToStage, type CaseStageRow } from "@/features/stages/types";
import type { Case } from "@/features/case-selection/models/case";
import type { Stage } from "@/features/stages/types";
import { LiveSession } from "@/features/live/components/live-session";
import { getAccessToken } from "@/lib/auth-headers";

type SessionData = {
  attemptId: string;
  currentStageIndex: number;
  resumed: boolean;
};

export default function LiveSessionPage() {
  const { id: caseId } = useParams() as { id: string };
  const router = useRouter();
  const { user } = useAuth();

  const [caseData, setCaseData] = useState<Case | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [session, setSession] = useState<SessionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const personaDir = usePersonaDirectory(caseId);

  // Load case data
  useEffect(() => {
    if (!caseId) return;
    fetchCaseById(caseId).then((c) => {
      setCaseData(c);
    });
  }, [caseId]);

  // Load stages
  useEffect(() => {
    if (!caseId) return;

    async function loadStages() {
      try {
        const token = await getAccessToken().catch(() => null);
        const opts: RequestInit = token
          ? { headers: { Authorization: `Bearer ${token}` } }
          : {};

        const res = await fetch(
          `/api/cases/${encodeURIComponent(caseId)}/stages`,
          opts
        );

        if (!res.ok) {
          throw new Error(`Failed to load stages: ${res.status}`);
        }

        const data = await res.json();
        const stageRows: CaseStageRow[] = Array.isArray(data.stages)
          ? data.stages
          : [];
        const mapped = stageRows.map(caseStageRowToStage);
        setStages(mapped);
      } catch (err) {
        console.error("Failed to load stages:", err);
        setError(err instanceof Error ? err.message : "Failed to load stages");
      }
    }

    loadStages();
  }, [caseId]);

  // Create or resume session
  useEffect(() => {
    if (!caseId || !user) return;

    async function initSession() {
      try {
        const token = await getAccessToken().catch(() => null);
        const opts: RequestInit = {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ caseId }),
        };

        const res = await fetch("/api/live/session", opts);

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Failed to create session");
        }

        const data = await res.json();
        setSession({
          attemptId: data.attemptId,
          currentStageIndex: data.currentStageIndex ?? 0,
          resumed: data.resumed ?? false,
        });
      } catch (err) {
        console.error("Session init failed:", err);
        setError(err instanceof Error ? err.message : "Failed to initialize session");
      } finally {
        setIsLoading(false);
      }
    }

    initSession();
  }, [caseId, user]);

  // Loading state
  if (isLoading || !caseData || stages.length === 0 || !session) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          {!user
            ? "Signing in..."
            : !caseData
              ? "Loading case..."
              : stages.length === 0
                ? "Loading stages..."
                : !session
                  ? "Creating session..."
                  : "Initializing..."}
        </p>
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Cases
          </Button>
        </Link>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
        <p className="text-sm text-red-500">{error}</p>
        <Link href="/">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Cases
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <LiveSession
      caseItem={caseData}
      stages={stages}
      initialStageIndex={session.currentStageIndex}
      personaDirectory={personaDir.personaDirectory}
      attemptId={session.attemptId}
      onSessionEnd={() => router.push("/")}
    />
  );
}
