"use client";

import React, { Suspense } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/features/auth/services/authService";
import { ProfessorSessionDetail } from "@/features/case-sessions/components/ProfessorSessionDetail";
import { Skeleton } from "@/components/ui/skeleton";

function ProfessorSessionDetailContent() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const { role, loading } = useAuth();

  if (loading) {
    return (
      <div className="container mx-auto space-y-4 px-4 pb-8">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (role !== "professor" && role !== "admin") {
    return (
      <div className="container mx-auto px-4 pb-8 text-center">
        <h1 className="text-xl font-bold text-destructive">Access denied</h1>
        <p className="mt-2 text-muted-foreground">Only professors and admins can view session analytics.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 pb-8">
      <ProfessorSessionDetail sessionId={sessionId} />
    </div>
  );
}

export default function ProfessorSessionDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto space-y-4 px-4 pb-8">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-48 w-full" />
        </div>
      }
    >
      <ProfessorSessionDetailContent />
    </Suspense>
  );
}
