import type { Message } from "@/features/chat/models/chat";

export interface Stage {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  role: string;
  roleInfoKey?: string;
  feedbackPromptKey?: string; // <-- new field for scalable feedback prompt lookup
}

export interface StageDefinition {
  stages: Stage[];
  getTransitionMessage: (stageIndex: number) => Message;
}