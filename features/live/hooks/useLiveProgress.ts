"use client";

import { useState, useCallback, useRef } from "react";
import type { Stage } from "@/features/stages/types";

// Minimum turns vary by stage type — physical exam needs more interaction
const MIN_TURNS_BY_STAGE_TYPE: Record<string, number> = {
  history: 6,
  physical: 8,
  diagnostic: 5,
  laboratory: 5,
  treatment: 5,
  communication: 5,
};
const DEFAULT_MIN_TURNS = 5;

export type UseLiveProgressResult = {
  currentStageIndex: number;
  stages: Stage[];
  turnCount: number;
  canAdvance: boolean;
  advanceStage: () => void;
  recordTurn: () => void;
  setStages: (stages: Stage[]) => void;
  setStageIndex: (index: number) => void;
};

export function useLiveProgress(
  initialStages: Stage[],
  initialIndex = 0
): UseLiveProgressResult {
  const [stages, setStages] = useState<Stage[]>(initialStages);
  const [currentStageIndex, setCurrentStageIndex] = useState(initialIndex);
  const turnCountRef = useRef(0);
  const [turnCount, setTurnCount] = useState(0);

  // Get stage type for dynamic minimum
  const currentStage = stages[currentStageIndex];
  const settings = currentStage?.settings as Record<string, unknown> | undefined;
  const stageType = typeof settings?.stage_type === "string" ? settings.stage_type : "";
  const minTurns = stageType ? (MIN_TURNS_BY_STAGE_TYPE[stageType] ?? DEFAULT_MIN_TURNS) : DEFAULT_MIN_TURNS;

  const canAdvance = turnCount >= minTurns;

  const advanceStage = useCallback(() => {
    if (currentStageIndex < stages.length - 1) {
      setCurrentStageIndex((prev) => prev + 1);
      turnCountRef.current = 0;
      setTurnCount(0);

      // Mark current stage as completed
      setStages((prev) =>
        prev.map((s, i) =>
          i === currentStageIndex ? { ...s, completed: true } : s
        )
      );
    }
  }, [currentStageIndex, stages.length]);

  const recordTurn = useCallback(() => {
    turnCountRef.current += 1;
    setTurnCount(turnCountRef.current);
  }, []);

  const setStageIndex = useCallback((index: number) => {
    setCurrentStageIndex(index);
    turnCountRef.current = 0;
    setTurnCount(0);
  }, []);

  return {
    currentStageIndex,
    stages,
    turnCount,
    canAdvance,
    advanceStage,
    recordTurn,
    setStages,
    setStageIndex,
  };
}
