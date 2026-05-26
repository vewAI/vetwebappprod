"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/features/auth/services/authService";
import { ProfessorSessionDetail } from "@/features/case-sessions/components/ProfessorSessionDetail";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProfessorSessionDetailPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const { role, loading } = useAuth();

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-4 max-w-5xl">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (role !== "professor" && role !== "admin") {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-xl font-bold text-destructive">Access denied</h1>
        <p className="text-muted-foreground mt-2">
          Only professors and admins can view session analytics.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <ProfessorSessionDetail sessionId={sessionId} />
    </div>
  );
}
