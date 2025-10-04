"use client";

import { useState } from "react";
import Link from "next/link";
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
import { Clock, Calendar, ChevronRight, Trash2 } from "lucide-react";
import type { Attempt } from "../models/attempt";

import type { Case } from "@/features/case-selection/models/case";

type AttemptCardProps = {
  attempt: Attempt;
  caseItem?: Case;
  onDelete: () => void;
};

export function AttemptCard({ attempt, caseItem, onDelete }: AttemptCardProps) {
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
    <Card className="overflow-hidden transition-all duration-300 hover:shadow-lg">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="line-clamp-1">{attempt.title}</CardTitle>
            <CardDescription>
              {caseItem?.title || "Unknown Case"}
            </CardDescription>
          </div>
          <Badge
            variant={
              attempt.completionStatus === "completed"
                ? "success"
                : attempt.completionStatus === "in_progress"
                ? "warning"
                : "destructive"
            }
          >
            {attempt.completionStatus === "completed"
              ? "Completed"
              : attempt.completionStatus === "in_progress"
              ? "In Progress"
              : "Abandoned"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span>{formatDate(attempt.createdAt)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>{formatTimeSpent(attempt.timeSpentSeconds)}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          onClick={handleDeleteClick}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <>Deleting...</>
          ) : (
            <>
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </>
          )}
        </Button>

        <Link href={`/attempts/${attempt.id}`}>
          <Button size="sm">
            View Attempt
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
