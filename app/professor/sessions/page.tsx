"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/services/authService";
import { SessionList } from "@/features/case-sessions/components/SessionList";
import { Breadcrumb } from "@/features/navigation/components/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";

function ProfessorSessionsContent() {
  const { role, loading } = useAuth();
  const searchParams = useSearchParams();
  const caseId = searchParams.get("caseId")?.trim() || undefined;

  if (loading) {
    return (
      <div className="container mx-auto space-y-4 px-4 pb-8">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (role !== "professor" && role !== "admin") {
    return (
      <div className="container mx-auto px-4 pb-8 text-center">
        <Breadcrumb items={[{ label: "Home", href: "/dashboard" }, { label: "Case Sessions" }]} />
        <h1 className="text-xl font-bold text-destructive">Access denied</h1>
        <p className="mt-2 text-muted-foreground">Only professors and admins can manage sessions.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 pb-8">
      <Breadcrumb items={[{ label: "Home", href: "/dashboard" }, { label: "Case Sessions" }]} />
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-primary md:text-4xl lg:text-5xl">Case Sessions</h1>
        <p className="mt-4 text-xl text-muted-foreground">Filter sessions and open a session dashboard.</p>
        <div className="mt-4">
          <Button asChild>
            <Link href={caseId ? `/professor/sessions/new?caseId=${encodeURIComponent(caseId)}` : "/professor/sessions/new"}>
              Create session
            </Link>
          </Button>
        </div>
      </header>
      <SessionList initialCaseId={caseId} />
    </div>
  );
}

export default function ProfessorSessionsPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto space-y-4 px-4 pb-8">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <ProfessorSessionsContent />
    </Suspense>
  );
}
