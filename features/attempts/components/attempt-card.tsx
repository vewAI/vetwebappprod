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
import { Button } from "@/components/ui/button";
import { Clock, Calendar, ChevronRight, Trash2 } from "lucide-react";
import type { AttemptSummary } from "../models/attempt";

import type { Case } from "@/features/case-selection/models/case";
import { cn } from "@/lib/utils";

type AttemptCardProps = {
  attempt: AttemptSummary;
  caseItem?: Case;
  onDelete: () => void;
};

export function AttemptCard({ attempt, onDelete }: AttemptCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

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

  // Handle delete confirmation
  const handleDeleteClick = () => {
    if (
      window.confirm(
        `Are you sure you want to delete "${attempt.title}"? This action cannot be undone.`
      )
    ) {
      setIsDeleting(true);
      onDelete();
    }
  };

  return (
    <Card
      className={cn(
        "overflow-hidden transition-all duration-300 ease-out",
        "hover:-translate-y-0.5 hover:shadow-lg",
        "hover:bg-muted/40 dark:hover:bg-muted/60",
        "focus-within:ring-2 focus-within:ring-primary/30",

        attempt.completionStatus === "completed" &&
          "border-l-4 border-l-rose-500/60",
        attempt.completionStatus === "in_progress" &&
          "border-l-4 border-l-teal-700/50",
        attempt.completionStatus === "abandoned" &&
          "border-l-4 border-l-rose-500/60"
      )}
    >
      <div className="flex gap-4 px-4 h-full">
        {/* Case Image */}
        {attempt?.caseImageUrl && (
          <div className="relative w-24 h-24 flex-shrink-0">
            <Image
              src={attempt?.caseImageUrl}
              alt={attempt?.caseTitle}
              fill
              className="object-cover border p-1"
              sizes="96px"
              priority={false}
            />
          </div>
        )}

        {/* Card Content */}
        <div className="flex-1 flex flex-col h-full">
          <CardHeader className="pb-3 px-0">
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0">
                <CardTitle className="text-base font-semibold text-primary">
                  {attempt.title}
                </CardTitle>
              </div>
            </div>
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
            <p
              className={cn(
                "shrink text-sm",
                attempt.completionStatus === "completed"
                  ? "text-emerald-500"
                  : attempt.completionStatus === "in_progress"
                  ? "text-amber-500"
                  : "text-destructive"
              )}
            >
              {attempt.completionStatus === "completed"
                ? "Completed"
                : attempt.completionStatus === "in_progress"
                ? "In Progress"
                : "Abandoned"}
            </p>
          </CardHeader>

          <CardContent className="pt-0 px-0 pb-3 flex-grow">
            <CardDescription className="text-xs mt-0.5">
              {attempt?.caseTitle || "Unknown Case"}
            </CardDescription>
          </CardContent>

          <CardFooter className="flex justify-between px-0">
            <Button
              variant="ghost"
              size="sm"
              className="
              text-muted-foreground
              hover:text-destructive
              transition-colors
            "
              onClick={handleDeleteClick}
              disabled={isDeleting}
            >
              {isDeleting ? (
                "Deleting..."
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-1" />
                  <span className="sr-only">Delete</span>
                </>
              )}
            </Button>

            <div className="flex items-center gap-2">
              {attempt.completionStatus === "completed" ? (
                <Link href={`/attempts/${attempt.id}?chat=1`}>
                  <Button size="sm" className="shadow-sm" variant="ghost">
                    Open in Chat
                  </Button>
                </Link>
              ) : (
                <Link href={`/attempts/${attempt.id}`}>
                  <Button size="sm" variant="ghost">
                    Continue
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
