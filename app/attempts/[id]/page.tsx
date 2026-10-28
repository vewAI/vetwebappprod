"use client";

import { useState, useEffect, type ReactNode } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/features/auth/services/authService";
import { deleteAttempt } from "@/features/attempts/services/attemptService";
import { parseAttemptViewFrom, type AttemptViewFrom } from "@/features/attempts/attemptViewHref";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb, type BreadcrumbItem } from "@/features/navigation/components/breadcrumb";
import { DefaultTabs } from "@/features/navigation/components/tabs";
import { Loader2, Trash2, ChevronRight, Info } from "lucide-react";
import { getSession } from "@/features/case-sessions/services/caseSessionService";
import { deriveStatus, type CaseSession } from "@/features/case-sessions/models/caseSession";
import { getStagesForCase } from "@/features/stages/services/stageService";
import type {
  Attempt,
  AttemptFeedback,
} from "@/features/attempts/models/attempt";
import type { Message } from "@/features/chat/models/chat";
import type { Stage } from "@/features/stages/types";
import { Case } from "@/features/case-selection/models/case";
import { mapDbCaseToCase } from "@/features/case-selection/services/caseService";
import { AttemptConversationTab } from "@/features/attempts/components/attempt-conversation-tab";
import { AttemptFeedbackTab } from "@/features/attempts/components/attempt-feedback-tab";
import { CaseCard } from "@/features/case-selection/components/case-card";
import { caseAttemptHref, caseHref } from "@/features/case-selection/caseViewHref";
import { buildAuthHeaders, getAccessToken } from "@/lib/auth-headers";

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <li className="flex items-center gap-5 py-2.5">
      <span className="w-1/2 text-sm text-gray-500 sm:w-1/3 dark:text-gray-400">{label}</span>
      <span className="w-1/2 text-sm font-medium text-gray-700 sm:w-2/3 dark:text-gray-400">{children}</span>
    </li>
  );
}

function sessionHref(sessionId: string, isStaff: boolean) {
  return isStaff ? `/professor/sessions/${sessionId}` : `/start/${sessionId}`;
}

function attemptBreadcrumbItems({
  from,
  isStaff,
  currentLabel,
  session,
  attemptCase,
  studentEmail,
  studentUserId,
}: {
  from: AttemptViewFrom;
  isStaff: boolean;
  currentLabel: string;
  session?: CaseSession | null;
  attemptCase?: Case | null;
  studentEmail?: string | null;
  studentUserId?: string | null;
}): BreadcrumbItem[] {
  const current = { label: currentLabel };

  if (from === "session") {
    return [
      { label: "Home", href: "/dashboard" },
      isStaff
        ? { label: "Case Sessions", href: "/professor/sessions" }
        : { label: "Start", href: "/start" },
      {
        label: session?.friendlyName || "Session",
        href: session ? sessionHref(session.id, isStaff) : undefined,
      },
      current,
    ];
  }

  if (from === "case") {
    return [
      { label: "Home", href: "/dashboard" },
      isStaff ? { label: "Cases", href: "/cases" } : { label: "Start", href: "/start" },
      {
        label: attemptCase?.title || "Case",
        href: attemptCase ? caseHref(attemptCase.id, isStaff) : undefined,
      },
      current,
    ];
  }

  if (from === "student" && isStaff) {
    return [
      { label: "Home", href: "/dashboard" },
      { label: "Students", href: "/professor/students" },
      studentUserId
        ? {
            label: studentEmail || "Student",
            href: `/professor/students/${studentUserId}`,
          }
        : { label: studentEmail || "Student" },
      current,
    ];
  }

  return [
    { label: "Home", href: "/dashboard" },
    { label: "My Attempts", href: "/attempts" },
    current,
  ];
}

function DetailsCard({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="px-6 py-5">
        <h3 className="text-base font-medium text-primary dark:text-white/90">{title}</h3>
      </div>
      <div className="flex min-h-0 flex-1 flex-col border-t border-gray-200 p-4 sm:p-6 dark:border-gray-800">
        <div className="flex-1">{children}</div>
        {footer ? <div className="mt-auto pt-6">{footer}</div> : null}
      </div>
    </div>
  );
}

