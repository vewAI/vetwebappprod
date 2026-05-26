"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/features/auth/services/authService";
import { AttemptCard } from "@/features/attempts/components/attempt-card";
import type { AttemptSummary } from "@/features/attempts/models/attempt";
import { getUserAttempts } from "@/features/attempts/services/attemptQueryService";
import { CaseCard } from "@/features/case-selection/components/case-card";
import type { Case } from "@/features/case-selection/models/case";
import { fetchCases } from "@/features/case-selection/services/caseService";
import { CaseSessionCard } from "@/features/case-sessions/components/case-session-card";
import type { CaseSession } from "@/features/case-sessions/models/caseSession";
import { listSessions } from "@/features/case-sessions/services/caseSessionService";
import { supabase } from "@/lib/supabase";
import { transformAttemptSummary } from "@/features/attempts/mappers/attempt-mappers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { professorService } from "@/features/professor/services/professorService";
import { cn } from "@/lib/utils";

type Role = "student" | "professor" | "admin" | null;

function PageSection({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "w-full border-t border-border/60 bg-muted/30 py-8 md:py-10",
        "dark:bg-muted/15",
        "motion-safe:animate-in motion-safe:fade-in-50 motion-safe:slide-in-from-bottom-4",
        className,
      )}
    >
      <div className="container mx-auto px-4">{children}</div>
    </section>
  );
}

function SectionHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

type Notification = {
  id: string;
  title: string;
  description: string;
  tone?: "info" | "success" | "warning";
};

