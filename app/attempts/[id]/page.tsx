"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { deleteAttempt } from "@/features/attempts/services/attemptService";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronLeft, Clock, Calendar, Trash2 } from "lucide-react";
import { getStagesForCase } from "@/features/stages/services/stageService";
import type {
  Attempt,
  AttemptFeedback,
} from "@/features/attempts/models/attempt";
import type { Message } from "@/features/chat/models/chat";
import type { Stage } from "@/features/stages/types";
import { createClient } from "@supabase/supabase-js";
import {
  transformAttempt,
  transformFeedback,
  transformMessage,
} from "@/features/attempts/mappers/attempt-mappers";
import { Case } from "@/features/case-selection/models/case";
import { mapDbCaseToCase } from "@/features/case-selection/services/caseService";

export default function ViewAttemptPage() {
  const params = useParams();
  const router = useRouter();
  const attemptId = params.id as string;

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [attemptCase, setCase] = useState<Case | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [feedback, setFeedback] = useState<AttemptFeedback[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("conversation");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const loadAttempt = async () => {
      setIsLoading(true);

      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { data, error } = await supabase
          .from("attempts")
          .select(
            `*, attempt_messages (*), attempt_feedback (*), cases (id, title)`
          )
          .eq("id", attemptId)
          .maybeSingle();

        if (error || !data) {
          console.error("Failed to load attempt:", error);
          router.push("/attempts");
          return;
        }

        setAttempt(transformAttempt(data));
        setCase(mapDbCaseToCase(data.cases));
        setMessages((data.attempt_messages || [])?.map(transformMessage));
        setFeedback((data.attempt_feedback || [])?.map(transformFeedback));

        const caseStages = await (async () => {
          try {
            const mod = await import("@/features/stages/services/stageService");

            if (mod.getActiveStagesForCase) {
              return await mod.getActiveStagesForCase(data.caseId);
            }
            return mod.getStagesForCase(data.caseId);
          } catch (e) {
            console.warn("Failed to resolve active stages; falling back", e);
            return getStagesForCase(data.caseId);
          }
        })();
        setStages(caseStages);
      } catch (e) {
        console.error("Failed to load attempt view", e);
        router.push("/attempts");
        return;
      } finally {
        setIsLoading(false);
      }
    };

    loadAttempt();
  }, [attemptId, router]);

  // When user opens the Feedback tab, mark feedback as read for this student
  useEffect(() => {
    console.log("Active tab changed to:", activeTab);
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
        const res = await fetch(
          `/api/attempts/${attempt.id}/feedback/mark-read`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          }
        );
        if (res.ok) {
          // locally reflect change to avoid extra fetch
          setAttempt({ ...attempt, feedbackReadAt: new Date().toISOString() });
        }
      } catch (err) {
        // ignore failures — non-blocking
        console.error("Failed to mark feedback read:", err);
      }
    })();
  }, [activeTab]);

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

  if (!attempt) {
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
            <p className="mt-1 text-muted-foreground">{attemptCase?.title}</p>
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
                      return (
                        new Date(f.createdAt) >
                        new Date(attempt.feedbackReadAt!)
                      );
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
                      The AI is analyzing your performance across all stages.
                      This may take a moment.
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
                <h2 className="text-2xl font-bold mb-4 text-purple-700">
                  Professor Feedback
                </h2>
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
    </div>
  );
}
