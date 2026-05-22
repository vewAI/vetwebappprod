"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/features/auth/services/authService";
import { CreateCaseSessionForm } from "@/features/case-sessions/components/CreateCaseSessionForm";
import { Skeleton } from "@/components/ui/skeleton";

export default function NewSessionClient() {
  const { role, loading } = useAuth();
  const searchParams = useSearchParams();
  const caseId = searchParams.get("caseId");

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (role !== "professor" && role !== "admin") {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-xl font-bold text-destructive">Access denied</h1>
        <p className="text-muted-foreground mt-2">
          Only professors and admins can create sessions.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-xl">
      <CreateCaseSessionForm initialCaseId={caseId} />
    </div>
  );
}
