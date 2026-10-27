"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CaseSession, SessionStatus } from "../models/caseSession";

type Props = {
  session: CaseSession;
  status: SessionStatus;
  variant?: "professor" | "student";
};

function statusLabel(status: SessionStatus) {
  if (status === "active") return "Active";
  if (status === "scheduled") return "Scheduled";
  return "Completed";
}

export function SessionInfoPanel({
  session,
  status,
  variant = "student",
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-primary">Session</CardTitle>
      </CardHeader>
      <CardContent className="text-sm space-y-2">
        <div>
          <span className="font-medium">Name:</span> {session.friendlyName}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium">Status:</span>
          <Badge
            variant={status === "active" ? "success" : status === "scheduled" ? "warning" : "secondary"}
            className="capitalize"
          >
            {statusLabel(status)}
          </Badge>
        </div>
        <div>
          <span className="font-medium">Window:</span>{" "}
          {new Date(session.startAt).toLocaleString()} —{" "}
          {new Date(session.endAt).toLocaleString()}
        </div>
        {variant === "professor" && (
          <>
            <div>
              <span className="font-medium">Year group:</span> {session.yearGroupName ?? "—"}
            </div>
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
            <div>
              <span className="font-medium">Created:</span>{" "}
              {new Date(session.createdAt).toLocaleString()}
            </div>
            <div>
              <span className="font-medium">Created by:</span>{" "}
              {session.createdByName ?? session.createdBy}
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
