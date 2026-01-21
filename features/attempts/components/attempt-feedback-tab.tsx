"use client";

import type {
  Attempt,
  AttemptFeedback,
} from "@/features/attempts/models/attempt";
import type { Stage } from "@/features/stages/types";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

type AttemptFeedbackTabProps = {
  attempt: Attempt;
  feedback: AttemptFeedback[];
  stages: Stage[];
};

const formatDate = (dateString?: string) => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export function AttemptFeedbackTab({
  attempt,
  feedback,
  stages,
}: AttemptFeedbackTabProps) {
  return (
    <div className="mt-2 space-y-6">
      {/* Stage-specific feedback */}
      {feedback.length > 0 ? (
        <div>
          <h2 className="text-2xl font-bold mb-4">Stage Feedback</h2>
          {feedback.map((item) => {
            const stage = stages[item.stageIndex];
            const stageName = stage?.title || `Stage ${item.stageIndex + 1}`;

            return (
              <div key={item.id} className="border rounded-lg p-6 mb-6 bg-card">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xl font-semibold">
                    {stageName} Feedback
                  </h3>
                  <Badge variant="outline" className="text-xs">
                    {formatDate(item.createdAt)}
                  </Badge>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <div
                    dangerouslySetInnerHTML={{
                      __html: item.feedbackContent,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="border rounded-lg p-8 text-center bg-muted/30">
          <h3 className="text-lg font-medium mb-2">
            No Stage Feedback Available
          </h3>
          <p className="text-muted-foreground mb-4">
            No feedback has been generated for individual stages in this
            attempt.
          </p>
          {attempt.completionStatus === "in_progress" && (
            <p className="text-sm">
              You can generate feedback for each stage by clicking the
              &quot;Generate Feedback&quot; button during your attempt.
            </p>
          )}
        </div>
      )}

      {/* Overall feedback */}
      {attempt.overallFeedback ? (
        <div>
          <h2 className="text-2xl font-bold mb-4">Overall Assessment</h2>
          <div className="border rounded-lg p-6 bg-card">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <div
                dangerouslySetInnerHTML={{
                  __html: attempt.overallFeedback,
                }}
              />
            </div>
          </div>
        </div>
      ) : attempt.completionStatus === "completed" ? (
        <div className="border rounded-lg p-8 text-center bg-muted/30 animate-pulse">
          <div className="flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div>
              <h3 className="text-lg font-medium mb-2">
                Generating Overall Assessment...
              </h3>
              <p className="text-muted-foreground">
                The AI is analyzing your performance across all stages. This may
                take a moment.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="border rounded-lg p-8 text-center bg-muted/30">
          <h3 className="text-lg font-medium mb-2">No Overall Assessment</h3>
          <p className="text-muted-foreground">
            An overall assessment will be available once you complete this
            attempt.
          </p>
        </div>
      )}

      {/* Professor Feedback */}
      {attempt.professorFeedback && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4 text-purple-700">
            Professor Feedback
          </h2>
          <div className="border rounded-lg p-6 bg-purple-50 border-purple-200">
            <div className="prose prose-sm dark:prose-invert max-w-none text-purple-900">
              {attempt.professorFeedback}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
