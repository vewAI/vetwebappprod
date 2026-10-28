"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Calendar, Users, type LucideIcon } from "lucide-react";
import { useAuth } from "@/features/auth/services/authService";
import { Breadcrumb } from "@/features/navigation/components/breadcrumb";
import { buildAuthHeaders, getAccessToken } from "@/lib/auth-headers";
import { AttemptsPerDayChart } from "./charts/AttemptsPerDayChart";
import { StudentsByYearGroupChart } from "./charts/StudentsByYearGroupChart";
import { RankingCard } from "./RankingCard";
import type { ProfessorDashboardStats } from "../models/dashboard";

const READ_MORE_ARROW = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M14.0836 7.99888C14.0838 8.19107 14.0107 8.38334 13.8641 8.53001L9.86678 12.5301C9.57399 12.8231 9.09911 12.8233 8.80612 12.5305C8.51312 12.2377 8.51296 11.7629 8.80575 11.4699L11.526 8.74772L2.66602 8.74772C2.2518 8.74772 1.91602 8.41194 1.91602 7.99772C1.91602 7.58351 2.2518 7.24772 2.66602 7.24772L11.5216 7.24772L8.80576 4.53016C8.51296 4.23718 8.51311 3.7623 8.8061 3.4695C9.09909 3.1767 9.57396 3.17685 9.86676 3.46984L13.8292 7.43478C13.9852 7.57222 14.0836 7.77348 14.0836 7.99772C14.0836 7.99811 14.0836 7.9985 14.0836 7.99888Z"
      fill="currentColor"
    />
  </svg>
);

export function ProfessorDashboard() {
  const { role } = useAuth();
  const isProfessor = role === "professor" || role === "admin";
  const [stats, setStats] = useState<ProfessorDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isProfessor) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await getAccessToken();
        if (!token) throw new Error("Not authenticated");
        const res = await fetch("/api/professor/dashboard", {
          headers: await buildAuthHeaders({ Accept: "application/json" }, token),
        });
        const body = (await res.json()) as ProfessorDashboardStats & { error?: string };
        if (!res.ok) throw new Error(body.error || res.statusText);
        if (!cancelled) setStats(body);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isProfessor]);

  if (!isProfessor) {
    return (
      <div className="container mx-auto px-4 pb-8 text-center">
        <h1 className="text-xl font-bold text-destructive">Access denied</h1>
        <p className="mt-2 text-muted-foreground">You must be a professor to view this page.</p>
      </div>
    );
  }

  const cards: { label: string; value: number; href?: string; icon: LucideIcon }[] = [
    { label: "Total Cases", value: stats?.caseCount ?? 0, href: "/cases", icon: BookOpen },
    { label: "Total Active Sessions", value: stats?.activeSessionCount ?? 0, href: "/professor/sessions", icon: Calendar },
    { label: "Total Students Enrolled", value: stats?.studentCount ?? 0, href: "/professor/students", icon: Users },
  ];

  return (
    <div className="container mx-auto px-4 pb-8">
      <Breadcrumb items={[{ label: "Home", href: "/dashboard" }, { label: "Dashboard" }]} />
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-primary md:text-4xl lg:text-5xl">Professor Dashboard</h1>
        <p className="mt-4 text-xl text-muted-foreground">A snapshot of your students, cases, and recent attempt activity.</p>
      </header>

      {error ? <p className="mb-6 text-center text-sm text-destructive">{error}</p> : null}

      <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 sm:p-6 dark:border-gray-800 dark:bg-white/[0.03]"
            >
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500 dark:bg-brand-500/10">
                  <Icon className="size-5" strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <h4 className="mb-1 text-xl font-medium text-gray-800 dark:text-white/90">{card.label}</h4>
                  <p className="text-2xl font-bold text-brand-500 dark:text-brand-400">{loading ? "—" : card.value}</p>
                </div>
              </div>
              {card.href ? (
                <Link
                  href={card.href}
                  className="mt-4 ml-auto inline-flex items-center gap-1 text-sm text-brand-500 hover:text-brand-600"
                >
                  View all
                  {READ_MORE_ARROW}
                </Link>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white px-5 pt-5 pb-5 sm:px-6 sm:pt-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="mb-4">
          <h3 className="mb-1 text-lg font-semibold text-gray-800 dark:text-white/90">Attempts Per Day</h3>
          <span className="block text-theme-sm text-gray-500 dark:text-gray-400">Last 30 days</span>
        </div>
        {loading || !stats ? (
          <p className="py-8 text-center text-theme-sm text-gray-500 dark:text-gray-400">Loading chart...</p>
        ) : (
          <AttemptsPerDayChart data={stats.attemptsByDay} />
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        {loading || !stats ? (
          ["Top Cases", "Recent Sessions", "Students by year group"].map((title) => (
            <div
              key={title}
              className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 dark:border-gray-800 dark:bg-white/[0.03]"
            >
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">{title}</h3>
              <p className="py-12 text-center text-sm text-muted-foreground">Loading...</p>
            </div>
          ))
        ) : (
          <>
            <RankingCard
              title="Top Cases"
              subtitle="Last 30 days"
              sourceLabel="Case"
              valueLabel="Attempts"
              rows={stats.topCases.map((row) => ({ ...row, href: `/case/${row.id}` }))}
              emptyMessage="No case attempts in the last 30 days."
              actionLabel="View All Cases"
              actionHref="/cases"
            />
            <RankingCard
              title="Recent Sessions"
              subtitle="Created by you"
              sourceLabel="Session"
              valueLabel="Attempts"
              rows={stats.topSessions.map((row) => ({ ...row, href: `/professor/sessions/${row.id}` }))}
              emptyMessage="You have not created any sessions yet."
              actionLabel="View All Sessions"
              actionHref="/case-sessions"
            />
            <StudentsByYearGroupChart data={stats.studentsByYearGroup} />
          </>
        )}
      </div>
    </div>
  );
}
