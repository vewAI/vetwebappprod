"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/services/authService";
import { SessionList } from "@/features/case-sessions/components/SessionList";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProfessorSessionsPage() {
  const { role, loading } = useAuth();

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (role !== "professor" && role !== "admin") {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-xl font-bold text-destructive">Access denied</h1>
        <p className="text-muted-foreground mt-2">
          Only professors and admins can manage sessions.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold">Case sessions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Search, filter, and open session dashboards.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/professor">Dashboard</Link>
          </Button>
          <Button variant="sessions" asChild>
            <Link href="/professor/sessions/new">Create session</Link>
          </Button>
        </div>
      </div>
      <SessionList />
    </div>
  );
}
