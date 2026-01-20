"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { deleteAttempt } from "@/features/attempts/services/attemptService";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { AttemptConversationTab } from "@/features/attempts/components/attempt-conversation-tab";
import { AttemptFeedbackTab } from "@/features/attempts/components/attempt-feedback-tab";
import { CaseCard } from "@/features/case-selection/components/case-card";
import { ProfileCard } from "@/features/profile/ProfileCard";

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
  const [studentProfile, setStudentProfile] = useState<SimpleProfile | null>(
    null
  );
  const [professorProfile, setProfessorProfile] =
    useState<SimpleProfile | null>(null);

  const unreadFeedbackCount =
    feedback && feedback.length > 0 && attempt
      ? feedback.filter((f) => {
          if (!attempt.feedbackReadAt) return true;
          try {
            return new Date(f.createdAt) > new Date(attempt.feedbackReadAt!);
          } catch {
            return true;
          }
        }).length
      : 0;

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
          .select(`*, attempt_messages (*), attempt_feedback (*), cases (*)`)
          .eq("id", attemptId)
          .maybeSingle();

        if (error || !data) {
          console.error("Failed to load attempt:", error);
          router.push("/attempts");
          return;
        }

        const transformedAttempt = transformAttempt(data);
        setAttempt(transformedAttempt);
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

        // Load student & professor profile information (best-effort)
        try {
          const userId = data.user_id as string | undefined;

          if (userId) {
            const [{ data: studentRow }, { data: professorRel }] =
              await Promise.all([
                supabase
                  .from("profiles")
                  .select("id, user_id, email, full_name, avatar_url, role")
                  .eq("user_id", userId)
                  .maybeSingle(),
                supabase
                  .from("professor_students")
                  .select("professor_id")
                  .eq("student_id", userId)
                  .maybeSingle(),
              ]);

            if (studentRow) {
              setStudentProfile({
                id: studentRow.id,
                email: studentRow.email ?? null,
                fullName: studentRow.full_name ?? null,
                avatarUrl: studentRow.avatar_url ?? null,
                role: studentRow.role ?? null,
              });
            } else {
              setStudentProfile(null);
            }

            const { data: professorRow } = await supabase
              .from("profiles")
              .select("id, user_id, email, full_name, avatar_url, role")
              .eq("user_id", professorRel?.professor_id)
              .maybeSingle();

            setProfessorProfile({
              id: professorRow?.id,
              email: professorRow?.email ?? null,
              fullName: professorRow?.full_name ?? null,
              avatarUrl: professorRow?.avatar_url ?? null,
              role: professorRow?.role ?? "professor",
            });
          } else {
            setStudentProfile(null);
            setProfessorProfile(null);
          }
        } catch (profileError) {
          console.warn(
            "Failed to load student/professor profiles",
            profileError
          );
        }
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
    if (activeTab !== "feedback") return;
    if (!attempt) return;
    if (!unreadFeedbackCount || unreadFeedbackCount === 0) return;

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
  }, [activeTab, attempt, unreadFeedbackCount]);

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

      {/* Header cards */}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] gap-6 mb-8">
        <div className="">
          <div className="flex justify-between items-start mb-2">
            <div className="">
              <div className="text-2xl font-bold tracking-tight text-primary">
                {attempt.title}
              </div>
              <p className="text-sm text-muted-foreground">
                Id: <span className="font-mono text-xs">{attempt.id}</span>
              </p>
            </div>
            <Badge
              className={`text-xs py-1 px-3 tracking-wide ${
                attempt.completionStatus === "completed"
                  ? "bg-emerald-500 text-white"
                  : attempt.completionStatus === "in_progress"
                  ? "bg-amber-500 text-black"
                  : "bg-red-500 text-white"
              }`}
            >
              {attempt.completionStatus === "completed"
                ? "Completed"
                : attempt.completionStatus === "in_progress"
                ? "In Progress"
                : "Abandoned"}
            </Badge>
          </div>

          <div className="flex mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeleteAttempt}
              disabled={isDeleting}
              className="flex items-center gap-2 text-destcructive"
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
          {(studentProfile || professorProfile) && (
            <div className="grid gap-3 md:grid-cols-2 mb-6">
              {studentProfile && <ProfileCard profile={studentProfile} />}
              {professorProfile && <ProfileCard profile={professorProfile} />}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-2 h-full transition-all duration-300 ease-out hover:bg-muted/100 dark:hover:bg-muted/80 shadow-lg bg-muted/50 border border-transparent border-teal-500/30">
              <CardHeader className="pb-1 grow text-center px-3">
                <CardTitle className="text-sm font-medium text-muted-foreground text-teal-600">
                  Started
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2 px-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col text-xs">
                    <span>{formatDate(attempt.createdAt)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="p-2 h-full transition-all duration-300 ease-out hover:bg-muted/100 dark:hover:bg-muted/80 shadow-lg bg-muted/50 border border-transparent border-teal-500/30">
              <CardHeader className="pb-1 grow text-center px-3">
                <CardTitle className="text-sm font-medium text-muted-foreground text-teal-600">
                  Completed
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2 px-3">
                {attempt.completedAt && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col text-xs">
                      <span>{formatDate(attempt.completedAt)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="p-2 h-full transition-all duration-300 ease-out hover:bg-muted/100 dark:hover:bg-muted/80 shadow-lg bg-muted/50 border border-transparent border-teal-500/30">
              <CardHeader className="pb-1 grow text-center px-3">
                <CardTitle className="text-sm font-medium text-muted-foreground text-teal-600">
                  Time Spent
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2 px-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col text-xs">
                    <span>{formatTimeSpent(attempt.timeSpentSeconds)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {attemptCase && (
          <CaseCard key={attemptCase.id} caseItem={attemptCase} />
        )}
      </div>

      {/* Tabs + content container */}
      <Card className="w-full bg-card border shadow-sm">
        <CardHeader className="border-b pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex space-x-2 items-center">
              <button
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === "conversation"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
                onClick={() => setActiveTab("conversation")}
              >
                Conversation
              </button>
              <button
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeTab === "feedback"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
                onClick={() => setActiveTab("feedback")}
              >
                <span>Feedback</span>
                {unreadFeedbackCount > 0 && (
                  <Badge className="text-[10px] py-0.5 px-2 bg-amber-500 text-amber-950">
                    {unreadFeedbackCount} new
                  </Badge>
                )}
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {/* Conversation content */}
          {activeTab === "conversation" && (
            <AttemptConversationTab
              messages={messages}
              stages={stages}
              createdAt={attempt.createdAt}
            />
          )}

          {/* Feedback content */}
          {activeTab === "feedback" && (
            <AttemptFeedbackTab
              attempt={attempt}
              feedback={feedback}
              stages={stages}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
