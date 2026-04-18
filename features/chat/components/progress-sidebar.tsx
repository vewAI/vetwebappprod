"use client";

import { CheckCircle, Circle, ChevronLeft, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { Case } from "@/features/case-selection/models/case";
import type { Stage } from "@/features/stages/types";
import { getStudentGuidance } from "@/features/stages/services/studentGuidance";

type ProgressSidebarProps = {
  caseItem: Case;
  stages: Stage[];
  currentStageIndex: number;
  onStageSelect: (index: number) => void;
  guidedMode?: boolean;
};

export function ProgressSidebar({ caseItem, stages, currentStageIndex, onStageSelect, guidedMode }: ProgressSidebarProps) {
  const currentStage = stages[currentStageIndex];
  const guidance = guidedMode ? getStudentGuidance(currentStage?.title, currentStage?.description) : null;

  return (
    <div className="flex h-full flex-col border-r bg-muted/20">
      <div className="border-b p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back to Cases
            </Button>
          </Link>
        </div>
        <div>
          <h2 className="text-lg font-semibold leading-tight">{caseItem.title}</h2>
          <div className="mt-1 text-sm text-muted-foreground">
            {caseItem.species} - {caseItem.category}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="mb-3 text-sm font-medium">Case Progress</h3>
        <div className="space-y-1">
          {stages.map((stage, index) => {
            const isFuture = index > currentStageIndex;
            const visibleLabel = isFuture ? "Upcoming Stage" : stage.title;
            return (
            <button
              key={stage.id}
              onClick={() => onStageSelect(index)}
              className={cn(
                "flex w-full items-center rounded-md px-3 py-2 text-sm transition-colors",
                currentStageIndex === index ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              {stage.completed ? <CheckCircle className="mr-2 h-4 w-4 text-green-500" /> : <Circle className="mr-2 h-4 w-4" />}
              <span className="text-left">{visibleLabel}</span>
            </button>
            );
          })}
        </div>

        {guidance && (
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">What to do here</span>
            </div>
            <p className="text-sm text-amber-900 dark:text-amber-100 mb-2">{guidance.whatToDo}</p>
            <ul className="text-xs text-amber-800 dark:text-amber-200 space-y-1">
              {guidance.tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-amber-500 mt-0.5">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="border-t p-4">
        <div className="text-sm text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Progress</span>
            <span>
              {stages.filter((s) => s.completed).length}/{stages.length}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{
                width: `${(stages.filter((s) => s.completed).length / stages.length) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
