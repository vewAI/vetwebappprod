"use client";

import { notFound } from "next/navigation";
import React, { useEffect, useState, useRef } from "react";
import type { Case } from "@/features/case-selection/models/case";
import { fetchCaseById } from "@/features/case-selection/services/caseService";
// Removed unused imports (Link, Button, ChevronLeft) to satisfy lint rules.
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { ChatInterface } from "@/features/chat/components/chat-interface";
import { ProgressSidebar } from "@/features/chat/components/progress-sidebar";
import { CompletionDialog } from "@/features/feedback/components/completion-dialog";
import { createAttempt, completeAttempt, getAttemptById, deleteAttempt } from "@/features/attempts/services/attemptService";
import {
  getSession,
  joinSessionCreateAttempt,
} from "@/features/case-sessions/services/caseSessionService";
import { useSaveAttempt } from "@/features/attempts/hooks/useSaveAttempt";
import { useAuth } from "@/features/auth/services/authService";
import type { Message } from "@/features/chat/models/chat";
import type { Stage } from "@/features/stages/types";
import { getStagesForCase, initializeStages, markStageCompleted } from "@/features/stages/services/stageService";

import CasePapersUploader from "@/features/cases/components/case-papers-uploader";
import { CaseRagManager } from "@/features/cases/components/case-rag-manager";

