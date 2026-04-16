"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/services/authService";
import { PendingReviewsList } from "./PendingReviewsList";
import type { PendingReview } from "../models/courseTypes";
import axios from "axios";

export function PendingReviewsCard() {
  const { session } = useAuth();
  const [count, setCount] = useState<number | null>(null);
  const [reviews, setReviews] = useState<PendingReview[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!session?.access_token) return;
    (async () => {
      try {
        const resp = await axios.get("/api/professor/pending-reviews", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        setCount(resp.data.count);
        setReviews(resp.data.reviews);
      } catch {
        setCount(0);
      }
    })();
  }, [session?.access_token]);

  return (
    <>
      <Card
        className="min-h-36 p-2 h-full transition-all duration-300 ease-out hover:bg-muted/100 dark:hover:bg-muted/80 shadow-lg bg-muted/50 border border-transparent border-teal-500/30 cursor-pointer"
        onClick={() => reviews.length > 0 && setOpen(true)}
      >
        <CardHeader className="pb-1 grow text-center px-3">
          <CardTitle className="text-sm font-medium text-muted-foreground text-teal-600">
            Pending Reviews
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2 px-3">
          <div className="text-lg font-semibold">
            {count ?? "..."}
            {count !== null && count > 0 && (
              <span className="text-xs text-muted-foreground ps-2">
                awaiting feedback
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <PendingReviewsList
        reviews={reviews}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
