"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { fetchCases } from "@/features/case-selection/services/caseService";
import type { Case } from "@/features/case-selection/models/case";

type EditableStage = {
  id?: string;
  title: string;
  description: string;
  persona_role_key: string;
  role_label: string;
  role_info_key: string;
  feedback_prompt_key: string;
  stage_prompt: string;
  transition_message: string;
  is_active: boolean;
  min_user_turns: number;
  min_assistant_turns: number;
  settings: Record<string, unknown>;
};

type StageTypeId = "history" | "physical" | "diagnostic" | "laboratory" | "treatment" | "communication" | "custom";

type StageTypeDefinition = {
  id: StageTypeId;
  label: string;
  summary: string;
  chipClassName: string;
  cardClassName: string;
  defaultTitle: string;
  defaultDescription: string;
  defaultPersonaRoleKey: string;
  defaultRoleLabel: string;
  defaultRoleInfoKey: string;
  defaultFeedbackPromptKey: string;
};

const STAGE_TYPES: StageTypeDefinition[] = [
  {
    id: "history",
    label: "History",
    summary: "Collect symptom history and context from the owner.",
    chipClassName: "border-amber-500/70 bg-amber-100 text-amber-950 dark:border-amber-700 dark:bg-amber-900/35 dark:text-amber-100",
    cardClassName: "border-amber-400/70 bg-amber-50/65 dark:border-amber-700/70 dark:bg-amber-950/25",
    defaultTitle: "History Taking",
    defaultDescription: "Start the clinical interview and gather all relevant case details.",
    defaultPersonaRoleKey: "owner",
    defaultRoleLabel: "Client (Horse Owner)",
    defaultRoleInfoKey: "getOwnerPrompt",
    defaultFeedbackPromptKey: "getHistoryFeedbackPrompt",
  },
  {
    id: "physical",
    label: "Physical Exam",
    summary: "Request and interpret physical examination findings.",
    chipClassName: "border-emerald-500/70 bg-emerald-100 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-900/35 dark:text-emerald-100",
    cardClassName: "border-emerald-400/70 bg-emerald-50/65 dark:border-emerald-700/70 dark:bg-emerald-950/25",
    defaultTitle: "Physical Examination",
    defaultDescription: "Ask for all physical examination findings needed to move forward.",
    defaultPersonaRoleKey: "veterinary-nurse",
    defaultRoleLabel: "Veterinary Nurse",
    defaultRoleInfoKey: "getPhysicalExamPrompt",
    defaultFeedbackPromptKey: "getPhysicalExamFeedbackPrompt",
  },
  {
    id: "diagnostic",
    label: "Diagnostic Plan",
    summary: "Explain diagnostic hypotheses and planned tests.",
    chipClassName: "border-sky-500/70 bg-sky-100 text-sky-950 dark:border-sky-700 dark:bg-sky-900/35 dark:text-sky-100",
    cardClassName: "border-sky-400/70 bg-sky-50/65 dark:border-sky-700/70 dark:bg-sky-950/25",
    defaultTitle: "Diagnostic Planning",
    defaultDescription: "Explain likely differentials and which tests you want to run.",
    defaultPersonaRoleKey: "owner",
    defaultRoleLabel: "Client (Horse Owner)",
    defaultRoleInfoKey: "getOwnerFollowUpPrompt",
    defaultFeedbackPromptKey: "getOwnerFollowUpFeedbackPrompt",
  },
  {
    id: "laboratory",
    label: "Lab & Imaging",
    summary: "Request diagnostics, imaging, and lab outputs.",
    chipClassName: "border-cyan-500/70 bg-cyan-100 text-cyan-950 dark:border-cyan-700 dark:bg-cyan-900/35 dark:text-cyan-100",
    cardClassName: "border-cyan-400/70 bg-cyan-50/65 dark:border-cyan-700/70 dark:bg-cyan-950/25",
    defaultTitle: "Laboratory & Tests",
    defaultDescription: "Ask for test results and diagnostic imaging as needed.",
    defaultPersonaRoleKey: "veterinary-nurse",
    defaultRoleLabel: "Laboratory Technician",
    defaultRoleInfoKey: "getDiagnosticPrompt",
    defaultFeedbackPromptKey: "",
  },
  {
    id: "treatment",
    label: "Treatment",
    summary: "Define therapeutic plan and care instructions.",
    chipClassName: "border-rose-500/70 bg-rose-100 text-rose-950 dark:border-rose-700 dark:bg-rose-900/35 dark:text-rose-100",
    cardClassName: "border-rose-400/70 bg-rose-50/65 dark:border-rose-700/70 dark:bg-rose-950/25",
    defaultTitle: "Treatment Plan",
    defaultDescription: "Give specific treatment instructions, medication, and monitoring plan.",
    defaultPersonaRoleKey: "veterinary-nurse",
    defaultRoleLabel: "Veterinary Nurse",
    defaultRoleInfoKey: "getTreatmentPlanPrompt",
    defaultFeedbackPromptKey: "",
  },
  {
    id: "communication",
    label: "Client Communication",
    summary: "Communicate diagnosis, prognosis, and options to owner.",
    chipClassName: "border-orange-500/70 bg-orange-100 text-orange-950 dark:border-orange-700 dark:bg-orange-900/35 dark:text-orange-100",
    cardClassName: "border-orange-400/70 bg-orange-50/65 dark:border-orange-700/70 dark:bg-orange-950/25",
    defaultTitle: "Client Communication",
    defaultDescription: "Explain diagnosis and treatment options in client-friendly language.",
    defaultPersonaRoleKey: "owner",
    defaultRoleLabel: "Client (Horse Owner)",
    defaultRoleInfoKey: "getOwnerDiagnosisPrompt",
    defaultFeedbackPromptKey: "",
  },
  {
    id: "custom",
    label: "Custom",
    summary: "Custom step for special flows or institution-specific teaching moments.",
    chipClassName: "border-slate-500/70 bg-slate-100 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100",
    cardClassName: "border-slate-300/70 bg-slate-50/65 dark:border-slate-700/70 dark:bg-slate-900/60",
    defaultTitle: "Custom Stage",
    defaultDescription: "",
    defaultPersonaRoleKey: "owner",
    defaultRoleLabel: "Client (Owner)",
    defaultRoleInfoKey: "",
    defaultFeedbackPromptKey: "",
  },
];

