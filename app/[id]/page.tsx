"use client";

import { notFound } from "next/navigation";
import React, { useEffect, useState, useRef } from "react";
import type { Case } from "@/features/case-selection/models/case";
import { fetchCaseById } from "@/features/case-selection/services/caseService";
// Removed unused imports (Link, Button, ChevronLeft) to satisfy lint rules.
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { ChatInterface } from "@/features/chat/components/chat-interface";
import { ProgressSidebar } from "@/features/chat/components/progress-sidebar";
import { CompletionDialog } from "@/features/feedback/components/completion-dialog";
import {
  createAttempt,
  completeAttempt,
  getAttemptById,
  deleteAttempt,
} from "@/features/attempts/services/attemptService";
import { useSaveAttempt } from "@/features/attempts/hooks/useSaveAttempt";
import { useAuth } from "@/features/auth/services/authService";
import type { Message } from "@/features/chat/models/chat";
import type { Stage } from "@/features/stages/types";
import {
  getStagesForCase,
  initializeStages,
  markStageCompleted,
} from "@/features/stages/services/stageService";
import { createFollowup } from "@/features/attempts/services/attemptMutationService";
import { useCaseTimepoints } from "@/features/cases/hooks/useCaseTimepoints";
import { GuidedTour } from "@/components/ui/guided-tour";
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

  const tourSteps = [
    { element: '#progress-sidebar', popover: { title: 'Progress Tracker', description: 'Track your progress through the different stages of the consultation (History, Exam, etc.).' } },
    { element: '#chat-interface', popover: { title: 'Chat Interface', description: 'Interact with the virtual client and patient here. Type your questions or actions.' } },
    { element: '#stage-controls', popover: { title: 'Stage Controls', description: 'Use the buttons here to advance to the next stage when you are ready.' } },
  ];

  // Attempt & stages
  const [isCreatingAttempt, setIsCreatingAttempt] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const hasInitializedAttempt = useRef(false);
  const [stages, setStages] = useState<Stage[]>([]);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [isRestoring, setIsRestoring] = useState(true);
  const [resetCounter, setResetCounter] = useState(0);

  const { saveProgress } = useSaveAttempt(attemptId);
  const { user, session, role } = useAuth();

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
    const needsUpdate = stages.slice(0, currentStageIndex).some(stage => !stage.completed);
    
    if (needsUpdate) {
      setStages(prev => {
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
        const active = mod.getActiveStagesForCase
          ? await mod.getActiveStagesForCase(id)
          : mod.getStagesForCase(id);
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

  // Initialize attempt (create or resume) once user is available
  useEffect(() => {
    if (hasInitializedAttempt.current || !user) return;
    hasInitializedAttempt.current = true;

    const existingAttemptId =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("attempt")
        : null;

    if (existingAttemptId) {
      setAttemptId(existingAttemptId);

      // Restore attempt state
      getAttemptById(existingAttemptId).then(({ attempt, messages }) => {
        if (attempt) {
          const lastIndex = attempt.lastStageIndex || 0;
          setCurrentStageIndex(lastIndex);
          // Stage completion synchronization is now handled by a dedicated useEffect
          // to avoid stale closure issues that were causing stages to disappear.
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
      }).catch(err => {
        console.error("Failed to restore attempt", err);
      }).finally(() => {
        setIsRestoring(false);
      });

      return;
    }

    const initializeAttempt = async () => {
      if (attemptId || isCreatingAttempt) return;
      try {
        setIsCreatingAttempt(true);
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
        setIsCreatingAttempt(false);
        setIsRestoring(false);
      }
    };

    initializeAttempt();
  }, [user, id, isCreatingAttempt, attemptId]);

  // Start Over: delete current attempt and create a fresh one
  const handleStartOver = async () => {
    if (!attemptId) return;
    const ok = window.confirm(
      "Start over? This will erase your current in-progress attempt and start a new one."
    );
    if (!ok) return;

    try {
      // delete on server
      const deleted = await deleteAttempt(attemptId);
      // remove client-side caches related to the attempt
      try {
        localStorage.removeItem(`advanceGuard-${attemptId}`);
      } catch (e) {
        // ignore
      }

      // Reset local UI state
      setAttemptId(null);
      setInitialMessages([]);
      setStages(initializeStages(getStagesForCase(id)));
      setCurrentStageIndex(0);
      // bump resetCounter to force ChatInterface remount and stop any active STT/TTS
      setResetCounter((c) => c + 1);

      // create a fresh attempt
      const newAttempt = await createAttempt(id);
      if (newAttempt) {
        setAttemptId(newAttempt.id);
        const url = new URL(window.location.href);
        url.searchParams.set("attempt", newAttempt.id);
        window.history.replaceState({}, "", url);
        // ensure remount for the new id
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
  const [followupDay, setFollowupDay] = useState<number>(1);
  const { timepoints, loading: timepointsLoading } = useCaseTimepoints(caseItem?.id ?? "");

  const handleProceedToNextStage = async (
    messages?: Message[],
    timeSpentSeconds: number = 0
  ) => {
    if (attemptId && messages && messages.length > 0) {
      try {
        await saveProgress(currentStageIndex, messages, timeSpentSeconds);
      } catch (saveError) {
        console.error(
          "Error saving attempt progress during stage transition:",
          saveError
        );
      }
    }

    if (currentStageIndex < stages.length - 1) {
      setStages(markStageCompleted(stages, currentStageIndex));
      const nextIndex = currentStageIndex + 1;
      setCurrentStageIndex(nextIndex);
    } else {
      setStages(markStageCompleted(stages, currentStageIndex));
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
              console.error(
                "Error marking attempt as completed:",
                completeError
              );
            }
          }
        } catch (error) {
          console.error("Error generating feedback:", error);
          setFeedbackContent(
            "<p>Unable to generate feedback at this time.</p>"
          );
        } finally {
          setIsGeneratingFeedback(false);
        }
      } else {
        setShowCompletionDialog(true);
        setFeedbackContent(
          "<p>Examination completed! You've finished all stages.</p>"
        );
        // also capture messages if provided via param
        setLastMessagesForExport(messages ?? null);
        if (attemptId) {
          try {
            await completeAttempt(attemptId, "Examination completed!");
          } catch (completeError) {
            console.error(
              "Error marking attempt as completed (no feedback):",
              completeError
            );
          }
        }
      }
    }
  };

  // Helper: derive display stages based on followup day
  function deriveDisplayStages(baseStages: Stage[], day: number): Stage[] {
    if (!day || day <= 1) return baseStages;
    // For follow-up days, duplicate relevant stages and prefix the title to indicate the day
    const followupSuffix = `-followup-day-${day}`;
    const duplicated = baseStages.map((s) => {
      const copy = { ...s } as Stage & { id?: string };
      // Ensure a unique id for the duplicated stage
      copy.id = `${s.id ?? s.title}-${followupSuffix}`;
      copy.title = `Day ${day} - ${s.title}`;
      copy.completed = false;
      return copy;
    });
    return duplicated;
  }

  const SHOW_RAG = process.env.NEXT_PUBLIC_SHOW_RAG === "true";
  if (loading || isRestoring) return <div className="p-8 text-center">Loading case...</div>;
  if (!caseItem) return notFound();

  return (
    <div className="flex h-[calc(100vh-1rem)] overflow-hidden rounded-lg border shadow-sm relative">
      {/* Guided tour is provided inside the chat interface; avoid duplicate button here */}
      {isMobile && (
        <button
          onClick={() => setShowSidebar(!showSidebar)}
          className="absolute left-4 top-4 z-50 rounded-md bg-primary p-2 text-primary-foreground"
        >
          {showSidebar ? "Hide Stages" : "Show Stages"}
        </button>
      )}

      <div id="progress-sidebar" className={`${showSidebar ? "block" : "hidden"} w-64 md:block`}>
        <ProgressSidebar
          caseItem={caseItem}
          stages={stages}
          currentStageIndex={currentStageIndex}
          onStageSelect={(i: number) => setCurrentStageIndex(i)}
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
        {/* Follow-up Day selector (only show when case has timepoints/time progression enabled) */}
        {timepoints && timepoints.length > 0 && (
          <div className="p-3 flex items-center gap-3">
            <span className="text-sm text-gray-500">Session:</span>
            <select
              value={String(followupDay)}
              onChange={async (e) => {
                const next = Number(e.target.value || 1);
                // Only create followup records when switching to day > 1
                if (next > 1 && attemptId) {
                  try {
                    await createFollowup(attemptId, next, `Follow-up day ${next} started`);
                  } catch (err) {
                    console.error("Failed to create followup record:", err);
                  }
                }
                setFollowupDay(next);
              }}
              className="rounded px-2 py-1 border"
            >
              <option value="1">Day 1</option>
              <option value="2">Day 2</option>
              <option value="3">Day 3</option>
            </select>
            <span className="text-sm text-gray-400">{timepoints.length} timepoints</span>
            {attemptId && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleStartOver}
                className="ml-auto"
              >
                Start Over
              </Button>
            )}
          </div>
        )}

        <ChatInterface
          key={`${attemptId ?? 'noattempt'}-${resetCounter}`}
          caseId={caseItem.id}
          attemptId={attemptId || undefined}
          initialMessages={initialMessages}
          currentStageIndex={currentStageIndex}
          stages={deriveDisplayStages(stages, followupDay)}
          onProceedToNextStage={handleProceedToNextStage}
          caseMedia={caseItem.media}
          followupDay={followupDay}
        />
      </div>

      <CompletionDialog
        isOpen={showCompletionDialog}
        onClose={() => setShowCompletionDialog(false)}
        feedback={feedbackContent}
        isLoading={isGeneratingFeedback}
        caseId={caseItem.id.replace("case-", "")}
        messages={lastMessagesForExport ?? []}
      />
    </div>
  );
}
