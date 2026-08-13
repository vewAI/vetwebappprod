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
  onStageSelect?: (index: number) => void;
  guidedMode?: boolean;
};

export function LiveProgressSidebar({
  caseItem,
  stages,
  currentStageIndex,
  onStageSelect,
  guidedMode,
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
              <button
                type="button"
                key={stage.id}
                disabled={!onStageSelect || index > currentStageIndex}
                onClick={() => onStageSelect?.(index)}
                className={cn(
                  "flex w-full min-w-0 items-start gap-2 rounded-md px-2 py-2 text-left text-xs leading-snug transition-colors",
                  isCurrent && "bg-primary/20 text-foreground",
                  !isCurrent && "text-muted-foreground",
                  index <= currentStageIndex && !isCurrent && "hover:bg-muted",
                  index > currentStageIndex && "cursor-default",
                )}
              >
                {isCompleted ? (
                  <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                ) : (
                  <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                )}
                <span className="min-w-0 break-words">{label}</span>
              </button>
            );
          })}
        </div>

        {guidedMode !== undefined && (
          <button
            type="button"
            onClick={() => {
              const next = !guidedMode;
              window.localStorage.setItem("guided-mode", String(next));
              window.dispatchEvent(new Event("guided-mode-change"));
            }}
            className={cn(
              "mt-4 flex w-full items-start gap-2 rounded-md px-2 py-2 text-xs transition-colors",
              guidedMode
                ? "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-950/40 dark:text-amber-200"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            <Lightbulb className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", guidedMode && "text-amber-600 dark:text-amber-400")} />
            <span>{guidedMode ? "Guided mode ON" : "Enable guided mode"}</span>
          </button>
        )}
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
