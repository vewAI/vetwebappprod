"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/features/auth/services/authService";
import { deleteAttempt } from "@/features/attempts/services/attemptService";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumb } from "@/features/navigation/components/breadcrumb";
import { DefaultTabs } from "@/features/navigation/components/tabs";
import { Loader2, Clock, Calendar, Trash2, ChevronRight, Info } from "lucide-react";
import { getSession } from "@/features/case-sessions/services/caseSessionService";
import { deriveStatus, type CaseSession } from "@/features/case-sessions/models/caseSession";
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
  const { user, role, isAdmin } = useAuth();
  const attemptId = params.id as string;

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [attemptCase, setCase] = useState<Case | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [feedback, setFeedback] = useState<AttemptFeedback[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"conversation" | "feedback">("conversation");
  const [isDeleting, setIsDeleting] = useState(false);
  const [studentProfile, setStudentProfile] = useState<SimpleProfile | null>(
    null
  );
  const [professorProfile, setProfessorProfile] =
    useState<SimpleProfile | null>(null);
  const [session, setSession] = useState<CaseSession | null>(null);

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
        let loadedSession: CaseSession | null = null;
        if (transformedAttempt.sessionId) {
          try {
            loadedSession = await getSession(transformedAttempt.sessionId);
          } catch (sessionErr) {
            console.warn("Failed to load attempt session", sessionErr);
            loadedSession = null;
          }
        }
        setSession(loadedSession);
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

        // Load student profile and the professor who started the session (best-effort)
        try {
          const userId = data.user_id as string | undefined;
          const creatorId = loadedSession?.createdBy;

          const profileSelect = "id, user_id, email, full_name, avatar_url, role";
          const studentQuery = userId
            ? supabase.from("profiles").select(profileSelect).eq("user_id", userId).maybeSingle()
            : Promise.resolve({ data: null });
          const professorQuery = creatorId
            ? supabase.from("profiles").select(profileSelect).eq("user_id", creatorId).maybeSingle()
            : Promise.resolve({ data: null });

          const [{ data: studentRow }, { data: professorByUserId }] = await Promise.all([
            studentQuery,
            professorQuery,
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

          let professorRow = professorByUserId;
          if (!professorRow && creatorId) {
            const { data: professorById } = await supabase
              .from("profiles")
              .select(profileSelect)
              .eq("id", creatorId)
              .maybeSingle();
            professorRow = professorById;
          }

          if (professorRow) {
            setProfessorProfile({
              id: professorRow.id,
              email: professorRow.email ?? null,
              fullName:
                professorRow.full_name?.trim() ||
                loadedSession?.createdByName ||
                professorRow.email ||
                null,
              avatarUrl: professorRow.avatar_url ?? null,
              role: professorRow.role ?? "professor",
            });
          } else if (creatorId) {
            setProfessorProfile({
              id: creatorId,
              email: null,
              fullName: loadedSession?.createdByName ?? null,
              avatarUrl: null,
              role: "professor",
            });
          } else {
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
    if (role !== "professor" && !isAdmin) return;
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
      <div className="container mx-auto px-4 pb-8">
        <Breadcrumb
          items={[
            { label: "Home", href: "/dashboard" },
            { label: "My Attempts", href: "/attempts" },
            { label: "Attempt" },
          ]}
        />
        <div className="flex h-[70vh] items-center justify-center">
          <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
          <span>Loading attempt...</span>
        </div>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="container mx-auto px-4 pb-8">
        <Breadcrumb
          items={[
            { label: "Home", href: "/dashboard" },
            { label: "My Attempts", href: "/attempts" },
            { label: "Attempt not found" },
          ]}
        />
        <p>Attempt not found</p>
      </div>
    );
  }

  const sessionStatus = session ? deriveStatus(session) : null;
  const canDeleteAttempt = isAdmin || role === "professor";
  const sessionEndedInProgress =
    attempt.completionStatus === "in_progress" && sessionStatus === "completed";
  const canContinueAttempt =
    attempt.completionStatus === "in_progress" &&
    user?.id === attempt.userId &&
    !sessionEndedInProgress;

  return (
    <div className="container mx-auto px-4 pb-8">
      <Breadcrumb
        items={[
          { label: "Home", href: "/dashboard" },
          { label: "My Attempts", href: "/attempts" },
          { label: attempt.title || "Attempt" },
        ]}
      />

      <div className="mb-4 flex items-start justify-between">
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

      {canDeleteAttempt && (
        <div className="mb-4 flex">
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
      )}

      {/* Header cards */}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] gap-6 mb-8">
        <div className="">
          {canContinueAttempt && (
            <Button
              asChild
              size="lg"
              className="mb-4 h-14 w-full bg-brand-100 text-base font-semibold text-brand-700 hover:bg-brand-200 dark:bg-brand-500/12 dark:text-brand-400 dark:hover:bg-brand-500/20"
            >
              <Link
                href={
                  attempt.sessionId
                    ? `/case/${attempt.caseId}/attempt?attempt=${attempt.id}&session=${attempt.sessionId}`
                    : `/case/${attempt.caseId}/attempt?attempt=${attempt.id}`
                }
              >
                Continue Attempt
              </Link>
            </Button>
          )}

          {sessionEndedInProgress && (
            <Card className="mb-4 w-full gap-0 border-brand-200 bg-brand-50 py-0 dark:border-brand-800 dark:bg-brand-500/12">
              <CardContent className="flex items-start gap-2 px-4 py-2">
                <Info className="mt-0.5 size-4 shrink-0 text-brand-700 dark:text-brand-400" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-brand-800 dark:text-brand-300">Session ended</p>
                  <p className="text-xs text-brand-700 dark:text-brand-400">
                    This attempt cannot be completed as the session has now ended.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {session && (
            <Card className="mb-6 w-full">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-primary">{session.friendlyName}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Status</span>
                  <Badge
                    variant={
                      sessionStatus === "active" ? "success" : sessionStatus === "scheduled" ? "warning" : "secondary"
                    }
                    className="capitalize"
                  >
                    {sessionStatus === "active" ? "Active" : sessionStatus === "scheduled" ? "Scheduled" : "Completed"}
                  </Badge>
                </div>
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Calendar className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {formatDate(session.startAt)} — {formatDate(session.endAt)}
                  </span>
                </div>
                <Button className="w-full" asChild>
                  <Link href={`/case-sessions/${session.id}`}>
                    View Session
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

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

        <div className="space-y-6">
          {attemptCase && <CaseCard key={attemptCase.id} caseItem={attemptCase} />}
        </div>
      </div>

      <DefaultTabs
        items={[
          { id: "conversation", label: "Conversation" },
          { id: "feedback", label: "Feedback", badge: unreadFeedbackCount > 0 ? unreadFeedbackCount : undefined },
        ]}
        value={activeTab}
        onChange={setActiveTab}
      >
        {activeTab === "conversation" && (
          <AttemptConversationTab
            messages={messages}
            stages={stages}
            createdAt={attempt.createdAt}
          />
        )}

        {activeTab === "feedback" && (
          <AttemptFeedbackTab
            attempt={attempt}
            feedback={feedback}
            stages={stages}
          />
        )}
      </DefaultTabs>
    </div>
  );
}
