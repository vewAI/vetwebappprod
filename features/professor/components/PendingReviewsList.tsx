"use client";

import React from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { PendingReview } from "../models/courseTypes";

type Props = {
  reviews: PendingReview[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PendingReviewsList({ reviews, open, onOpenChange }: Props) {
  const formatDate = (date: string) => new Date(date).toLocaleDateString();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pending Reviews ({reviews.length})</DialogTitle>
        </DialogHeader>

        {reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            All caught up! No pending reviews.
          </p>
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => (
              <div
                key={r.attemptId}
                className="flex items-center justify-between gap-3 border rounded-lg p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{r.studentName}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.caseTitle} &middot; Completed {formatDate(r.completedAt)}
                  </p>
                </div>
                <Link href={`/professor/students/${r.studentId}/attempts/${r.attemptId}`}>
                  <Button size="sm" variant="outline">
                    Review
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
