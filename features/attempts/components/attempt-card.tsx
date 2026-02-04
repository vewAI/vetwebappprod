"use client";

import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Calendar, ChevronRight } from "lucide-react";
import type { AttemptSummary } from "../models/attempt";

import type { Case } from "@/features/case-selection/models/case";
import { cn } from "@/lib/utils";

type AttemptCardProps = {
  attempt: AttemptSummary;
  caseItem?: Case;
};

export function AttemptCard({ attempt }: AttemptCardProps) {
  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Format time spent
  const formatTimeSpent = (seconds: number) => {
    if (seconds < 60) return `${seconds} sec`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes} min${minutes !== 1 ? "s" : ""}`;
  };

  return (
    <Card
      className={cn(
        "pt-4 pb-3 overflow-hidden transition-all duration-300 ease-out",
        "hover:-translate-y-0.5 hover:shadow-lg",
        "hover:bg-muted/40 dark:hover:bg-muted/60",
        "focus-within:ring-2 focus-within:ring-primary/30",

        attempt.completionStatus === "completed" && "border-l-4 border-l-teal-500/60",
        attempt.completionStatus === "in_progress" && "border-l-4 border-l-amber-700/50",
        attempt.completionStatus === "abandoned" && "border-l-4 border-l-rose-500/60",
      )}
    >
      <div className="flex gap-4 px-4 h-full">
        {/* Case Image */}
        {attempt?.caseImageUrl && (
          <div className="">
            <div className="relative  w-24 h-24 mb-2">
              <Image src={attempt?.caseImageUrl} alt={attempt?.caseTitle} fill className="object-cover border p-1" sizes="96px" priority={false} />
            </div>

            <span
              className={`text-xs py-1 px-3 tracking-wide ${
                attempt.completionStatus === "completed"
                  ? "text-emerald-700 "
                  : attempt.completionStatus === "in_progress"
                    ? "text-amber-700 "
                    : "text-red-500 "
              }`}
            >
              {attempt.completionStatus === "completed" ? "Completed" : attempt.completionStatus === "in_progress" ? "In Progress" : "Abandoned"}
            </span>
          </div>
        )}

        {/* Card Content */}
        <div className="flex-1 flex flex-col h-full">
          <CardHeader className=" px-0">
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0">
                <CardTitle className="text-base font-semibold text-primary">{attempt.caseTitle}</CardTitle>
                <span className="text-xs text-muted-foreground font-semibold"> {attempt.title}</span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pb-2 px-0 flex-grow">
            <CardDescription className="text-xs mt-0.5">
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 opacity-70" />
                  <span>{formatDate(attempt.createdAt)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 opacity-70" />
                  <span>{formatTimeSpent(attempt.timeSpentSeconds)}</span>
                </div>
              </div>
            </CardDescription>
          </CardContent>

          <CardFooter className="flex justify-end px-0">
            <div className="flex items-center gap-2">
              {attempt.completionStatus !== "completed" ? (
                <Link href={`/case/${attempt.caseId}/attempt?attempt=${attempt.id}`}>
                  <Button size="sm" variant="ghost">
                    Continue
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <Link href={`/attempts/${attempt.id}`}>
                  <Button size="sm" variant="ghost">
                    View
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              )}
            </div>
          </CardFooter>
        </div>
      </div>
    </Card>
  );
}
