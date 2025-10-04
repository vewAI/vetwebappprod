"use client";

import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useSearchParams } from "next/navigation";
import { fetchCaseById } from "@/features/case-selection/services/caseService";
import type { Case } from "@/features/case-selection/models/case";
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

export default function Case1Page() {
  // Hardcode the case ID for this specific page
  const caseId = "case-1";
  const [caseItem, setCaseItem] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCase() {
      setLoading(true);
      const result = await fetchCaseById(caseId);
      setCaseItem(result);
      setLoading(false);
    }
    loadCase();
  }, [caseId]);
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const [isMobile, setIsMobile] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [isCreatingAttempt, setIsCreatingAttempt] = useState(false);

  // Use our custom hook for saving attempt progress
  const { saveProgress } = useSaveAttempt(attemptId);

  // Use a ref to track if we've already tried to create an attempt
  const hasInitializedAttempt = useRef(false);

  // Initialise stages
  const [stages, setStages] = useState<Stage[]>(() => {
    const caseStages = getStagesForCase(caseId);
    return initializeStages(caseStages);
  });

  // Add a function to handle selecting a specific stage
  const handleStageSelect = (index: number) => {
    setCurrentStageIndex(index);
  };

  // Check for an existing attempt ID in the URL or create a new one
  useEffect(() => {
    // Skip if we've already initialized an attempt or if there's no user
    if (hasInitializedAttempt.current || !user) return;

    // Mark that we've tried to initialize an attempt
    hasInitializedAttempt.current = true;

    // Check if there's an attempt ID in the URL
    const existingAttemptId = searchParams.get("attempt");
    if (existingAttemptId) {
      console.log("Using existing attempt ID from URL:", existingAttemptId);
      setAttemptId(existingAttemptId);
      return;
    }

    // Otherwise create a new attempt
    const initializeAttempt = async () => {
      if (attemptId || isCreatingAttempt) return;

      try {
        setIsCreatingAttempt(true);
        console.log("Creating new attempt for case:", caseId);
        const attempt = await createAttempt(caseId);

        if (attempt) {
          console.log("New attempt created:", attempt.id);
          setAttemptId(attempt.id);

          // Add the attempt ID to the URL without causing a navigation
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
  }, [user, caseId, attemptId, isCreatingAttempt, searchParams]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      setShowSidebar(window.innerWidth >= 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  // State for tracking loading state during feedback generation
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [feedbackContent, setFeedbackContent] = useState("");

  // Check for reset parameter and reset the state if present
  useEffect(() => {
    const reset = searchParams.get("reset");
    if (reset === "true") {
      // Reset to initial state
      setCurrentStageIndex(0);
      const caseStages = getStagesForCase(caseId);
      setStages(initializeStages(caseStages));
      setShowCompletionDialog(false);
      setFeedbackContent("");

      // Remove the reset parameter from the URL to prevent resetting on refresh
      const url = new URL(window.location.href);
      url.searchParams.delete("reset");
      window.history.replaceState({}, "", url);
    }
  }, [searchParams, caseId]);

  if (loading) {
    return <div className="p-8 text-center">Loading case...</div>;
  }
  if (!caseItem) {
    console.error(`Case with ID "${caseId}" not found`);
    return (
      <div className="p-8 text-center">
        Case not found. Please check that the case exists in your data.
      </div>
    );
  }

  // Update the initialMessages to include the first stage transition message
  const initialMessages: Message[] = [];

  // Update the handleProceedToNextStage function to add a transition message and handle completion
  const handleProceedToNextStage = async (
    messages?: Message[],
    timeSpentSeconds: number = 0
  ) => {
    // Save progress if we have messages
    if (attemptId && messages && messages.length > 0) {
      try {
        console.log(
          "Automatically saving progress before stage transition:",
          attemptId
        );
        await saveProgress(currentStageIndex, messages, timeSpentSeconds);
      } catch (saveError) {
        console.error(
          "Error saving attempt progress during stage transition:",
          saveError
        );
      }
    }
    if (currentStageIndex < stages.length - 1) {
      // Mark current stage as completed
      setStages(markStageCompleted(stages, currentStageIndex));

      // Move to next stage
      const nextStageIndex = currentStageIndex + 1;
      setCurrentStageIndex(nextStageIndex);
    } else {
      // Handle completion of the final stage
      setStages(markStageCompleted(stages, currentStageIndex));

      // Generate overall feedback if we have messages
      if (messages && messages.length > 0) {
        try {
          setIsGeneratingFeedback(true);
          setShowCompletionDialog(true);

          // Call the API to generate feedback
          const response = await axios.post("/api/overall-feedback", {
            caseId: caseId,
            messages: messages,
          });

          // Set the feedback content
          setFeedbackContent(response.data.feedback);

          // Mark the attempt as completed in the database
          if (attemptId) {
            try {
              console.log("Marking attempt as completed:", attemptId);
              await completeAttempt(attemptId, response.data.feedback);
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
            "<p>Unable to generate feedback at this time. Please try again later.</p>"
          );
        } finally {
          setIsGeneratingFeedback(false);
        }
      } else {
        // Fallback if no messages are available
        setShowCompletionDialog(true);
        setFeedbackContent(
          "<p>Examination completed! You've finished all stages.</p>"
        );

        // Mark the attempt as completed in the database even without feedback
        if (attemptId) {
          try {
            console.log(
              "Marking attempt as completed (no feedback):",
              attemptId
            );
            await completeAttempt(attemptId, "Examination completed!");
          } catch (completeError) {
            console.error("Error marking attempt as completed:", completeError);
          }
        }
      }
    }
  };

  // Update the return statement to pass the new props
  return (
    <div className="flex h-[calc(100vh-1rem)] overflow-hidden rounded-lg border shadow-sm">
      {/* Mobile toggle for sidebar */}
      {isMobile && (
        <button
          onClick={() => setShowSidebar(!showSidebar)}
          className="absolute left-4 top-4 z-50 rounded-md bg-primary p-2 text-primary-foreground"
        >
          {showSidebar ? "Hide Stages" : "Show Stages"}
        </button>
      )}

      {/* Progress sidebar */}
      <div className={`${showSidebar ? "block" : "hidden"} w-64 md:block`}>
        <ProgressSidebar
          caseItem={caseItem}
          stages={stages}
          currentStageIndex={currentStageIndex}
          onStageSelect={handleStageSelect}
        />
      </div>

      {/* Chat interface */}
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

      {/* Completion Dialog */}
      <CompletionDialog
        isOpen={showCompletionDialog}
        onClose={() => setShowCompletionDialog(false)}
        feedback={feedbackContent}
        isLoading={isGeneratingFeedback}
        caseId={caseId.replace("case-", "")}
      />
    </div>
  );
}
