"use client";

import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import type { Case } from "@/features/case-selection/models/case";
import type { Stage } from "@/features/stages/types";

type LiveIntroOverlayProps = {
  caseItem: Case;
  stages: Stage[];
  isResume: boolean;
  onStart: () => void;
};

// Pre-session briefing shown before the microphone connects. Gives students a
// moment to orient (and provides the required user gesture for getUserMedia /
// AudioContext on iOS/Safari).
export function LiveIntroOverlay({ caseItem, stages, isResume, onStart }: LiveIntroOverlayProps) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/95 p-6">
      <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {caseItem.category || "Clinical case"}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">{caseItem.title}</h1>
        {caseItem.species && (
          <p className="mt-1 text-sm text-muted-foreground">
            {caseItem.species}
            {caseItem.category ? ` · ${caseItem.category}` : ""}
          </p>
        )}

        <div className="mt-4 rounded-lg border p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Stages
          </p>
          <ol className="space-y-1">
            {stages.map((stage, i) => (
              <li key={stage.id ?? i} className="flex items-center gap-2 text-sm">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                  {i + 1}
                </span>
                {stage.title}
              </li>
            ))}
          </ol>
        </div>

        <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
          <li>· Speak out loud — the persona hears you and answers by voice.</li>
          <li>· Click an avatar (OWNER / NURSE / LAB) to switch who you talk to.</li>
          <li>· Requested test results appear as written text in the clipboard panel.</li>
        </ul>

        <Button size="lg" className="mt-5 w-full" onClick={onStart}>
          <Play className="mr-2 h-4 w-4" />
          {isResume ? "Resume session" : "Start session"}
        </Button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Your microphone will activate after you start.
        </p>
      </div>
    </div>
  );
}
