"use client";

import { CaseLibrary } from "@/features/case-selection/components/case-library";
import { professorCaseHref } from "@/features/case-selection/caseViewHref";
import { Breadcrumb } from "@/features/navigation/components/breadcrumb";
import { useAuth } from "@/features/auth/services/authService";
import { Skeleton } from "@/components/ui/skeleton";

export default function CasesPage() {
  const { role, loading } = useAuth();

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
        <Breadcrumb items={[{ label: "Home", href: "/dashboard" }, { label: "Clinical Cases" }]} />
        <h1 className="text-xl font-bold text-destructive">Access denied</h1>
        <p className="mt-2 text-muted-foreground">Only professors and admins can manage cases.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 pb-8">
      <Breadcrumb items={[{ label: "Home", href: "/dashboard" }, { label: "Clinical Cases" }]} />
      <CaseLibrary getCaseHref={(caseItem) => professorCaseHref(caseItem.id)} showTestAction />
    </div>
  );
}
