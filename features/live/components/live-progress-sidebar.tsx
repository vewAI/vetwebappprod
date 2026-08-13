"use client";

import Link from "next/link";
import { CheckCircle, Circle, ChevronLeft, Lightbulb } from "lucide-react";
import type { Case } from "@/features/case-selection/models/case";
import type { Stage } from "@/features/stages/types";
import { cn } from "@/lib/utils";

type LiveProgressSidebarProps = {
  caseItem: Case;
  stages: Stage[];
  currentStageIndex: number;
};

export function LiveProgressSidebar({
  caseItem,
  stages,
  currentStageIndex,
}: LiveProgressSidebarProps) {
  const completedCount = stages.filter((stage, index) => stage.completed || index < currentStageIndex).length;

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-border bg-muted/15">
      <div className="shrink-0 space-y-3 border-b border-border p-3">
        <Link
          href="/cases"
          className="flex h-8 w-full items-center justify-center gap-1 rounded-md border border-border px-2 text-xs font-medium transition-colors hover:bg-muted"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to Cases
        </Link>
        <div className="min-w-0">
          <h1 className="line-clamp-3 break-words text-sm font-semibold leading-snug">
            {caseItem.title}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {caseItem.species} <span aria-hidden="true">·</span> {caseItem.category}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Case Progress
        </h2>
        <div className="space-y-1">
          {stages.map((stage, index) => {
            const isCurrent = index === currentStageIndex;
            const isCompleted = stage.completed || index < currentStageIndex;
            const label = isCurrent || isCompleted ? stage.title : "Upcoming Stage";

            return (
              <div
                key={stage.id}
                className={cn(
                  "flex min-w-0 items-start gap-2 rounded-md px-2 py-2 text-xs leading-snug",
                  isCurrent && "bg-primary/20 text-foreground",
                  !isCurrent && "text-muted-foreground",
                )}
              >
                {isCompleted ? (
                  <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                ) : (
                  <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                )}
                <span className="min-w-0 break-words">{label}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-md bg-muted px-2 py-2 text-xs text-muted-foreground">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Complete the required conversation turns before advancing.</span>
        </div>
      </div>

      <div className="shrink-0 border-t border-border p-3 text-xs text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>Progress</span>
          <span>{completedCount}/{stages.length}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${stages.length ? (completedCount / stages.length) * 100 : 0}%` }}
          />
        </div>
      </div>
    </aside>
  );
}