export default function ViewAttemptPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, role, isAdmin, loading: authLoading } = useAuth();
  const attemptId = params.id as string;
  const from = parseAttemptViewFrom(searchParams.get("from"));
  const isStaff = isAdmin || role === "professor";

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
    if (authLoading) return;

    let cancelled = false;
    const loadAttempt = async () => {
      setIsLoading(true);
      setAttempt(null);
      setCase(null);
      setSession(null);
      setMessages([]);
      setFeedback([]);
      setStudentProfile(null);
      setProfessorProfile(null);

      try {
        const token = await getAccessToken();
        if (!token) {
          return;
        }

        const headers = await buildAuthHeaders({ Accept: "application/json" }, token);
        const res = await fetch(`/api/attempts/${encodeURIComponent(attemptId)}/view`, { headers });
        const body = (await res.json().catch(() => ({}))) as {
          attempt?: Attempt;
          messages?: Message[];
          feedback?: AttemptFeedback[];
          case?: Parameters<typeof mapDbCaseToCase>[0] | null;
          studentProfile?: SimpleProfile | null;
          error?: string;
        };

        if (!res.ok || !body.attempt) {
          console.error("Failed to load attempt:", body.error || res.statusText);
          return;
        }

        if (cancelled) return;

        setAttempt(body.attempt);
        setCase(body.case ? mapDbCaseToCase(body.case) : null);
        setMessages(Array.isArray(body.messages) ? body.messages : []);
        setFeedback(Array.isArray(body.feedback) ? body.feedback : []);
        setStudentProfile(body.studentProfile ?? null);

        let loadedSession: CaseSession | null = null;
        if (body.attempt.sessionId) {
          try {
            loadedSession = await getSession(body.attempt.sessionId);
          } catch (sessionErr) {
            console.warn("Failed to load attempt session", sessionErr);
            loadedSession = null;
          }
        }
        if (cancelled) return;
        setSession(loadedSession);

        if (loadedSession?.createdBy) {
          setProfessorProfile({
            id: loadedSession.createdBy,
            email: null,
            fullName: loadedSession.createdByName ?? null,
            avatarUrl: null,
            role: "professor",
          });
        }

        const caseId = body.attempt.caseId;
        const caseStages = await (async () => {
          try {
            const mod = await import("@/features/stages/services/stageService");
            if (mod.getActiveStagesForCase) {
              return await mod.getActiveStagesForCase(caseId);
            }
            return mod.getStagesForCase(caseId);
          } catch (e) {
            console.warn("Failed to resolve active stages; falling back", e);
            return getStagesForCase(caseId);
          }
        })();
        if (!cancelled) setStages(caseStages);
      } catch (e) {
        console.error("Failed to load attempt view", e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadAttempt();
    return () => {
      cancelled = true;
    };
  }, [attemptId, authLoading]);

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
        if (from === "session" && session) {
          router.push(sessionHref(session.id, isStaff));
        } else if (from === "case" && attemptCase) {
          router.push(caseHref(attemptCase.id, isStaff));
        } else if (from === "student" && attempt?.userId) {
          router.push(`/professor/students/${attempt.userId}`);
        } else {
          router.push("/attempts");
        }
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
          items={attemptBreadcrumbItems({
            from,
            isStaff,
            currentLabel: "Attempt",
          })}
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
          items={attemptBreadcrumbItems({
            from,
            isStaff,
            currentLabel: "Attempt not found",
          })}
        />
        <p>Attempt not found</p>
      </div>
    );
  }

  const sessionStatus = session ? deriveStatus(session) : null;
  const canDeleteAttempt = isStaff;
  const sessionEndedInProgress =
    attempt.completionStatus === "in_progress" && sessionStatus === "completed";
  const canContinueAttempt =
    attempt.completionStatus === "in_progress" &&
    user?.id === attempt.userId &&
    !sessionEndedInProgress;
  const studentEmail = studentProfile?.email?.trim() || null;
  const studentLabel = isStaff
    ? studentEmail || studentProfile?.fullName?.trim() || "—"
    : studentProfile?.fullName?.trim() || studentEmail || "—";
  const professorLabel =
    professorProfile?.fullName?.trim() ||
    professorProfile?.email ||
    session?.createdByName ||
    "—";

  return (
    <div className="container mx-auto px-4 pb-8">
      <Breadcrumb
        items={attemptBreadcrumbItems({
          from,
          isStaff,
          currentLabel: attempt.title || "Attempt",
          session,
          attemptCase,
          studentEmail,
          studentUserId: attempt.userId,
        })}
      />

      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-primary md:text-4xl lg:text-5xl">
          {attempt.title || "Attempt"}
        </h1>
        <p className="mt-4 text-xl text-muted-foreground">
          Id: <span className="font-mono text-base">{attempt.id}</span>
        </p>
      </header>

      {canContinueAttempt && (
        <Button
          asChild
          size="lg"
          className="mb-6 h-14 w-full bg-brand-100 text-base font-semibold text-brand-700 hover:bg-brand-200 dark:bg-brand-500/12 dark:text-brand-400 dark:hover:bg-brand-500/20"
        >
          <Link
            href={caseAttemptHref(attempt.caseId, {
              attempt: attempt.id,
              session: attempt.sessionId,
            })}
          >
            Continue Attempt
          </Link>
        </Button>
      )}

      <div className="mb-8 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3">
        <DetailsCard
          title="Attempt Details"
          footer={
            canDeleteAttempt ? (
              <Button
                variant="outline"
                onClick={handleDeleteAttempt}
                disabled={isDeleting}
                className="w-full"
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
            ) : null
          }
        >
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            <InfoRow label="Student">
              {isStaff && attempt.userId ? (
                <Link
                  href={`/professor/students/${attempt.userId}`}
                  className="text-primary hover:underline"
                >
                  {studentLabel}
                </Link>
              ) : (
                studentLabel
              )}
            </InfoRow>
            <InfoRow label="Status">
              <Badge
                variant={
                  attempt.completionStatus === "completed"
                    ? "success"
                    : attempt.completionStatus === "in_progress"
                      ? "warning"
                      : "destructive"
                }
                className={attempt.completionStatus === "abandoned" ? "text-white" : undefined}
              >
                {attempt.completionStatus === "completed"
                  ? "Completed"
                  : attempt.completionStatus === "in_progress"
                    ? "In Progress"
                    : "Abandoned"}
              </Badge>
            </InfoRow>
            <InfoRow label="Started">{formatDate(attempt.createdAt)}</InfoRow>
            <InfoRow label="Completed">{attempt.completedAt ? formatDate(attempt.completedAt) : "—"}</InfoRow>
            <InfoRow label="Time spent">{formatTimeSpent(attempt.timeSpentSeconds)}</InfoRow>
          </ul>
        </DetailsCard>

        <DetailsCard
          title="Session Details"
          footer={
            session ? (
              <Button className="w-full" asChild>
                <Link href={sessionHref(session.id, isStaff)}>
                  View Session
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : null
          }
        >
          {session ? (
            <>
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                <InfoRow label="Name">{session.friendlyName}</InfoRow>
                <InfoRow label="Status">
                  <Badge
                    variant={
                      sessionStatus === "active" ? "success" : sessionStatus === "scheduled" ? "warning" : "secondary"
                    }
                    className="capitalize"
                  >
                    {sessionStatus === "active" ? "Active" : sessionStatus === "scheduled" ? "Scheduled" : "Completed"}
                  </Badge>
                </InfoRow>
                <InfoRow label="Start">{formatDate(session.startAt)}</InfoRow>
                <InfoRow label="End">{formatDate(session.endAt)}</InfoRow>
                <InfoRow label="Professor">{professorLabel}</InfoRow>
              </ul>
              {sessionEndedInProgress ? (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 dark:border-brand-800 dark:bg-brand-500/12">
                  <Info className="mt-0.5 size-4 shrink-0 text-brand-700 dark:text-brand-400" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-brand-800 dark:text-brand-300">Session ended</p>
                    <p className="text-xs text-brand-700 dark:text-brand-400">
                      This attempt cannot be completed as the session has now ended.
                    </p>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">This attempt is not part of a session.</p>
          )}
        </DetailsCard>

        {attemptCase ? (
          <CaseCard key={attemptCase.id} caseItem={attemptCase} href={caseHref(attemptCase.id, isStaff)} />
        ) : (
          <div />
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white px-5 py-5 sm:px-6 sm:py-6 dark:border-gray-800 dark:bg-white/[0.03]">
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
    </div>
  );
}
