"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/features/auth/services/authService";
import type { AttemptSummary } from "@/features/attempts/models/attempt";
import { getUserAttempts } from "@/features/attempts/services/attemptQueryService";
import { CaseCard } from "@/features/case-selection/components/case-card";
import { Button } from "@/components/ui/button";
import { professorService } from "@/features/professor/services/professorService";
import { cn } from "@/lib/utils";
import { YearGroupRequiredAlert } from "@/features/year-groups/components/YearGroupRequiredAlert";
import {
  currentAcademicYearRange,
  defaultAcademicYearEnd,
} from "@/features/year-groups/models/yearGroup";
import { buildAuthHeaders, getAccessToken } from "@/lib/auth-headers";
import { Info } from "lucide-react";

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

/** Adapted from TailAdmin React Rounded Ribbon (MIT). https://react-demo.tailadmin.com/ribbons */
function NotificationsBar({ notifications }: { notifications: Notification[] }) {
  if (!notifications.length) return null;

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {notifications.map((item) => (
        <div
          key={item.id}
          className="relative overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]"
        >
          <span className="absolute -left-px mt-3 inline-block rounded-r-full bg-brand-500 px-4 py-1.5 text-sm font-medium text-white">
            {item.title}
          </span>
          <div className="p-5 pt-16">
            <p className="text-sm text-gray-500 dark:text-gray-400">{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const { user, role, yearGroupName, institutionId } = useAuth() as {
    user: any;
    role: Role;
    yearGroupName: string | null;
    institutionId: string | null;
  };
  const [studentAttempts, setStudentAttempts] = useState<AttemptSummary[]>([]);
  const [assignedCases, setAssignedCases] = useState<any[]>([]);
  const [loadingAssignedCases, setLoadingAssignedCases] = useState(false);
  const [academicYearEnd, setAcademicYearEnd] = useState(defaultAcademicYearEnd());

  useEffect(() => {
    if (role === "student") {
      getUserAttempts().then((attempts) => {
        setStudentAttempts(attempts);
      });
    }
  }, [role]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessToken();
        const query = institutionId ? `?institutionId=${encodeURIComponent(institutionId)}` : "";
        const res = await fetch(`/api/year-groups${query}`, {
          headers: await buildAuthHeaders({ Accept: "application/json" }, token),
        });
        const body = (await res.json().catch(() => ({}))) as {
          academicYearEnd?: { month: number; day: number } | null;
        };
        if (!cancelled && body.academicYearEnd) {
          setAcademicYearEnd({
            month: Number(body.academicYearEnd.month ?? 7),
            day: Number(body.academicYearEnd.day ?? 31),
          });
        }
      } catch {
        // Keep the 31 July default.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, institutionId]);

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

  const academicYear = currentAcademicYearRange(academicYearEnd.month, academicYearEnd.day);

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

    if (!items.length) {
      items.push({
        id: "all-clear",
        title: "You're all caught up",
        description: "No outstanding items right now. Explore a new case to keep your skills sharp.",
        tone: "success",
      });
    }

    return items;
  }, [role, studentAttempts, assignedCases]);

  return (
    <div className="min-h-[calc(100vh-4rem)]">
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
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
            <h2 className="text-2xl font-semibold tracking-tight text-primary md:text-3xl">
              Good to see you, {displayName}.
            </h2>
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
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 dark:border-brand-800 dark:bg-brand-500/12">
              <Info className="mt-0.5 size-4 shrink-0 text-brand-700 dark:text-brand-400" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-brand-800 dark:text-brand-300">Current academic year</p>
                <p className="text-sm text-brand-700 dark:text-brand-400">
                  {academicYear.startLabel} – {academicYear.endLabel}
                </p>
                {role === "student" ? (
                  <p className="mt-1 text-sm text-brand-700 dark:text-brand-400">
                    {yearGroupName
                      ? `You are currently in ${yearGroupName}.`
                      : "You have not been assigned a year group."}
                  </p>
                ) : null}
              </div>
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
    </div>
  );
}
