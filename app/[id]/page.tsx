"use client";

import { notFound } from "next/navigation";
import React, { useEffect, useState, useRef } from "react";
import type { Case } from "@/features/case-selection/models/case";
import { fetchCaseById } from "@/features/case-selection/services/caseService";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { useParams } from "next/navigation";

import { ChatInterface } from "@/features/chat/components/chat-interface";
import { ProgressSidebar } from "@/features/chat/components/progress-sidebar";
import { CompletionDialog } from "@/features/feedback/components/completion-dialog";
import {
  createAttempt,
  completeAttempt,
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

export default function CaseChatPage() {
  const params = useParams();
  const id = params.id as string;

  const [caseItem, setCaseItem] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);

  // UI state
  const [isMobile, setIsMobile] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  // Attempt & stages
  const [isCreatingAttempt, setIsCreatingAttempt] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const hasInitializedAttempt = useRef(false);
  const [stages, setStages] = useState<Stage[]>(() => {
    const caseStages = getStagesForCase(id);
    return initializeStages(caseStages);
  });
  const [currentStageIndex, setCurrentStageIndex] = useState(0);

  const { saveProgress } = useSaveAttempt(attemptId);
  const { user } = useAuth();

  useEffect(() => {
    async function loadCase() {
      setLoading(true);
      const result = await fetchCaseById(id);
      setCaseItem(result);
      setLoading(false);
    }
    loadCase();
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
      }
    };

    initializeAttempt();
  }, [user, id, isCreatingAttempt, attemptId]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      setShowSidebar(window.innerWidth >= 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Completion / feedback state
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [feedbackContent, setFeedbackContent] = useState("");

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
        try {
          setIsGeneratingFeedback(true);
          setShowCompletionDialog(true);
          const resp = await fetch("/api/overall-feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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

  if (loading) return <div className="p-8 text-center">Loading case...</div>;
  if (!caseItem) return notFound();

  const initialMessages: Message[] = [];

  return (
    <div className="flex h-[calc(100vh-1rem)] overflow-hidden rounded-lg border shadow-sm">
      {isMobile && (
        <button
          onClick={() => setShowSidebar(!showSidebar)}
          className="absolute left-4 top-4 z-50 rounded-md bg-primary p-2 text-primary-foreground"
        >
          {showSidebar ? "Hide Stages" : "Show Stages"}
        </button>
      )}

      <div className={`${showSidebar ? "block" : "hidden"} w-64 md:block`}>
        <ProgressSidebar
          caseItem={caseItem}
          stages={stages}
          currentStageIndex={currentStageIndex}
          onStageSelect={(i: number) => setCurrentStageIndex(i)}
        />
      </div>

      <div className="flex-1">
        <ChatInterface
          caseId={caseItem.id}
          attemptId={attemptId || undefined}
          initialMessages={initialMessages}
          currentStageIndex={currentStageIndex}
          stages={stages}
          onProceedToNextStage={handleProceedToNextStage}
        />
      </div>

      <CompletionDialog
        isOpen={showCompletionDialog}
        onClose={() => setShowCompletionDialog(false)}
        feedback={feedbackContent}
        isLoading={isGeneratingFeedback}
        caseId={caseItem.id.replace("case-", "")}
      />
    </div>
  );
}
