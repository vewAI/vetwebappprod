"use client";

import { useMemo, useState } from "react";
import type { Message } from "@/features/chat/models/chat";
import type { Stage } from "@/features/stages/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AttemptConversationTabProps = {
  messages: Message[];
  stages: Stage[];
  createdAt: string;
};

type StageFilterValue = "all" | `${number}`;

export function AttemptConversationTab({
  messages,
  stages,
  createdAt,
}: AttemptConversationTabProps) {
  const [selectedStage, setSelectedStage] = useState<StageFilterValue>("all");

  const stageDefinitions = useMemo(() => {
    if (stages && stages.length > 0) {
      return stages.map((stage, index) => ({
        index,
        label: stage.title || `Stage ${index + 1}`,
      }));
    }

    // Fallback: infer stages from messages
    const indices = Array.from(
      new Set(
        messages
          .map((m) =>
            typeof m.stageIndex === "number" && m.stageIndex >= 0
              ? m.stageIndex
              : null
          )
          .filter((v): v is number => v !== null)
      )
    ).sort((a, b) => a - b);

    return indices.map((index) => ({
      index,
      label: `Stage ${index + 1}`,
    }));
  }, [messages, stages]);

  const filteredMessages = useMemo(() => {
    if (selectedStage === "all") return messages;
    const targetIndex = Number(selectedStage);
    return messages.filter(
      (m) =>
        typeof m.stageIndex === "number" && Number(m.stageIndex) === targetIndex
    );
  }, [messages, selectedStage]);

  const hasMessages = filteredMessages.length > 0;

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* Stage navigation - desktop */}
      <aside className="hidden md:flex md:w-56 flex-col gap-2 border-r pr-4">
        <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">
          Stages
        </div>
        <button
          className={`text-left px-3 py-2 rounded-md text-sm transition-colors ${
            selectedStage === "all"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "hover:bg-muted"
          }`}
          onClick={() => setSelectedStage("all")}
        >
          All stages
        </button>
        {stageDefinitions.map((stage) => (
          <button
            key={stage.index}
            className={`text-left px-3 py-2 rounded-md text-sm transition-colors ${
              selectedStage === String(stage.index)
                ? "bg-primary text-primary-foreground shadow-sm"
                : "hover:bg-muted text-muted-foreground"
            }`}
            onClick={() =>
              setSelectedStage(String(stage.index) as StageFilterValue)
            }
          >
            {stage.label}
          </button>
        ))}
        <div className="mt-4 text-[11px] text-muted-foreground">
          Started {new Date(createdAt).toLocaleString()}
        </div>
      </aside>

      <div className="flex-1 space-y-4">
        {/* Stage navigation - mobile */}
        <div className="md:hidden mb-2">
          <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">
            Stage
          </div>
          <Select
            value={selectedStage}
            onValueChange={(value) =>
              setSelectedStage(value as StageFilterValue)
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              {stageDefinitions.map((stage) => (
                <SelectItem key={stage.index} value={String(stage.index)}>
                  {stage.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!hasMessages ? (
          <p className="text-center py-8 border rounded-lg text-sm text-muted-foreground">
            No conversation history available for this attempt.
          </p>
        ) : (
          <div className="border rounded-lg p-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {filteredMessages.map((message, idx) => {
              const prev = filteredMessages[idx - 1];
              const showStageHeader =
                typeof message.stageIndex === "number" &&
                (idx === 0 ||
                  message.stageIndex !== (prev?.stageIndex ?? undefined));

              const stageLabel =
                typeof message.stageIndex === "number" &&
                message.stageIndex >= 0 &&
                stageDefinitions.find(
                  (s) => s.index === Number(message.stageIndex)
                )?.label;

              return (
                <div key={message.id} className="space-y-2">
                  {showStageHeader && stageLabel && (
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1">
                      {stageLabel}
                    </div>
                  )}
                  <div
                    className={`p-4 rounded-lg ${
                      message.role === "user"
                        ? "bg-primary/10 ml-12"
                        : "bg-muted mr-12"
                    }`}
                  >
                    <div className="flex justify-between mb-2">
                      <span className="font-medium">
                        {message.displayRole || message.role}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(message.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      {message.content}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
