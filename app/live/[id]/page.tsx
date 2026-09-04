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
import type { Message } from "@/features/chat/models/chat";
import { CompletionDialog } from "@/features/feedback/components/completion-dialog";
import { completeAttempt } from "@/features/attempts/services/attemptMutationService";
import { getAccessToken } from "@/lib/auth-headers";

type SessionData = {
  attemptId: string;
  currentStageIndex: number;
  resumed: boolean;
  messages: Message[];
  timeSpentSeconds?: number;
};

function formatMinutes(seconds?: number): string {
  const m = Math.max(0, Math.round((seconds ?? 0) / 60));
  return m > 0 ? `${m} min` : "under a minute";
}

export default function LiveSessionPage() {
  const { id: caseId } = useParams() as { id: string };
  const router = useRouter();
  const { user } = useAuth();

  const [caseData, setCaseData] = useState<Case | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [session, setSession] = useState<SessionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Feedback dialog state
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [feedbackContent, setFeedbackContent] = useState("");
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
  const [finalMessages, setFinalMessages] = useState<Message[]>([]);

  // Resume gate: when an in-progress session exists, the student explicitly
  // chooses between continuing it and starting fresh BEFORE connecting.
  const [resumeChoice, setResumeChoice] = useState<"pending" | "decided">("decided");
  const [startingFresh, setStartingFresh] = useState(false);

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
        const messages = Array.isArray(data.messages) ? (data.messages as Message[]) : [];
        setSession({
          attemptId: data.attemptId,
          currentStageIndex: data.currentStageIndex ?? 0,
          resumed: data.resumed ?? false,
          messages,
          timeSpentSeconds: typeof data.timeSpentSeconds === "number" ? data.timeSpentSeconds : 0,
        });
        setResumeChoice(data.resumed ? "pending" : "decided");
      } catch (err) {
        console.error("Session init failed:", err);
        setError(err instanceof Error ? err.message : "Failed to initialize session");
      } finally {
        setIsLoading(false);
      }
    }

    initSession();
  }, [caseId, user]);

  // Handle session end — generate communication feedback and show dialog
  const handleSessionEnd = async (messages?: Message[]) => {
    setShowCompletionDialog(true);
    setIsGeneratingFeedback(true);
    setFinalMessages(messages ?? []);

    try {
      if (messages && messages.length > 0 && session?.attemptId) {
        const token = await getAccessToken().catch(() => null);

        // Generate feedback — one automatic retry on transient server errors
        // (important when a whole class finishes sessions at once).
        let feedbackRes: Response | null = null;
        for (let attempt = 0; attempt < 2; attempt++) {
          if (attempt > 0) await new Promise((r) => setTimeout(r, 2500));
          feedbackRes = await fetch("/api/live/feedback", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ caseId, attemptId: session.attemptId, messages }),
          });
          if (feedbackRes.ok) break;
          if (feedbackRes.status < 500) break; // don't retry client errors
        }

        if (feedbackRes && feedbackRes.ok) {
          const data = await feedbackRes.json();
          setFeedbackContent(data.feedback || "");
          // Persist feedback to attempt
          await completeAttempt(session.attemptId, data.feedback || "");
        } else {
          const status = feedbackRes?.status ?? 0;
          const err = await feedbackRes
            ?.json()
            .catch(() => ({ error: `HTTP ${status}` }));
          console.error("Live feedback request failed:", status, err);
          const detail =
            typeof (err as { error?: unknown })?.error === "string"
              ? ` (${((err as { error: string }).error).replace(/[<>&]/g, "")})`
              : "";
          setFeedbackContent(
            `<p>Unable to generate feedback at this time${detail}. Your session has been recorded.</p>`
          );
        }
      } else {
        setFeedbackContent(
          "<p>Session ended with no recorded interaction. Try speaking with the persona next time to receive communication skills feedback.</p>"
        );
      }
    } catch (err) {
      console.error("Feedback generation failed:", err);
      setFeedbackContent(
        "<p>Unable to generate feedback at this time. Your session has been recorded.</p>"
      );
    } finally {
      setIsGeneratingFeedback(false);
    }
  };

  // Start fresh: complete the in-progress attempt and request a new one.
  const handleStartFresh = async () => {
    if (!session) return;
    setStartingFresh(true);
    try {
      const token = await getAccessToken().catch(() => null);
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      await fetch("/api/live/session", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ attemptId: session.attemptId, status: "completed" }),
      });
      const res = await fetch("/api/live/session", {
        method: "POST",
        headers,
        body: JSON.stringify({ caseId }),
      });
      if (res.ok) {
        const data = await res.json();
        setSession({
          attemptId: data.attemptId,
          currentStageIndex: data.currentStageIndex ?? 0,
          resumed: data.resumed ?? false,
          messages: Array.isArray(data.messages) ? (data.messages as Message[]) : [],
          timeSpentSeconds: typeof data.timeSpentSeconds === "number" ? data.timeSpentSeconds : 0,
        });
      }
      setResumeChoice("decided");
    } catch (err) {
      console.error("Start fresh failed:", err);
      setResumeChoice("decided");
    } finally {
      setStartingFresh(false);
    }
  };

  // Loading state — wait for personas too so LiveSession always gets a populated directory
  if (isLoading || !caseData || stages.length === 0 || !session || !personaDir.isReady) {
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
                  : !personaDir.isReady
                    ? "Loading personas..."
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

  // Resume vs fresh choice — shown BEFORE anything connects.
  if (resumeChoice === "pending" && session && caseData) {
    const stageCount = stages.length || 1;
    return (
      <div className="flex h-full items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {caseData.title}
          </p>
          <h1 className="mt-1 text-xl font-semibold">Resume or start fresh?</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You have a session in progress for this case:{" "}
            <strong>
              stage {session.currentStageIndex + 1} of {stageCount}
            </strong>{" "}
            · {formatMinutes(session.timeSpentSeconds)} invested ·{" "}
            {session.messages.length} messages.
          </p>
          <div className="mt-5 space-y-2">
            <Button size="lg" className="w-full" onClick={() => setResumeChoice("decided")}>
              Continue where I left off
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full"
              onClick={handleStartFresh}
              disabled={startingFresh}
            >
              {startingFresh ? "Creating fresh session…" : "Start a fresh session"}
            </Button>
          </div>
        </div>
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
    <>
      <LiveSession
        key={session.attemptId}
        caseItem={caseData}
        stages={stages}
        initialStageIndex={session.currentStageIndex}
        personaDirectory={personaDir.personaDirectory}
        attemptId={session.attemptId}
        initialMessages={session.messages}
        initialTimeSpentSeconds={session.timeSpentSeconds}
        onSessionEnd={handleSessionEnd}
      />

      <CompletionDialog
        isOpen={showCompletionDialog}
        onClose={() => {
          setShowCompletionDialog(false);
          router.push("/");
        }}
        feedback={feedbackContent}
        isLoading={isGeneratingFeedback}
        caseId={caseId}
        messages={finalMessages}
      />
    </>
  );
}
