"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import type { Stage } from "@/features/stages/types";

type LiveStageProgressProps = {
  stages: Stage[];
  currentIndex: number;
  onStageSelect?: (index: number) => void;
};

export function LiveStageProgress({
  stages,
  currentIndex,
  onStageSelect,
}: LiveStageProgressProps) {
  return (
    <div className="flex items-center justify-center gap-1 px-4 py-2">
      {stages.map((stage, index) => {
        const isCompleted = stage.completed || index < currentIndex;
        const isCurrent = index === currentIndex;
        const isFuture = index > currentIndex;

        return (
          <button
            key={stage.id}
            onClick={() => {
              if (isCompleted && onStageSelect) {
                onStageSelect(index);
              }
            }}
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-all",
              isCurrent && "bg-primary text-primary-foreground",
              isCompleted && !isCurrent && "bg-primary/10 text-primary cursor-pointer hover:bg-primary/20",
              isFuture && "bg-muted text-muted-foreground"
            )}
            title={stage.title}
          >
            {isCompleted && !isCurrent && (
              <Check className="h-3 w-3" />
            )}
            <span className="max-w-[80px] truncate">{stage.title}</span>
          </button>
        );
      })}
    </div>
  );
}
