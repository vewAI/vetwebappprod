"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
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

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <li className="flex items-center gap-5 py-2.5">
      <span className="w-1/2 text-sm text-gray-500 sm:w-1/3 dark:text-gray-400">{label}</span>
      <span className="w-1/2 text-sm font-medium text-gray-700 sm:w-2/3 dark:text-gray-400">{children}</span>
    </li>
  );
}

export function SessionInfoPanel({ session, status, variant = "student" }: Props) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="px-6 py-5">
        <h3 className="text-base font-medium text-primary dark:text-white/90">Session Info</h3>
      </div>
      <div className="border-t border-gray-200 p-4 sm:p-6 dark:border-gray-800">
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          <InfoRow label="Name">{session.friendlyName}</InfoRow>
          <InfoRow label="Status">
            <Badge variant={status === "active" ? "success" : status === "scheduled" ? "warning" : "secondary"} className="capitalize">
              {statusLabel(status)}
            </Badge>
          </InfoRow>
          <InfoRow label="Window">
            {new Date(session.startAt).toLocaleString()} — {new Date(session.endAt).toLocaleString()}
          </InfoRow>
          {variant === "professor" && (
            <>
              <InfoRow label="Year group">{session.yearGroupName ?? "—"}</InfoRow>
              <InfoRow label="Internal name">{session.name}</InfoRow>
              <InfoRow label="Access code">{session.accessCode ? "Yes (hidden)" : "Open"}</InfoRow>
              <InfoRow label="Attempt limit / student">{session.attemptLimitPerStudent ?? "Unlimited"}</InfoRow>
              <InfoRow label="Created">{new Date(session.createdAt).toLocaleString()}</InfoRow>
              <InfoRow label="Created by">{session.createdByName ?? session.createdBy}</InfoRow>
            </>
          )}
          {variant === "student" && session.accessCode && <InfoRow label="Access">Code required to join</InfoRow>}
          {variant === "student" && session.attemptLimitPerStudent != null && session.attemptLimitPerStudent > 0 && (
            <InfoRow label="Attempts allowed">{session.attemptLimitPerStudent} per student</InfoRow>
          )}
          {session.description ? <InfoRow label="Description">{session.description}</InfoRow> : null}
        </ul>
      </div>
    </div>
  );
}
