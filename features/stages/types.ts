import type { Message } from "@/features/chat/models/chat";

export interface Stage {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

export interface StageDefinition {
  stages: Stage[];
  getTransitionMessage: (stageIndex: number) => Message;
}