const STAGE_TYPE_BY_ID: Record<StageTypeId, StageTypeDefinition> = STAGE_TYPES.reduce(
  (acc, stageType) => {
    acc[stageType.id] = stageType;
    return acc;
  },
  {} as Record<StageTypeId, StageTypeDefinition>,
);

const PERSONA_OPTIONS = [
  { value: "owner", label: "Client / Owner" },
  { value: "veterinary-nurse", label: "Veterinary Nurse" },
];

const ROLE_INFO_OPTIONS = [
  { value: "", label: "No specific script" },
  { value: "getOwnerPrompt", label: "History interview script" },
  { value: "getPhysicalExamPrompt", label: "Physical exam findings script" },
  { value: "getDiagnosticPrompt", label: "Lab and diagnostic results script" },
  { value: "getOwnerFollowUpPrompt", label: "Diagnostic planning discussion script" },
  { value: "getOwnerDiagnosisPrompt", label: "Final client communication script" },
  { value: "getTreatmentPlanPrompt", label: "Treatment planning script" },
];

const FEEDBACK_OPTIONS = [
  { value: "", label: "No stage-specific feedback script" },
  { value: "getHistoryFeedbackPrompt", label: "History feedback rubric" },
  { value: "getPhysicalExamFeedbackPrompt", label: "Physical exam feedback rubric" },
  { value: "getOwnerFollowUpFeedbackPrompt", label: "Diagnostic planning feedback rubric" },
];

function isStageTypeId(value: unknown): value is StageTypeId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(STAGE_TYPE_BY_ID, value);
}

function normalizeStage(input: Record<string, unknown>): EditableStage {
  return {
    id: input.id != null ? String(input.id) : undefined,
    title: String(input.title ?? ""),
    description: String(input.description ?? ""),
    persona_role_key: String(input.persona_role_key ?? "owner"),
    role_label: String(input.role_label ?? ""),
    role_info_key: String(input.role_info_key ?? ""),
    feedback_prompt_key: String(input.feedback_prompt_key ?? ""),
    stage_prompt: String(input.stage_prompt ?? ""),
    transition_message: String(input.transition_message ?? ""),
    is_active: input.is_active !== false,
    min_user_turns: Number(input.min_user_turns ?? 0),
    min_assistant_turns: Number(input.min_assistant_turns ?? 0),
    settings: typeof input.settings === "object" && input.settings ? (input.settings as Record<string, unknown>) : {},
  };
}

