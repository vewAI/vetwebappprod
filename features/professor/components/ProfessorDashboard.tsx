"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/features/auth/services/authService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumb } from "@/features/navigation/components/breadcrumb";
import { buildAuthHeaders, getAccessToken } from "@/lib/auth-headers";
import { AttemptsPerDayChart } from "./charts/AttemptsPerDayChart";
import { StudentsByYearGroupChart } from "./charts/StudentsByYearGroupChart";
import { RankingCard } from "./RankingCard";
import type { ProfessorDashboardStats } from "../models/dashboard";

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

  const cards = [
    { label: "Total Cases", value: stats?.caseCount ?? 0, href: "/cases" },
    { label: "Total Active Sessions", value: stats?.activeSessionCount ?? 0, href: "/professor/sessions" },
    { label: "Total Students Enrolled", value: stats?.studentCount ?? 0 },
  ];

  return (
    <div className="container mx-auto px-4 pb-8">
      <Breadcrumb items={[{ label: "Home", href: "/dashboard" }, { label: "Dashboard" }]} />
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-primary md:text-4xl lg:text-5xl">Professor Dashboard</h1>
        <p className="mt-4 text-xl text-muted-foreground">A snapshot of your students, cases, and recent attempt activity.</p>
      </header>

      {error ? <p className="mb-6 text-center text-sm text-destructive">{error}</p> : null}

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3 md:gap-6">
        {cards.map((card) => {
          const inner = (
            <div className="h-full rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
              <p className="text-theme-sm text-gray-500 dark:text-gray-400">{card.label}</p>
              <div className="mt-3">
                <h4 className="text-2xl font-bold text-brand-500 dark:text-brand-400">{loading ? "—" : card.value}</h4>
              </div>
            </div>
          );
          return card.href ? (
            <Link key={card.label} href={card.href} className="block h-full">
              {inner}
            </Link>
          ) : (
            <div key={card.label}>{inner}</div>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attempts per day (last 30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading || !stats ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading chart...</p>
          ) : (
            <AttemptsPerDayChart data={stats.attemptsByDay} />
          )}
        </CardContent>
      </Card>

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
