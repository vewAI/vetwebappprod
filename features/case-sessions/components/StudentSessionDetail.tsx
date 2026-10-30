"use client";

import React, { useState } from "react";
import { deriveStatus } from "../models/caseSession";
import { useCaseSessionDetail } from "../hooks/useCaseSessionDetail";
import { SessionCasePanel } from "./SessionCasePanel";
import { MySessionAttemptsList } from "./MySessionAttemptsList";
import { JoinSessionDialog } from "./JoinSessionDialog";
import { StartSessionCard } from "./StartSessionCard";
import { Breadcrumb } from "@/features/navigation/components/breadcrumb";
import { useAuth } from "@/features/auth/services/authService";
import { Loader2 } from "lucide-react";

type Props = {
  sessionId: string;
};

export function StudentSessionDetail({ sessionId }: Props) {
  const { session, attempts, loading, error } = useCaseSessionDetail(sessionId);
  const { user } = useAuth();
  const [joinOpen, setJoinOpen] = useState(false);

  if (loading) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Home", href: "/dashboard" },
            { label: "Start", href: "/start" },
            { label: "Session" },
          ]}
        />
        <div className="flex items-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          Loading session…
        </div>
      </>
    );
  }

  if (error || !session) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Home", href: "/dashboard" },
            { label: "Start", href: "/start" },
            { label: "Session not found" },
          ]}
        />
        <div className="py-12 text-center text-destructive">{error ?? "Session not found"}</div>
      </>
    );
  }

  const status = deriveStatus(session);
  const myAttempts = user?.id ? attempts.filter((attempt) => attempt.userId === user.id) : attempts;
  const limit = session.attemptLimitPerStudent;
  const remaining = limit == null || limit <= 0 ? null : Math.max(0, limit - myAttempts.length);
  const canStart = status === "active" && remaining !== 0;

  return (
    <div className="space-y-8">
      <Breadcrumb
        items={[
          { label: "Home", href: "/dashboard" },
          { label: "Start", href: "/start" },
          { label: session.friendlyName },
        ]}
      />
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-primary md:text-4xl lg:text-5xl">
          {session.friendlyName}
        </h1>
        <p className="mt-4 text-xl text-muted-foreground">{session.case?.title ?? session.name}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Created {new Date(session.createdAt).toLocaleString()}
          {session.createdByName ? ` by ${session.createdByName}` : ""}
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-2">
        <StartSessionCard
          session={session}
          status={status}
          canStart={canStart}
          remainingAttempts={remaining}
          onStart={() => setJoinOpen(true)}
        />
        <SessionCasePanel session={session} titleClassName="text-xl font-semibold text-primary" />
      </div>

      <MySessionAttemptsList attempts={myAttempts} attemptLimit={limit} canResume={status === "active"} />

      <JoinSessionDialog
        open={joinOpen}
        onOpenChange={setJoinOpen}
        session={session}
        caseId={session.caseId}
      />
    </div>
  );
}