function createBlankStage(): EditableStage {
  return {
    title: "New Stage",
    description: "",
    persona_role_key: "owner",
    role_label: "Client (Owner)",
    role_info_key: "",
    feedback_prompt_key: "",
    stage_prompt: "",
    transition_message: "",
    is_active: true,
    min_user_turns: 0,
    min_assistant_turns: 0,
    settings: { stage_type: "custom" },
  };
}

function detectStageType(stage: EditableStage): StageTypeId {
  const fromSettings = stage.settings?.stage_type;
  if (isStageTypeId(fromSettings)) {
    return fromSettings;
  }

  const roleInfoMap: Record<string, StageTypeId> = {
    getOwnerPrompt: "history",
    getPhysicalExamPrompt: "physical",
    getDiagnosticPrompt: "laboratory",
    getOwnerFollowUpPrompt: "diagnostic",
    getOwnerDiagnosisPrompt: "communication",
    getTreatmentPlanPrompt: "treatment",
  };

  const mapped = roleInfoMap[stage.role_info_key];
  if (mapped) return mapped;

  const title = stage.title.toLowerCase();
  if (title.includes("history")) return "history";
  if (title.includes("physical")) return "physical";
  if (title.includes("diagnostic")) return "diagnostic";
  if (title.includes("laboratory") || title.includes("test")) return "laboratory";
  if (title.includes("treatment")) return "treatment";
  if (title.includes("communication") || title.includes("owner")) return "communication";

  return "custom";
}

function getOptionLabel(options: Array<{ value: string; label: string }>, value: string): string {
  return options.find((option) => option.value === value)?.label ?? (value || "Not set");
}

