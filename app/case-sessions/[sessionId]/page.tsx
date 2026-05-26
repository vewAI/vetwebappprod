"use client";

import React, { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/services/authService";
import { StudentSessionDetail } from "@/features/case-sessions/components/StudentSessionDetail";
import { Skeleton } from "@/components/ui/skeleton";

export default function CaseSessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const { role, loading } = useAuth();

  const isProfessorOrAdmin = role === "professor" || role === "admin";

  useEffect(() => {
    if (!loading && isProfessorOrAdmin) {
      router.replace(`/professor/sessions/${sessionId}`);
    }
  }, [loading, isProfessorOrAdmin, router, sessionId]);

  if (loading || isProfessorOrAdmin) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-4 max-w-5xl">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <StudentSessionDetail sessionId={sessionId} />
    </div>
  );
}
