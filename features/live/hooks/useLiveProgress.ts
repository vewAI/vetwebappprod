"use client";

import { useState, useCallback, useRef } from "react";
import type { Stage } from "@/features/stages/types";

const MIN_TURNS_PER_STAGE = 4;

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

  const canAdvance = turnCountRef.current >= MIN_TURNS_PER_STAGE;

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
