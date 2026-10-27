"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/features/auth/services/authService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumb } from "@/features/navigation/components/breadcrumb";
import { buildAuthHeaders, getAccessToken } from "@/lib/auth-headers";
import { AttemptsPerDayChart } from "./charts/AttemptsPerDayChart";
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
    { label: "Students enrolled", value: stats?.studentCount ?? 0 },
    { label: "Total cases", value: stats?.caseCount ?? 0, href: "/cases" },
    { label: "Active sessions", value: stats?.activeSessionCount ?? 0, href: "/professor/sessions" },
  ];

  return (
    <div className="container mx-auto px-4 pb-8">
      <Breadcrumb items={[{ label: "Home", href: "/dashboard" }, { label: "Dashboard" }]} />
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-primary md:text-4xl lg:text-5xl">Professor Dashboard</h1>
        <p className="mt-4 text-xl text-muted-foreground">A snapshot of your students, cases, and recent attempt activity.</p>
      </header>

      {error ? <p className="mb-6 text-center text-sm text-destructive">{error}</p> : null}

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {cards.map((card) => {
          const inner = (
            <Card className={card.href ? "h-full transition-colors hover:bg-brand-50 dark:hover:bg-white/[0.03]" : undefined}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-brand-500">{loading ? "—" : card.value}</p>
              </CardContent>
            </Card>
          );
          return card.href ? (
            <Link key={card.label} href={card.href} className="block">
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
    </div>
  );
}
