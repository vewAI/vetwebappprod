"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CaseTimepointInput, CaseTimepointRole } from "@/features/cases/models/caseTimepoint";
import type { Stage } from "@/features/stages/types";

const selectClassName =
  "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

type CaseTimepointsEditorProps = {
  value: CaseTimepointInput[];
  onChange: (next: CaseTimepointInput[]) => void;
  availableStages: Stage[];
  readOnly?: boolean;
};

const personaRoleOptions: Array<{ value: CaseTimepointRole; label: string }> = [
  { value: "owner", label: "Owner / Client" },
  { value: "nurse", label: "Nurse" },
];

function buildAfterStageOptions(stages: Stage[]) {
  const options = stages.map((stage) => ({
    value: stage.id,
    label: stage.title || stage.id,
  }));
  options.push({ value: "__end__", label: "After final stage" });
  return options;
}

export function CaseTimepointsEditor({
  value,
  onChange,
  availableStages,
  readOnly = false,
}: CaseTimepointsEditorProps) {
  const afterStageOptions = React.useMemo(
    () => buildAfterStageOptions(availableStages),
    [availableStages]
  );

  const handleUpdate = (index: number, patch: Partial<CaseTimepointInput>) => {
    onChange(
      value.map((item, idx) => (idx === index ? { ...item, ...patch } : item))
    );
  };

  const handleRemove = (index: number) => {
    onChange(value.filter((_, idx) => idx !== index));
  };

  const handleAdd = () => {
    const fallbackStageId = afterStageOptions[afterStageOptions.length - 1]?.value ?? "__end__";
    onChange([
      ...value,
      {
        label: `Day ${value.length + 2} follow-up`,
        personaRole: "owner",
        summary: "",
        availableAfterHours: null,
        afterStageId: fallbackStageId,
        stagePrompt: "",
      },
    ]);
  };

  return (
    <div className="rounded-lg border border-dashed border-muted-foreground/50 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Time progression checkpoints</h3>
        {!readOnly && (
          <Button type="button" size="sm" onClick={handleAdd}>
            Add checkpoint
          </Button>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Introduce follow-up visits (e.g., Day 2, Recheck) that unlock after the core
        stages. Choose which persona leads the interaction and optionally delay
        availability by in-scenario hours.
      </p>

      {value.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No timepoints yet. Use "Add checkpoint" to schedule follow-up visits.
        </p>
      ) : (
        <div className="mt-4 space-y-6">
          {value.map((timepoint, index) => {
            const afterStageValue = timepoint.afterStageId ?? "__end__";
            return (
              <div
                key={timepoint.id ?? index}
                className="rounded-md border border-border/70 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <label className="text-sm font-medium">Label</label>
                    <Input
                      value={timepoint.label}
                      onChange={(event) =>
                        handleUpdate(index, { label: event.target.value })
                      }
                      placeholder="Day 2 re-evaluation"
                      disabled={readOnly}
                      className="mt-1"
                    />
                  </div>
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(index)}
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      Remove
                    </Button>
                  )}
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Persona</label>
                    <select
                      className={selectClassName}
                      value={timepoint.personaRole}
                      onChange={(event) =>
                        handleUpdate(index, {
                          personaRole: event.target.value as CaseTimepointRole,
                        })
                      }
                      disabled={readOnly}
                    >
                      {personaRoleOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">
                      Unlock after (hours)
                    </label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={timepoint.availableAfterHours ?? ""}
                      onChange={(event) =>
                        handleUpdate(index, {
                          availableAfterHours:
                            event.target.value === ""
                              ? null
                              : Number(event.target.value),
                        })
                      }
                      disabled={readOnly}
                      className="mt-1"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Optional delay after the previous stage (in simulated hours).
                    </p>
                  </div>
                </div>

                <div className="mt-3">
                  <label className="text-sm font-medium">Appears after stage</label>
                  <select
                    className={selectClassName}
                    value={afterStageValue}
                    onChange={(event) =>
                      handleUpdate(index, {
                        afterStageId:
                          event.target.value === "__end__"
                            ? null
                            : event.target.value,
                      })
                    }
                    disabled={readOnly}
                  >
                    {afterStageOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-3">
                  <label className="text-sm font-medium">Summary</label>
                  <Textarea
                    rows={3}
                    value={timepoint.summary ?? ""}
                    onChange={(event) =>
                      handleUpdate(index, { summary: event.target.value })
                    }
                    placeholder="Owner reports that fever returned overnight..."
                    disabled={readOnly}
                    className="mt-1"
                  />
                </div>

                <div className="mt-3">
                  <label className="text-sm font-medium">Stage prompt override</label>
                  <Textarea
                    rows={3}
                    value={timepoint.stagePrompt ?? ""}
                    onChange={(event) =>
                      handleUpdate(index, {
                        stagePrompt: event.target.value,
                      })
                    }
                    placeholder="Provide updated findings from the morning check ..."
                    disabled={readOnly}
                    className="mt-1"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Optional system instructions shown to the persona when this stage starts.
                    Leave blank to reuse the default owner or nurse prompt.
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
