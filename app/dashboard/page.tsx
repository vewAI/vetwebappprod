"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/features/auth/services/authService";
import { AttemptCard } from "@/features/attempts/components/attempt-card";
import type { AttemptSummary } from "@/features/attempts/models/attempt";
import { getUserAttempts } from "@/features/attempts/services/attemptQueryService";
import { CaseCard } from "@/features/case-selection/components/case-card";
import { supabase } from "@/lib/supabase";
import { transformAttemptSummary } from "@/features/attempts/mappers/attempt-mappers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { professorService } from "@/features/professor/services/professorService";
import { cn } from "@/lib/utils";
import { YearGroupRequiredAlert } from "@/features/year-groups/components/YearGroupRequiredAlert";

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
            <CardTitle className="text-sm font-semibold">{item.title}</CardTitle>
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
  const [studentAttempts, setStudentAttempts] = useState<AttemptSummary[]>([]);
  const [professorAttempts, setProfessorAttempts] = useState<AttemptSummary[]>([]);
  const [assignedCases, setAssignedCases] = useState<any[]>([]);
  const [loadingProfessorAttempts, setLoadingProfessorAttempts] = useState(false);
  const [loadingAssignedCases, setLoadingAssignedCases] = useState(false);

  useEffect(() => {
    if (role === "student") {
      getUserAttempts().then((attempts) => {
        setStudentAttempts(attempts);
      });
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
      {/* Hero — same mint field and large V watermark as the marketing home page */}
      <section className="relative -mx-4 -mt-4 overflow-hidden border-b border-emerald-100 bg-gradient-to-b from-[#f2fbf7] via-[#f7fdfa] to-[#eef9f4] pt-12 pb-16 md:-mx-6 md:-mt-6 md:pt-16 md:pb-20">
        <div className="pointer-events-none absolute top-1/4 left-1/2 h-[450px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-300/25 blur-[140px]" />
        <div className="pointer-events-none absolute top-[40%] left-1/2 z-0 aspect-[1024/764] w-[410px] -translate-x-1/2 -translate-y-1/2 opacity-20 select-none sm:w-[625px] md:w-[840px]">
          <Image
            src="/images/logo-v.png"
            alt=""
            fill
            sizes="(max-width: 768px) 410px, 840px"
            className="object-contain"
            priority
          />
        </div>
        <div className="relative z-10 container mx-auto px-4">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center motion-safe:animate-in motion-safe:fade-in-50 motion-safe:slide-in-from-bottom-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/80 bg-white/90 px-4 py-1.5 text-xs font-bold tracking-wider text-emerald-800 uppercase shadow-xs backdrop-blur-sm">
              AI-powered veterinary communication practice
            </div>
            <h1 className="text-4xl leading-[1.15] font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              Communication Skills Training Platform
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-slate-700 sm:text-lg">
              Practice real-world clinical scenarios, receive instant AI feedback, and build confidence before stepping into your next OSCE or
              rotation.
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-1">
              {(role === "professor" || role === "admin") && (
                <Button asChild className="rounded-xl bg-emerald-600 px-6 text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700">
                  <Link href="/cases">Browse all cases</Link>
                </Button>
              )}
              {role === "student" && (
                <Button
                  asChild
                  variant="outline"
                  className="rounded-xl border-emerald-300 bg-white px-6 text-emerald-800 hover:border-emerald-400 hover:bg-emerald-50"
                >
                  <Link href="/case-sessions">Jump into training</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Welcome + notifications */}
      <section className="container mx-auto px-4 py-8 md:py-10">
        <div className="space-y-4 border-b border-border/60 pb-10 motion-safe:animate-in motion-safe:fade-in-50 motion-safe:slide-in-from-bottom-4">
          <YearGroupRequiredAlert />
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Good to see you, {displayName}.</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {role === "professor"
                  ? "Review your students' progress and assign new cases."
                  : "Continue your training journey or start a new simulated case."}
              </p>
              {role === "student" && (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground/80">
                  To practice <strong>knowledge, clinical skills and communication</strong>, open the{" "}
                  <Link href="/case-sessions" className="font-medium text-primary underline underline-offset-2 hover:text-primary/80">
                    Live
                  </Link>{" "}
                  menu link and choose a case — you will speak with the owner and the veterinary team just like in a real consultation.
                </p>
              )}
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
                <Link href="/case-sessions">View all</Link>
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
    </div>
  );
}
