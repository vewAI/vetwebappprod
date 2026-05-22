"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CaseSession, SessionStatus } from "../models/caseSession";

type Props = {
  session: CaseSession;
  status: SessionStatus;
  variant?: "professor" | "student";
};

export function SessionInfoPanel({
  session,
  status,
  variant = "student",
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Session</CardTitle>
      </CardHeader>
      <CardContent className="text-sm space-y-2">
        <div>
          <span className="font-medium">Name:</span> {session.friendlyName}
        </div>
        <div>
          <span className="font-medium">Status:</span>{" "}
          <span className="capitalize">{status}</span>
        </div>
        <div>
          <span className="font-medium">Window:</span>{" "}
          {new Date(session.startAt).toLocaleString()} —{" "}
          {new Date(session.endAt).toLocaleString()}
        </div>
        {variant === "professor" && (
          <>
            <div>
              <span className="font-medium">Internal name:</span> {session.name}
            </div>
            <div>
              <span className="font-medium">Access code:</span>{" "}
              {session.accessCode ? "Yes (hidden)" : "Open"}
            </div>
            <div>
              <span className="font-medium">Attempt limit / student:</span>{" "}
              {session.attemptLimitPerStudent ?? "Unlimited"}
            </div>
          </>
        )}
        {variant === "student" && session.accessCode && (
          <div>
            <span className="font-medium">Access:</span> Code required to join
          </div>
        )}
        {variant === "student" &&
          session.attemptLimitPerStudent != null &&
          session.attemptLimitPerStudent > 0 && (
            <div>
              <span className="font-medium">Attempts allowed:</span>{" "}
              {session.attemptLimitPerStudent} per student
            </div>
          )}
        {session.description && (
          <p className="pt-2 text-muted-foreground">{session.description}</p>
        )}
      </CardContent>
    </Card>
  );
}