export default function CaseChatPage() {
  const params = useParams();
  const id = params.id as string;

  const [caseItem, setCaseItem] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);

  // UI state
  const [isMobile, setIsMobile] = useState(false);
  // Hide the left-stage sidebar by default to provide a focused workspace
  const [showSidebar, setShowSidebar] = useState(false);
  // Guided mode: read from localStorage (chat-interface manages the toggle)
  const [guidedMode, setGuidedMode] = useState(false);
  useEffect(() => {
    const check = () => {
      try { setGuidedMode(window.localStorage.getItem("guided-mode") === "true"); } catch {}
    };
    check();
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, []);

  // Attempt & stages
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const hasInitializedAttempt = useRef(false);
  const [stages, setStages] = useState<Stage[]>([]);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [isRestoring, setIsRestoring] = useState(true);
  const [resetCounter, setResetCounter] = useState(0);

  const { saveProgress } = useSaveAttempt(attemptId);
  const {
    user,
    session,
    role,
    loading: authLoading,
    profileLoading,
  } = useAuth();
  const [accessBlocked, setAccessBlocked] = useState(false);
  const [joinSessionError, setJoinSessionError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCase() {
      setLoading(true);
      const result = await fetchCaseById(id);
      setCaseItem(result);
      setLoading(false);
    }
    loadCase();
  }, [id]);

  // Sync stages completion with current progress index
  // This replaces the imperative logic in getAttemptById which suffered from closure staleness
  useEffect(() => {
    if (stages.length === 0) return;

    // Check if any previous stages are not marked as completed
    const needsUpdate = stages.slice(0, currentStageIndex).some((stage) => !stage.completed);

    if (needsUpdate) {
      setStages((prev) => {
        let next = [...prev];
        let changed = false;
        for (let i = 0; i < currentStageIndex; i++) {
          if (!next[i]?.completed) {
            next = markStageCompleted(next, i);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }
  }, [currentStageIndex, stages]);

  // Load active stages (may be filtered by admin toggles)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("@/features/stages/services/stageService");
        const active = mod.getActiveStagesForCase ? await mod.getActiveStagesForCase(id) : mod.getStagesForCase(id);
        if (!cancelled) setStages(initializeStages(active));
      } catch (e) {
        console.warn("Failed to load active stages", e);
        const fallback = getStagesForCase(id);
        if (!cancelled) setStages(initializeStages(fallback));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Initialize attempt (resume, join session, or admin create) once auth is ready
  useEffect(() => {
    if (authLoading || profileLoading || !user || hasInitializedAttempt.current)
      return;

    const params = new URLSearchParams(window.location.search);
    const existingAttemptId = params.get("attempt");
    const sessionIdParam = params.get("session");
    const isAdmin = role === "admin";

    if (existingAttemptId) {
      hasInitializedAttempt.current = true;
      setAttemptId(existingAttemptId);

      getAttemptById(existingAttemptId)
        .then(({ attempt, messages }) => {
          if (attempt) {
            const lastIndex = attempt.lastStageIndex || 0;
            setCurrentStageIndex(lastIndex);
          }

          if (messages) {
            const mappedMessages: Message[] = messages.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              timestamp: m.timestamp,
              stageIndex: m.stageIndex,
              displayRole: m.displayRole,
              status: "sent",
            }));
            setInitialMessages(mappedMessages);
          }
        })
        .catch((err) => {
          console.error("Failed to restore attempt", err);
        })
        .finally(() => {
          setIsRestoring(false);
        });

      return;
    }

    if (!sessionIdParam && !isAdmin) {
      hasInitializedAttempt.current = true;
      setAccessBlocked(true);
      setIsRestoring(false);
      return;
    }

    if (sessionIdParam) {
      hasInitializedAttempt.current = true;
      (async () => {
        try {
          setJoinSessionError(null);
          const attempt = await joinSessionCreateAttempt(sessionIdParam);
          if (attempt) {
            setAttemptId(attempt.id);
            const url = new URL(window.location.href);
            url.searchParams.set("attempt", attempt.id);
            url.searchParams.set("session", sessionIdParam);
            window.history.replaceState({}, "", url);
          }
        } catch (error) {
          console.error("Error joining session / creating attempt:", error);
          setJoinSessionError(
            error instanceof Error ? error.message : "Could not join session"
          );
        } finally {
          setIsRestoring(false);
        }
      })();
      return;
    }

    hasInitializedAttempt.current = true;
    (async () => {
      try {
        const attempt = await createAttempt(id);
        if (attempt) {
          setAttemptId(attempt.id);
          const url = new URL(window.location.href);
          url.searchParams.set("attempt", attempt.id);
          window.history.replaceState({}, "", url);
        }
      } catch (error) {
        console.error("Error creating attempt:", error);
      } finally {
        setIsRestoring(false);
      }
    })();
  }, [authLoading, profileLoading, user, role, id]);

  // Start Over: delete current attempt and create a fresh one
  const handleStartOver = async () => {
    if (!attemptId) return;
    const ok = window.confirm("Start over? This will erase your current in-progress attempt and start a new one.");
    if (!ok) return;

    try {
      // delete on server
      await deleteAttempt(attemptId);
      // remove client-side caches related to the attempt
      try {
        localStorage.removeItem(`advanceGuard-${attemptId}`);
      } catch {
        // ignore
      }

      // Reset local UI state
      setAttemptId(null);
      setInitialMessages([]);
      try {
        const mod = await import("@/features/stages/services/stageService");
        const active = mod.getActiveStagesForCase ? await mod.getActiveStagesForCase(id) : mod.getStagesForCase(id);
        setStages(initializeStages(active));
      } catch {
        setStages(initializeStages(getStagesForCase(id)));
      }
      setCurrentStageIndex(0);
      // bump resetCounter to force ChatInterface remount and stop any active STT/TTS
      setResetCounter((c) => c + 1);

      const urlParams = new URLSearchParams(window.location.search);
      const sessionIdParam = urlParams.get("session");

      let newAttempt = null;
      if (sessionIdParam) {
        try {
          const sess = await getSession(sessionIdParam);
          let code: string | undefined;
          if (sess.accessCode?.trim()) {
            const entered = window.prompt(
              "This session requires an access code. Enter it to start again:"
            );
            code = entered ?? undefined;
          }
          newAttempt = await joinSessionCreateAttempt(sessionIdParam, code);
        } catch (e) {
          console.error("Start over via session failed:", e);
          alert(
            e instanceof Error ? e.message : "Could not start a new attempt for this session."
          );
        }
      } else if (role === "admin") {
        newAttempt = await createAttempt(id);
      } else {
        alert("Cannot start over without a session. Return to the case page and join a session.");
      }

      if (newAttempt) {
        setAttemptId(newAttempt.id);
        const url = new URL(window.location.href);
        url.searchParams.set("attempt", newAttempt.id);
        if (sessionIdParam) url.searchParams.set("session", sessionIdParam);
        window.history.replaceState({}, "", url);
        setResetCounter((c) => c + 1);
      }
    } catch (err) {
      console.error("Start over failed:", err);
      // best-effort: leave UI in a sensible state
    }
  };

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      // Do not auto-toggle sidebar on resize — keep it hidden by default
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Completion / feedback state
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [feedbackContent, setFeedbackContent] = useState("");
  const [lastMessagesForExport, setLastMessagesForExport] = useState<Message[] | null>(null);

  const handleProceedToNextStage = async (messages?: Message[], timeSpentSeconds: number = 0) => {
    const stageIndexAtTransition = currentStageIndex;
    const hasNextStage = stageIndexAtTransition < stages.length - 1;

    // Optimistically update UI first so sidebar stage label switches immediately.
    if (hasNextStage) {
      setStages(markStageCompleted(stages, stageIndexAtTransition));
      setCurrentStageIndex(stageIndexAtTransition + 1);
    }

    if (attemptId && messages && messages.length > 0) {
      try {
        await saveProgress(stageIndexAtTransition, messages, timeSpentSeconds);
      } catch (saveError) {
        console.error("Error saving attempt progress during stage transition:", saveError);
      }
    }

    if (!hasNextStage) {
      setStages(markStageCompleted(stages, stageIndexAtTransition));
      if (messages && messages.length > 0) {
        // keep a copy of the messages so the completion dialog can export them
        setLastMessagesForExport(messages);
        try {
          setIsGeneratingFeedback(true);
          setShowCompletionDialog(true);
          if (!session?.access_token) {
            console.error("Cannot request overall feedback without auth token");
            setIsGeneratingFeedback(false);
            return;
          }
          const feedbackHeaders: Record<string, string> = {
            "Content-Type": "application/json",
          };
          feedbackHeaders.Authorization = `Bearer ${session.access_token}`;
          const resp = await fetch("/api/overall-feedback", {
            method: "POST",
            headers: feedbackHeaders,
            body: JSON.stringify({ caseId: id, messages }),
          });
          const data = await resp.json();
          setFeedbackContent(data.feedback || "");
          if (attemptId) {
            try {
              await completeAttempt(attemptId, data.feedback || "");
            } catch (completeError) {
              console.error("Error marking attempt as completed:", completeError);
            }
          }
        } catch (error) {
          console.error("Error generating feedback:", error);
          setFeedbackContent("<p>Unable to generate feedback at this time.</p>");
        } finally {
          setIsGeneratingFeedback(false);
        }
      } else {
        setShowCompletionDialog(true);
        setFeedbackContent("<p>Examination completed! You've finished all stages.</p>");
        // also capture messages if provided via param
        setLastMessagesForExport(messages ?? null);
        if (attemptId) {
          try {
            await completeAttempt(attemptId, "Examination completed!");
          } catch (completeError) {
            console.error("Error marking attempt as completed (no feedback):", completeError);
          }
        }
      }
    }
  };



  const SHOW_RAG = process.env.NEXT_PUBLIC_SHOW_RAG === "true";
  if (accessBlocked) {
    return (
      <div className="p-8 text-center max-w-lg mx-auto space-y-4">
        <p className="text-lg">
          Open this case from the instructions page and start an attempt from an{" "}
          <strong>active session</strong>.
        </p>
        <Button asChild>
          <Link href={`/case/${id}/instructions`}>Back to case instructions</Link>
        </Button>
      </div>
    );
  }

  if (joinSessionError) {
    return (
      <div className="p-8 text-center max-w-lg mx-auto space-y-4">
        <p className="text-destructive font-medium">{joinSessionError}</p>
        <p className="text-sm text-muted-foreground">
          If this session requires a code, start from the case instructions page and use{" "}
          <strong>Start case</strong> on the session.
        </p>
        <Button asChild>
          <Link href={`/case/${id}/instructions`}>Back to case instructions</Link>
        </Button>
      </div>
    );
  }
  if (loading || authLoading || profileLoading || isRestoring)
    return <div className="p-8 text-center">Loading case...</div>;
  if (!caseItem) return notFound();

  return (
    <div className="flex h-[calc(100vh)] overflow-hidden relative">
      {/* Guided tour is provided inside the chat interface; avoid duplicate button here */}
      {isMobile && (
        <button onClick={() => setShowSidebar(!showSidebar)} className="absolute left-4 top-4 z-50 rounded-md bg-primary p-2 text-primary-foreground">
          {showSidebar ? "Hide Stages" : "Show Stages"}
        </button>
      )}

      <div id="progress-sidebar" className={`${showSidebar ? "block" : "hidden"} w-64 md:block`}>
        <ProgressSidebar
          caseItem={caseItem}
          stages={stages}
          currentStageIndex={currentStageIndex}
          onStageSelect={(i: number) => setCurrentStageIndex(i)}
          guidedMode={guidedMode}
        />
      </div>

      <div id="chat-interface" className="flex-1 flex flex-col overflow-hidden">
        {/* Professor uploader + Papers list */}
        {SHOW_RAG && user && (role === "professor" || role === "admin") && caseItem?.id && (
          <div className="p-3 border-b bg-gray-50 dark:bg-gray-900 flex justify-end">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="dark:text-white dark:border-white/50 dark:hover:bg-white/10 dark:bg-slate-800">
                  📄 View RAG Report / Manage Knowledge
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Case Knowledge Base (RAG)</DialogTitle>
                  <DialogDescription>
                    Upload PDF references and view the extracted knowledge chunks that the AI uses to answer questions.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  <div className="border rounded p-4">
                    <h3 className="font-semibold mb-2">1. Upload Reference Papers</h3>
                    <CasePapersUploader
                      caseId={caseItem.id}
                      onUploaded={async () => {
                        try {
                          const refreshed = await fetchCaseById(caseItem.id);
                          setCaseItem(refreshed);
                        } catch (err) {
                          console.error("Failed to refresh case after paper upload", err);
                        }
                      }}
                    />
                  </div>
                  <div className="border rounded p-4">
                    <h3 className="font-semibold mb-2">2. Inspect Knowledge Chunks</h3>
                    <CaseRagManager caseId={caseItem.id} />
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
        {attemptId && (
          <div className="p-3 flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleStartOver} className="ml-auto">
              Start Over
            </Button>
          </div>
        )}

        <ChatInterface
          key={`${attemptId ?? "noattempt"}-${resetCounter}`}
          caseId={caseItem.id}
          attemptId={attemptId || undefined}
          initialMessages={initialMessages}
          currentStageIndex={currentStageIndex}
          stages={stages}
          onProceedToNextStage={handleProceedToNextStage}
          caseMedia={caseItem.media}
          species={caseItem.species}
          isAttemptCompleting={Boolean(isGeneratingFeedback || showCompletionDialog)}
        />
      </div>

      <CompletionDialog
        isOpen={showCompletionDialog}
        onClose={() => setShowCompletionDialog(false)}
        feedback={feedbackContent}
        isLoading={isGeneratingFeedback}
        caseId={caseItem.id}
        messages={lastMessagesForExport ?? []}
      />
    </div>
  );
}