function NotificationsBar({ notifications }: { notifications: Notification[] }) {
  if (!notifications.length) return null;

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {notifications.map((item) => (
        <Card
          key={item.id}
          className="border-none bg-muted/60 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-muted hover:shadow-md dark:bg-muted/40"
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold">{item.title}</CardTitle>
              {item.tone && (
                <Badge
                  variant={item.tone === "success" ? "success" : item.tone === "warning" ? "warning" : "secondary"}
                  className="text-[10px] uppercase tracking-wide"
                >
                  {item.tone}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">{item.description}</CardContent>
        </Card>
      ))}
    </div>
  );
}

async function getProfessorStudentAttemptsNeedingFeedback(professorId: string): Promise<AttemptSummary[]> {
  const { data: relations, error: relError } = await supabase.from("professor_students").select("student_id").eq("professor_id", professorId);

  if (relError || !relations || relations.length === 0) {
    return [];
  }

  const studentIds = relations.map((r) => r.student_id);

  const { data, error } = await supabase
    .from("attempts")
    .select(
      "id, user_id, case_id, title, created_at, completed_at, completion_status, last_stage_index, time_spent_seconds, feedback_read_at, overall_feedback, professor_feedback, cases (title, category, difficulty, image_url)",
    )
    .in("user_id", studentIds)
    .eq("completion_status", "completed")
    .is("overall_feedback", null)
    .is("professor_feedback", null)
    .order("created_at", { ascending: false })
    .limit(3);

  if (error || !data) {
    console.warn("Failed to load professor attempts requiring feedback", error);
    return [];
  }

  return data.map(transformAttemptSummary);
}

export default function HomePage() {
  const { user, role } = useAuth() as { user: any; role: Role };
  const logoSrc =
    process.env.NEXT_PUBLIC_BRAND_LOGO_URL ||
    (process.env.NEXT_PUBLIC_SUPABASE_URL
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/img/logo_transparent.png`
      : "/placeholder.svg");
  const [studentAttempts, setStudentAttempts] = useState<AttemptSummary[]>([]);
  const [professorAttempts, setProfessorAttempts] = useState<AttemptSummary[]>([]);
  const [latestCases, setLatestCases] = useState<Case[]>([]);
  const [activeSessions, setActiveSessions] = useState<CaseSession[]>([]);
  const [assignedCases, setAssignedCases] = useState<any[]>([]);
  const [loadingStudentAttempts, setLoadingStudentAttempts] = useState(false);
  const [loadingProfessorAttempts, setLoadingProfessorAttempts] = useState(false);
  const [loadingCases, setLoadingCases] = useState(false);
  const [loadingActiveSessions, setLoadingActiveSessions] = useState(false);
  const [loadingAssignedCases, setLoadingAssignedCases] = useState(false);

  useEffect(() => {
    if (role === "student") {
      setLoadingStudentAttempts(true);
      getUserAttempts()
        .then((attempts) => {
          setStudentAttempts(attempts);
        })
        .finally(() => setLoadingStudentAttempts(false));
    }
  }, [role]);

  useEffect(() => {
    if (role === "professor" && user?.id) {
      setLoadingProfessorAttempts(true);
      getProfessorStudentAttemptsNeedingFeedback(user.id)
        .then((attempts) => {
          setProfessorAttempts(attempts);
        })
        .finally(() => setLoadingProfessorAttempts(false));
    }
  }, [role, user?.id]);

  useEffect(() => {
    if (role === "student" && user?.id) {
      setLoadingAssignedCases(true);
      professorService
        .getAssignedCasesForStudent(user.id)
        .then((cases) => setAssignedCases(Array.isArray(cases) ? cases : []))
        .catch(() => setAssignedCases([]))
        .finally(() => setLoadingAssignedCases(false));
    }
  }, [role, user?.id]);

  useEffect(() => {
    setLoadingCases(true);
    fetchCases({ limit: 3 })
      .then((cases) => setLatestCases(cases))
      .finally(() => setLoadingCases(false));
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setActiveSessions([]);
      return;
    }
    setLoadingActiveSessions(true);
    listSessions({ status: "active" })
      .then((sessions) => setActiveSessions(sessions.slice(0, 3)))
      .catch(() => setActiveSessions([]))
      .finally(() => setLoadingActiveSessions(false));
  }, [user?.id]);

  const displayName = useMemo(() => {
    const email = user?.email as string | undefined;
    if (!email) return "there";
    return email.split("@")[0];
  }, [user]);

  const notifications: Notification[] = useMemo(() => {
    const items: Notification[] = [];

    if (role === "student") {
      const inProgressCount = studentAttempts.filter((a) => a.completionStatus === "in_progress").length;
      const completedCount = studentAttempts.filter((a) => a.completionStatus === "completed").length;

      if (inProgressCount > 0) {
        items.push({
          id: "student-in-progress",
          title: "Pick up where you left off",
          description: `You have ${inProgressCount} attempt${inProgressCount > 1 ? "s" : ""} still in progress.`,
          tone: "info",
        });
      }

      if (completedCount > 0) {
        items.push({
          id: "student-completed",
          title: "Completed practice",
          description: `You've completed ${completedCount} recent attempt${completedCount > 1 ? "s" : ""}. Review them in the attempts area.`,
          tone: "success",
        });
      }

      if (assignedCases.length > 0) {
        items.push({
          id: "student-assigned-cases",
          title: "Cases assigned by your professor",
          description: `You have ${assignedCases.length} case${assignedCases.length > 1 ? "s" : ""} assigned by your professor. Check the assigned cases section below.`,
          tone: "info",
        });
      }
    }

    if (role === "professor") {
      const awaitingFeedback = professorAttempts.length;
      if (awaitingFeedback > 0) {
        items.push({
          id: "professor-awaiting-feedback",
          title: "Student attempts awaiting feedback",
          description: `You have ${awaitingFeedback} recent completed attempt${
            awaitingFeedback > 1 ? "s" : ""
          } from your students that don't yet have feedback recorded.`,
          tone: "warning",
        });
      }
    }

    if (!items.length) {
      items.push({
        id: "all-clear",
        title: "You're all caught up",
        description: "No outstanding items right now. Explore a new case to keep your skills sharp.",
        tone: "success",
      });
    }

    return items;
  }, [role, studentAttempts, professorAttempts, assignedCases]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-background via-background to-muted/40 ">
      {/* Hero */}
      <section className="border-b border-border/60 bg-gradient-to-r from-primary/90 via-primary to-primary/80 text-primary-foreground dark:text-white">
        <div className="container mx-auto px-4 py-10 md:py-14">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center motion-safe:animate-in motion-safe:fade-in-50 motion-safe:slide-in-from-bottom-6">
            <div className="relative h-28 w-32 md:h-32 md:w-40">
              <div className="absolute inset-0 rounded-3xl bg-black/10 blur-2xl" />
              <div className="relative flex h-full w-full items-center justify-center rounded-3xl border border-white/10 bg-white/10 shadow-2xl backdrop-blur-md">
                <Image src={logoSrc} alt="VewAI logo" width={120} height={120} className="h-16 w-auto md:h-20" priority unoptimized />
              </div>
            </div>
            <h2 className="text-2xl tracking-tight sm:text-3xl md:text-4xl">
              Vew<span className="font-bold text-white">AI</span>
            </h2>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl lg:text-5xl">Veterinary OSCE Simulator</h1>
              <p className="text-sm text-primary-foreground/90 md:text-base dark:text-white">
                AI-powered educational simulator for veterinary students
              </p>
            </div>
            <p className="max-w-2xl text-sm text-primary-foreground/80 md:text-base dark:text-white/60">
              Practice real-world clinical scenarios, receive instant AI feedback, and build confidence before stepping into your next OSCE or
              rotation.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild size="sm" className="rounded-full bg-primary-foreground text-primary hover:bg-white dark:text-white/90">
                <Link href="/cases">Browse all cases</Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant="sessions-outline"
                className="rounded-full border-sessions/50 bg-sessions/10 text-sessions-foreground hover:bg-sessions/20 hover:text-sessions-foreground dark:border-sessions/40 dark:text-white"
              >
                <Link href="/case-sessions">Jump into training</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Welcome + notifications */}
      <section className="container mx-auto px-4 py-8 md:py-10">
        <div className="space-y-4 border-b border-border/60 pb-10 motion-safe:animate-in motion-safe:fade-in-50 motion-safe:slide-in-from-bottom-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Good to see you, {displayName}.</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {role === "professor"
                  ? "Review your students' progress and assign new cases."
                  : "Continue your training journey or start a new simulated case."}
              </p>
            </div>
          </div>
          <NotificationsBar notifications={notifications} />
        </div>
      </section>

      {/* Student assigned cases */}
      {role === "student" && assignedCases.length > 0 && (
        <PageSection>
          <SectionHeader
            title="Cases assigned by your professor"
            description="Your professor has assigned these cases for you to complete."
            action={
              <Button asChild variant="ghost" size="sm">
                <Link href="/cases">View all</Link>
              </Button>
            }
          />
          {loadingAssignedCases ? (
            <div className="p-4 text-sm text-muted-foreground">Loading assigned cases...</div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {assignedCases.map((ac) => {
                if (!ac.case) return null;
                return (
                  <CaseCard
                    key={ac.id}
                    caseItem={{
                      id: ac.case_id,
                      title: ac.case.title || "",
                      description: "",
                      species: ac.case.species || "",
                      condition: "",
                      category: "",
                      difficulty: ac.case.difficulty || "Easy",
                      estimatedTime: 0,
                      imageUrl: ac.case.image_url || "",
                    }}
                  />
                );
              })}
            </div>
          )}
        </PageSection>
      )}

      {/* Role-specific attempts */}
      {role === "student" && (
        <PageSection>
          <SectionHeader
            title="Recent attempts"
            description="Pick up where you left off or review your most recent simulated cases."
            action={
              <Button asChild variant="ghost" size="sm">
                <Link href="/attempts">View all attempts</Link>
              </Button>
            }
          />
          {loadingStudentAttempts ? (
            <div className="p-4 text-sm text-muted-foreground">Loading your recent attempts...</div>
          ) : studentAttempts.length === 0 ? (
            <Card className="border-dashed bg-muted/40 text-sm text-muted-foreground">
              <CardContent className="py-6">You don&apos;t have any attempts yet. Start your first case from the cases library below.</CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {studentAttempts.slice(0, 3).map((attempt) => (
                <AttemptCard key={attempt.id} attempt={attempt} />
              ))}
            </div>
          )}
        </PageSection>
      )}

      {role === "professor" && (
        <PageSection>
          <SectionHeader
            title="Attempts awaiting feedback"
            description="Support your students with timely feedback on their completed attempts."
            action={
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/case-entry">Add New Case</Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/professor">Open professor dashboard</Link>
                </Button>
              </div>
            }
          />
          {loadingProfessorAttempts ? (
            <div className="p-4 text-sm text-muted-foreground">Loading student attempts...</div>
          ) : professorAttempts.length === 0 ? (
            <Card className="border-dashed bg-muted/40 text-sm text-muted-foreground">
              <CardContent className="py-6">There are no completed attempts from your students waiting for feedback right now.</CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {professorAttempts.map((attempt) => (
                <AttemptCard key={attempt.id} attempt={attempt} />
              ))}
            </div>
          )}
        </PageSection>
      )}

      {/* Active case sessions */}
      {user?.id && (
        <PageSection>
          <SectionHeader
            title="Active case sessions"
            description="Join a live session from your instructor while it is open."
            action={
              <Button asChild variant="sessions-link" size="sm">
                <Link href="/case-sessions">View all</Link>
              </Button>
            }
          />
          {loadingActiveSessions ? (
            <div className="p-4 text-sm text-muted-foreground">Loading active sessions...</div>
          ) : activeSessions.length === 0 ? (
            <Card className="border-dashed bg-muted/40 text-sm text-muted-foreground">
              <CardContent className="py-6">No active sessions right now. When your instructor opens a session, it will appear here.</CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {activeSessions.map((session) => (
                <CaseSessionCard key={session.id} session={session} />
              ))}
            </div>
          )}
        </PageSection>
      )}

      {/* Latest cases */}
      <PageSection>
        <SectionHeader
          title="Latest cases"
          description="Explore newly added or recently updated cases to keep your skills sharp."
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/cases">View all</Link>
            </Button>
          }
        />
        {loadingCases ? (
          <div className="p-4 text-sm text-muted-foreground">Loading latest cases...</div>
        ) : latestCases.length === 0 ? (
          <Card className="border-dashed bg-muted/40 text-sm text-muted-foreground">
            <CardContent className="py-6">No cases are available yet. Check back soon or contact your instructor.</CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {latestCases.map((caseItem) => (
              <CaseCard key={caseItem.id} caseItem={caseItem} />
            ))}
          </div>
        )}
      </PageSection>
    </div>
  );
}
