"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/features/auth/services/authService";
import { CreateCaseSessionForm } from "@/features/case-sessions/components/CreateCaseSessionForm";
import { Breadcrumb } from "@/features/navigation/components/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";

const breadcrumbItems = [
  { label: "Home", href: "/dashboard" },
  { label: "Case Sessions", href: "/professor/sessions" },
  { label: "Create Session" },
];

function PageHeader() {
  return (
    <>
      <Breadcrumb items={breadcrumbItems} />
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-primary md:text-4xl lg:text-5xl">Create Session</h1>
        <p className="mt-4 text-xl text-muted-foreground">Choose a case and set the session window.</p>
      </header>
    </>
  );
}

export default function NewSessionClient() {
  const { role, loading } = useAuth();
  const searchParams = useSearchParams();
  const caseId = searchParams.get("caseId");

  if (loading) {
    return (
      <div className="container mx-auto px-4 pb-8">
        <PageHeader />
        <div className="mx-auto max-w-xl space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  if (role !== "professor" && role !== "admin") {
    return (
      <div className="container mx-auto px-4 pb-8 text-center">
        <PageHeader />
        <h2 className="text-xl font-bold text-destructive">Access denied</h2>
        <p className="mt-2 text-muted-foreground">Only professors and admins can create sessions.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 pb-8">
      <PageHeader />
      <div className="mx-auto max-w-xl">
        <CreateCaseSessionForm initialCaseId={caseId} />
      </div>
    </div>
  );
}
