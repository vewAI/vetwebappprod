"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  getAttemptById,
  deleteAttempt,
  saveAttemptProgress,
  completeAttempt,
  updateAttemptTime,
} from "@/features/attempts/services/attemptService";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronLeft, Clock, Calendar, Trash2 } from "lucide-react";
import { fetchCaseById } from "@/features/case-selection/services/caseService";
import type { Case } from "@/features/case-selection/models/case";
import { getStagesForCase } from "@/features/stages/services/stageService";
import type {
  Attempt,
  AttemptFeedback,
} from "@/features/attempts/models/attempt";
import type { Message } from "@/features/chat/models/chat";
import type { Stage } from "@/features/stages/types";
import { ChatInterface } from "@/features/chat/components/chat-interface";
import { CaseTimeline } from "@/features/cases/components/case-timeline";
import { supabase } from "@/lib/supabase";

export default function ViewAttemptPage() {
  const params = useParams();
  const router = useRouter();
  const attemptId = params.id as string;

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [feedback, setFeedback] = useState<AttemptFeedback[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("conversation");
  const [isDeleting, setIsDeleting] = useState(false);
  const [missingPersonas, setMissingPersonas] = useState<string[]>([]);

  useEffect(() => {
    if (!attempt?.caseId) return;

    const checkPersonas = async () => {
      const { data: personas } = await supabase
        .from("case_personas")
        .select("role_key")
        .eq("case_id", attempt.caseId);

      const hasOwner = personas?.some((p) => p.role_key === "owner");
      const hasNurse = personas?.some((p) => p.role_key === "veterinary-nurse");

      const missing = [];
      if (!hasOwner) missing.push("Owner");
      if (!hasNurse) missing.push("Nurse");

      if (missing.length > 0) {
        setMissingPersonas(missing);
      }
    };

    checkPersonas();
  }, [attempt]);

  useEffect(() => {
    const loadAttempt = async () => {
      setIsLoading(true);

      const { attempt, messages, feedback } = await getAttemptById(attemptId);

      if (!attempt) {
        router.push("/attempts");
        return;
      }

      setAttempt(attempt);

      // Set messages directly since they already match the Message interface
      setMessages(messages);
      setFeedback(feedback);

      // Load stages for this case
      const caseStages = getStagesForCase(attempt.caseId);
      setStages(caseStages);

      setIsLoading(false);
    };

    loadAttempt();
  }, [attemptId, router]);

  // When user opens the Feedback tab, mark feedback as read for this student
  useEffect(() => {
    if (activeTab !== "feedback") return;
    if (!attempt) return;
    const unread = feedback.filter((f) => {
      if (!attempt.feedbackReadAt) return true;
      try {
        return new Date(f.createdAt) > new Date(attempt.feedbackReadAt!);
      } catch {
        return true;
      }
    }).length;

    if (unread === 0) return;

    // mark as read (best-effort)
    (async () => {
      try {
        const res = await fetch(`/api/attempts/${attempt.id}/feedback/mark-read`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (res.ok) {
          // locally reflect change to avoid extra fetch
          setAttempt({ ...attempt, feedbackReadAt: new Date().toISOString() });
        }
      } catch (err) {
        // ignore failures — non-blocking
        console.error("Failed to mark feedback read:", err);
      }
    })();
  }, [activeTab, attempt, feedback]);

  const [caseItem, setCaseItem] = useState<Case | null>(null);
  const searchParams = useSearchParams();
  const chatMode = Boolean(
    searchParams?.get("chat") === "1" || searchParams?.get("chat") === "true"
  );

  useEffect(() => {
    if (attempt && attempt.caseId) {
      fetchCaseById(attempt.caseId).then(setCaseItem);
    }
  }, [attempt]);

  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Format time spent
  const formatTimeSpent = (seconds: number) => {
    if (seconds < 60) return `${seconds} seconds`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
  };

  const handleDeleteAttempt = async () => {
    if (
      window.confirm(
        "Are you sure you want to delete this attempt? This action cannot be undone."
      )
    ) {
      setIsDeleting(true);
      const success = await deleteAttempt(attemptId);

      if (success) {
        router.push("/attempts");
      } else {
        setIsDeleting(false);
        alert("Failed to delete attempt. Please try again.");
      }
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 flex justify-center items-center h-[70vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
        <span>Loading attempt...</span>
      </div>
    );
  }

  if (!attempt || !caseItem) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p>Attempt not found</p>
        <Link href="/attempts">
          <Button className="mt-4">Back to Attempts</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/attempts">
          <Button variant="outline" size="sm">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Attempts
          </Button>
        </Link>
      </div>

      <header className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">
              {attempt.title}
            </h1>
            <p className="mt-1 text-muted-foreground">{caseItem.title}</p>
          </div>

          <Badge
            className={`text-sm py-1 px-3 ${
              attempt.completionStatus === "completed"
                ? "bg-green-500"
                : attempt.completionStatus === "in_progress"
                ? "bg-amber-500"
                : "bg-red-500"
            } text-white`}
          >
            {attempt.completionStatus === "completed"
              ? "Completed"
              : attempt.completionStatus === "in_progress"
              ? "In Progress"
              : "Abandoned"}
          </Badge>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>Created: {formatDate(attempt.createdAt)}</span>
          </div>
          {attempt.completedAt && (
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Completed: {formatDate(attempt.completedAt)}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>Time spent: {formatTimeSpent(attempt.timeSpentSeconds)}</span>
          </div>
        </div>
      </header>

      <div className="w-full">
        {/* Tab buttons and delete button */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex space-x-2 items-center">
            <button
              className={`px-4 py-2 rounded-md ${
                activeTab === "conversation"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
              onClick={() => setActiveTab("conversation")}
            >
              Conversation
            </button>
            <button
              className={`px-4 py-2 rounded-md ${
                activeTab === "feedback"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
              onClick={() => setActiveTab("feedback")}
            >
              <div className="flex items-center gap-2">
                <span>Feedback</span>
                {(() => {
                  const unreadCount = feedback.filter((f) => {
                    if (!attempt?.feedbackReadAt) return true;
                    try {
                      return new Date(f.createdAt) > new Date(attempt.feedbackReadAt!);
                    } catch {
                      return true;
                    }
                  }).length;

                  return unreadCount > 0 ? (
                    <Badge className="text-xs py-0.5 px-2">{unreadCount}</Badge>
                  ) : null;
                })()}
              </div>
            </button>
          </div>

          <Button
            variant="destructive"
            size="sm"
            onClick={handleDeleteAttempt}
            disabled={isDeleting}
            className="flex items-center gap-2"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Delete Attempt
              </>
            )}
          </Button>
        </div>

        {/* Conversation content or interactive chat */}
        {activeTab === "conversation" && (
          <div className="mt-4">
            {(() => {
              if (chatMode) {
                return (
                  <div className="flex flex-col lg:flex-row gap-4 items-start">
                    <div className="flex-1 w-full">
                      <ChatInterface
                    caseId={attempt.caseId}
                    attemptId={attempt.id}
                    initialMessages={messages}
                    currentStageIndex={attempt.lastStageIndex}
                    stages={stages}
                    initialTimeSpentSeconds={attempt.timeSpentSeconds}
                    onProceedToNextStage={async (
                      msgs?: Message[],
                      timeSpentSeconds = 0
                    ) => {
                      try {
                        const currentIndex = attempt.lastStageIndex ?? 0;
                        // If not at final stage, advance
                        if (currentIndex < stages.length - 1) {
                          const nextIndex = currentIndex + 1;
                          // Save progress (updates last_stage_index and messages)
                          await saveAttemptProgress(
                            attempt.id,
                            nextIndex,
                            msgs ?? messages,
                            timeSpentSeconds
                          );
                          // Refresh attempt and messages
                          const {
                            attempt: refreshedAttempt,
                            messages: refreshedMessages,
                          } = await getAttemptById(attempt.id);
                          if (refreshedAttempt) setAttempt(refreshedAttempt);
                          if (refreshedMessages) setMessages(refreshedMessages);
                        } else {
                          // Final stage -> mark completed
                          await completeAttempt(
                            attempt.id,
                            "Examination completed!"
                          );
                          const {
                            attempt: refreshedAttempt,
                            messages: refreshedMessages,
                          } = await getAttemptById(attempt.id);
                          if (refreshedAttempt) setAttempt(refreshedAttempt);
                          if (refreshedMessages) setMessages(refreshedMessages);
                        }
                      } catch (err) {
                        console.error(
                          "Error advancing stage for attempt:",
                          err
                        );
                        // Fallback: reload to ensure UI sync
                        // window.location.reload();
                      }
                    }}
                  />
                    </div>
                    <div className="w-full lg:w-64 shrink-0">
                      <CaseTimeline
                        caseId={attempt.caseId}
                        elapsedSeconds={attempt.timeSpentSeconds}
                        onFastForward={async (targetSeconds) => {
                          if (targetSeconds <= attempt.timeSpentSeconds) return;
                          const success = await updateAttemptTime(attempt.id, targetSeconds);
                          if (success) {
                            // Refresh attempt to update UI
                            const { attempt: updated } = await getAttemptById(attempt.id);
                            if (updated) setAttempt(updated);
                          }
                        }}
                      />
                    </div>
                  </div>
                );
              }

              return messages.length > 0 ? (
                <div className="border rounded-lg p-4 space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`p-4 rounded-lg ${
                        message.role === "user"
                          ? "bg-primary/10 ml-12"
                          : "bg-muted mr-12"
                      }`}
                    >
                      <div className="flex justify-between mb-2">
                        <span className="font-medium">
                          {message.displayRole || message.role}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        {message.content}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-8 border rounded-lg">
                  No conversation history available for this attempt.
                </p>
              );
            })()}
          </div>
        )}

        {/* Feedback content */}
        {activeTab === "feedback" && (
          <div className="mt-4 space-y-6">
            {/* Stage-specific feedback */}
            {feedback.length > 0 ? (
              <div>
                <h2 className="text-2xl font-bold mb-4">Stage Feedback</h2>
                {feedback.map((item) => {
                  const stage = stages[item.stageIndex];
                  const stageName =
                    stage?.title || `Stage ${item.stageIndex + 1}`;

                  return (
                    <div
                      key={item.id}
                      className="border rounded-lg p-6 mb-6 bg-card"
                    >
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-xl font-semibold">
                          {stageName} Feedback
                        </h3>
                        <Badge variant="outline" className="text-xs">
                          {formatDate(item.createdAt)}
                        </Badge>
                      </div>
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <div
                          dangerouslySetInnerHTML={{
                            __html: item.feedbackContent,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="border rounded-lg p-8 text-center bg-muted/30">
                <h3 className="text-lg font-medium mb-2">
                  No Stage Feedback Available
                </h3>
                <p className="text-muted-foreground mb-4">
                  No feedback has been generated for individual stages in this
                  attempt.
                </p>
                {attempt.completionStatus === "in_progress" && (
                  <p className="text-sm">
                    You can generate feedback for each stage by clicking the
                    &quot;Generate Feedback&quot; button during your attempt.
                  </p>
                )}
              </div>
            )}

            {/* Overall feedback */}
            {attempt.overallFeedback ? (
              <div>
                <h2 className="text-2xl font-bold mb-4">Overall Assessment</h2>
                <div className="border rounded-lg p-6 bg-card">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <div
                      dangerouslySetInnerHTML={{
                        __html: attempt.overallFeedback,
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : attempt.completionStatus === "completed" ? (
              <div className="border rounded-lg p-8 text-center bg-muted/30 animate-pulse">
                <div className="flex flex-col items-center justify-center gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <div>
                    <h3 className="text-lg font-medium mb-2">
                      Generating Overall Assessment...
                    </h3>
                    <p className="text-muted-foreground">
                      The AI is analyzing your performance across all stages. This may take a moment.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border rounded-lg p-8 text-center bg-muted/30">
                <h3 className="text-lg font-medium mb-2">
                  No Overall Assessment
                </h3>
                <p className="text-muted-foreground">
                  An overall assessment will be available once you complete this
                  attempt.
                </p>
              </div>
            )}

            {/* Professor Feedback */}
            {attempt.professorFeedback && (
              <div className="mt-8">
                <h2 className="text-2xl font-bold mb-4 text-purple-700">Professor Feedback</h2>
                <div className="border rounded-lg p-6 bg-purple-50 border-purple-200">
                  <div className="prose prose-sm dark:prose-invert max-w-none text-purple-900">
                    {attempt.professorFeedback}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {missingPersonas.length > 0 && (
        <div className="fixed bottom-4 right-4 bg-destructive text-destructive-foreground px-6 py-4 rounded-lg shadow-lg z-50 animate-in slide-in-from-bottom-5 max-w-md border border-destructive/50">
          <div className="flex justify-between items-start gap-4">
            <div>
              <h3 className="font-bold text-lg mb-1">Missing Configuration</h3>
              <p className="text-sm opacity-90">
                This case is missing: <strong>{missingPersonas.join(" & ")}</strong>.
                <br />
                Please contact an administrator to assign personas.
              </p>
            </div>
            <button
              onClick={() => setMissingPersonas([])}
              className="text-destructive-foreground/80 hover:text-destructive-foreground p-1 hover:bg-destructive-foreground/10 rounded"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