export default function CaseStageManagerPage() {
  const [requestedCaseId, setRequestedCaseId] = useState<string>("");
  const [cases, setCases] = useState<Case[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [source, setSource] = useState<"db" | "hardcoded" | "">("");
  const [stages, setStages] = useState<EditableStage[]>([]);
  const [savedSnapshot, setSavedSnapshot] = useState<string>("[]");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const caseId = new URLSearchParams(window.location.search).get("caseId")?.trim() ?? "";
      setRequestedCaseId(caseId);
    } catch {
      setRequestedCaseId("");
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchCases({ includeUnpublished: true, limit: 200 });
        setCases(data ?? []);
        if (data?.length) {
          const requestedExists = requestedCaseId
            ? data.some((caseItem) => caseItem.id === requestedCaseId)
            : false;
          setSelectedCaseId(requestedExists ? requestedCaseId : data[0].id);
        }
      } catch (err) {
        setError(`Failed to load cases: ${err instanceof Error ? err.message : String(err)}`);
      }
    })();
  }, [requestedCaseId]);

  const loadStages = async (caseId: string) => {
    if (!caseId) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/cases/${encodeURIComponent(caseId)}/stages`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as {
        stages?: Array<Record<string, unknown>>;
        source?: "db" | "hardcoded";
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? `Failed to load stages (${response.status})`);
      }

      const normalized = (payload?.stages ?? []).map(normalizeStage);
      const snapshot = JSON.stringify(normalized);
      setStages(normalized);
      setSavedSnapshot(snapshot);
      setSource(payload?.source ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStages([]);
      setSavedSnapshot("[]");
      setSource("");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedCaseId) return;
    void loadStages(selectedCaseId);
  }, [selectedCaseId]);

  const isDirty = useMemo(() => JSON.stringify(stages) !== savedSnapshot, [stages, savedSnapshot]);

  const selectedCaseTitle = useMemo(
    () => cases.find((caseItem) => caseItem.id === selectedCaseId)?.title || selectedCaseId,
    [cases, selectedCaseId],
  );

  const stageMetrics = useMemo(() => {
    const activeCount = stages.filter((stage) => stage.is_active).length;
    return {
      total: stages.length,
      active: activeCount,
      inactive: Math.max(0, stages.length - activeCount),
    };
  }, [stages]);

  const updateStage = (index: number, partial: Partial<EditableStage>) => {
    setStages((prev) => prev.map((stage, idx) => (idx === index ? { ...stage, ...partial } : stage)));
  };

  const applyStageType = (index: number, typeId: StageTypeId) => {
    const typeDef = STAGE_TYPE_BY_ID[typeId];
    setStages((prev) =>
      prev.map((stage, idx) => {
        if (idx !== index) return stage;
        return {
          ...stage,
          title: typeDef.defaultTitle,
          description: typeDef.defaultDescription,
          persona_role_key: typeDef.defaultPersonaRoleKey,
          role_label: typeDef.defaultRoleLabel,
          role_info_key: typeDef.defaultRoleInfoKey,
          feedback_prompt_key: typeDef.defaultFeedbackPromptKey,
          settings: {
            ...(stage.settings ?? {}),
            stage_type: typeId,
          },
        };
      }),
    );
  };

  const moveStage = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= stages.length) return;
    setStages((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const deleteStage = (index: number) => {
    setStages((prev) => prev.filter((_, idx) => idx !== index));
  };

  const addStage = () => {
    setStages((prev) => [...prev, createBlankStage()]);
  };

  const saveStages = async () => {
    if (!selectedCaseId) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        stages: stages.map((stage) => ({
          id: stage.id ?? null,
          title: stage.title,
          description: stage.description,
          persona_role_key: stage.persona_role_key,
          role_label: stage.role_label || null,
          role_info_key: stage.role_info_key || null,
          feedback_prompt_key: stage.feedback_prompt_key || null,
          stage_prompt: stage.stage_prompt || null,
          transition_message: stage.transition_message || null,
          is_active: stage.is_active,
          min_user_turns: Number(stage.min_user_turns || 0),
          min_assistant_turns: Number(stage.min_assistant_turns || 0),
          settings: stage.settings ?? {},
        })),
      };

      const response = await fetch(`/api/cases/${encodeURIComponent(selectedCaseId)}/stages`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(result?.error ?? `Failed to save stages (${response.status})`);
      }

      await loadStages(selectedCaseId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const seedFromDefaults = async () => {
    if (!selectedCaseId) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/cases/${encodeURIComponent(selectedCaseId)}/stages/seed`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; reason?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? `Failed to seed stages (${response.status})`);
      }
      await loadStages(selectedCaseId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto max-w-7xl p-4 md:p-6 space-y-6">
      <div className="rounded-2xl border border-slate-300 bg-slate-100 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h1 className="text-2xl font-bold tracking-tight">Case Stage Manager</h1>
        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
          In the Stage Manager you can tweak each stage as needed, add new stages, change their order and personalize them
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
            <div className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-300">Total Stages</div>
            <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">{stageMetrics.total}</div>
          </div>
          <div className="rounded-lg border border-emerald-300 bg-emerald-100 px-3 py-2 dark:border-emerald-700 dark:bg-emerald-950/35">
            <div className="text-xs uppercase tracking-wide text-emerald-800 dark:text-emerald-200">Active</div>
            <div className="text-xl font-semibold text-emerald-950 dark:text-emerald-100">{stageMetrics.active}</div>
          </div>
          <div className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
            <div className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-300">Inactive</div>
            <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">{stageMetrics.inactive}</div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4 md:p-5 space-y-4">
        <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="case-select">
              Select case
            </label>
            <select
              id="case-select"
              value={selectedCaseId}
              onChange={(e) => setSelectedCaseId(e.target.value)}
              className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              {cases.map((caseItem) => (
                <option key={caseItem.id} value={caseItem.id}>
                  {caseItem.title || caseItem.id}
                </option>
              ))}
            </select>
            <div className="text-xs text-muted-foreground">
              Loaded from: <span className="font-medium">{source || "-"}</span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-300 bg-slate-100 p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Current case</div>
            <div className="mt-1 font-medium leading-snug">{selectedCaseTitle || "No case selected"}</div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-300 bg-slate-100 p-3 dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-2 text-sm font-medium text-slate-900 dark:text-slate-100">Stage sequence overview</div>
          {stages.length === 0 ? (
            <div className="text-sm text-slate-600 dark:text-slate-300">No stages yet. Add one below.</div>
          ) : (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {stages.map((stage, index) => {
                const typeId = detectStageType(stage);
                const typeDef = STAGE_TYPE_BY_ID[typeId];
                return (
                  <React.Fragment key={`overview-${stage.id ?? index}`}>
                    <div
                      className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${typeDef.chipClassName} ${
                        stage.is_active ? "" : "opacity-50"
                      }`}
                    >
                      {index + 1}. {typeDef.label}
                    </div>
                    {index < stages.length - 1 && <span className="text-slate-500 dark:text-slate-400">-&gt;</span>}
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {error && <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading && <div className="text-sm text-muted-foreground">Loading stages...</div>}

      {!loading && (
        <div className="space-y-4">
          {stages.map((stage, index) => (
            <div
              key={`${stage.id ?? "new"}-${index}`}
              className={`rounded-2xl border p-4 md:p-5 space-y-4 shadow-sm ${STAGE_TYPE_BY_ID[detectStageType(stage)].cardClassName} ${
                stage.is_active ? "" : "opacity-70"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Stage {index + 1}</div>
                  <div className="text-lg font-semibold leading-tight">{stage.title || `Stage ${index + 1}`}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => moveStage(index, -1)} disabled={index === 0}>
                    Up
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => moveStage(index, 1)}
                    disabled={index === stages.length - 1}
                  >
                    Down
                  </Button>
                  <Button type="button" variant="destructive" size="sm" onClick={() => deleteStage(index)}>
                    Delete
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                <label className="text-sm">
                  <div className="mb-1 font-medium">Stage type</div>
                  <select
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    value={detectStageType(stage)}
                    onChange={(e) => applyStageType(index, e.target.value as StageTypeId)}
                  >
                    {STAGE_TYPES.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-xs text-slate-700 dark:text-slate-300">{STAGE_TYPE_BY_ID[detectStageType(stage)].summary}</div>
                </label>

                <label className="text-sm">
                  <div className="mb-1 font-medium">Title</div>
                  <input
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    value={stage.title}
                    onChange={(e) => updateStage(index, { title: e.target.value })}
                  />
                </label>

                <label className="text-sm">
                  <div className="mb-1 font-medium">Who answers in this stage</div>
                  <select
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    value={stage.persona_role_key}
                    onChange={(e) => updateStage(index, { persona_role_key: e.target.value })}
                  >
                    {PERSONA_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="text-sm block">
                <div className="mb-1 font-medium">What should the student accomplish in this stage?</div>
                <textarea
                  rows={2}
                  className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  value={stage.description}
                  onChange={(e) => updateStage(index, { description: e.target.value })}
                />
              </label>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="text-sm">
                  <div className="mb-1 font-medium">Displayed role name</div>
                  <input
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    value={stage.role_label}
                    onChange={(e) => updateStage(index, { role_label: e.target.value })}
                  />
                </label>

                <label className="text-sm">
                  <div className="mb-1 font-medium">Interaction script</div>
                  <select
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    value={stage.role_info_key}
                    onChange={(e) => updateStage(index, { role_info_key: e.target.value })}
                  >
                    {ROLE_INFO_OPTIONS.map((option) => (
                      <option key={option.value || "none"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm">
                  <div className="mb-1 font-medium">Feedback rubric</div>
                  <select
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    value={stage.feedback_prompt_key}
                    onChange={(e) => updateStage(index, { feedback_prompt_key: e.target.value })}
                  >
                    {FEEDBACK_OPTIONS.map((option) => (
                      <option key={option.value || "none"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm">
                  <div className="mb-1 font-medium">Minimum student messages before completion</div>
                  <input
                    type="number"
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    value={stage.min_user_turns}
                    onChange={(e) => updateStage(index, { min_user_turns: Number(e.target.value || 0) })}
                  />
                </label>

                <label className="text-sm">
                  <div className="mb-1 font-medium">Minimum assistant replies before completion</div>
                  <input
                    type="number"
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    value={stage.min_assistant_turns}
                    onChange={(e) => updateStage(index, { min_assistant_turns: Number(e.target.value || 0) })}
                  />
                </label>
              </div>

              <label className="text-sm block">
                <div className="mb-1 font-medium">Internal stage guidance (optional)</div>
                <textarea
                  rows={3}
                  className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  value={stage.stage_prompt}
                  onChange={(e) => updateStage(index, { stage_prompt: e.target.value })}
                />
              </label>

              <label className="text-sm block">
                <div className="mb-1 font-medium">Message shown when transitioning to the next stage (optional)</div>
                <textarea
                  rows={2}
                  className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  value={stage.transition_message}
                  onChange={(e) => updateStage(index, { transition_message: e.target.value })}
                />
              </label>

              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={stage.is_active}
                  onChange={(e) => updateStage(index, { is_active: e.target.checked })}
                />
                Active
              </label>
            </div>
          ))}

          <div className="sticky bottom-3 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={addStage}>
              Add Stage
              </Button>
              <Button type="button" variant="outline" onClick={seedFromDefaults} disabled={saving || !selectedCaseId}>
              Seed From Defaults
              </Button>
              <Button type="button" onClick={saveStages} disabled={!isDirty || saving || !selectedCaseId}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              {isDirty && <span className="self-center text-sm text-muted-foreground">Unsaved changes</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
