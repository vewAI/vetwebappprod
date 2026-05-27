"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronRight } from "lucide-react";
import type { CaseSession } from "../models/caseSession";
import { deriveStatus } from "../models/caseSession";
import { JoinSessionDialog } from "./JoinSessionDialog";

type CaseSessionCardProps = {
  session: CaseSession;
  /** Professor view links to session dashboard instead of join flow */
  variant?: "student" | "professor";
};

function formatSessionDateRange(startAt: string, endAt: string): string {
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  const start = new Date(startAt).toLocaleDateString(undefined, opts);
  const end = new Date(endAt).toLocaleDateString(undefined, opts);
  return `${start} – ${end}`;
}

export function CaseSessionCard({
  session,
  variant = "student",
}: CaseSessionCardProps) {
  const [joinOpen, setJoinOpen] = useState(false);
  const status = deriveStatus(session);
  const imageUrl = session.case?.imageUrl ?? "";
  const displayImage = /^https?:\/\//.test(String(imageUrl))
    ? String(imageUrl)
    : "/placeholder.svg";
  const caseTitle = session.case?.title ?? "Case";
  const difficulty = session.case?.difficulty;

  return (
    <>
      <Card className="overflow-hidden pt-0 transition-all duration-300 hover:shadow-lg">
        <div className="relative h-48 w-full overflow-hidden bg-gray-100">
          <Image
            src={displayImage}
            alt={caseTitle}
            fill
            className="object-cover"
            sizes="500px"
            priority={false}
          />
          {difficulty && (
            <div className="absolute right-3 top-3">
              <Badge
                variant={
                  difficulty === "Easy"
                    ? "success"
                    : difficulty === "Medium"
                      ? "warning"
                      : "destructive"
                }
              >
                {difficulty}
              </Badge>
            </div>
          )}
          <div className="absolute left-3 top-3">
            <Badge
              variant={
                status === "active"
                  ? "success"
                  : status === "scheduled"
                    ? "warning"
                    : "secondary"
              }
              className="capitalize"
            >
              {status}
            </Badge>
          </div>
        </div>
        <CardHeader>
          <CardTitle>{session.friendlyName}</CardTitle>
          <CardDescription>
            {caseTitle}
            {session.case?.species ? ` · ${session.case.species}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {session.description ? (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {session.description}
            </p>
          ) : null}
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <Calendar className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{formatSessionDateRange(session.startAt, session.endAt)}</span>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          {variant === "professor" ? (
            <Button variant="sessions" className="w-full" asChild>
              <Link href={`/professor/sessions/${session.id}`}>
                View details
                <ChevronRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <>
              <Button variant="outline" className="w-full" asChild>
                <Link href={`/case-sessions/${session.id}`}>
                  View details
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              {status === "active" ? (
                <Button
                  variant="sessions"
                  className="w-full"
                  onClick={() => setJoinOpen(true)}
                >
                  Start Case
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button className="w-full" variant="secondary" disabled>
                  {status === "scheduled"
                    ? `Starts ${new Date(session.startAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                    : "Session ended"}
                </Button>
              )}
            </>
          )}
        </CardFooter>
      </Card>

      {variant === "student" && status === "active" && (
        <JoinSessionDialog
          open={joinOpen}
          onOpenChange={setJoinOpen}
          session={session}
          caseId={session.caseId}
        />
      )}
    </>
  );
}
