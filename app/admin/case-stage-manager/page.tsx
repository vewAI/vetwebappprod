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

const PERSONA_OPTIONS = ["owner", "veterinary-nurse"];
const ROLE_INFO_KEYS = [
  "",
  "getOwnerPrompt",
  "getPhysicalExamPrompt",
  "getDiagnosticPrompt",
  "getOwnerFollowUpPrompt",
  "getOwnerDiagnosisPrompt",
  "getTreatmentPlanPrompt",
];

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
    settings: {},
  };
}

export default function CaseStageManagerPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [source, setSource] = useState<"db" | "hardcoded" | "">("");
  const [stages, setStages] = useState<EditableStage[]>([]);
  const [savedSnapshot, setSavedSnapshot] = useState<string>("[]");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchCases({ includeUnpublished: true, limit: 200 });
        setCases(data ?? []);
        if (data?.[0]?.id) {
          setSelectedCaseId(data[0].id);
        }
      } catch (err) {
        setError(`Failed to load cases: ${err instanceof Error ? err.message : String(err)}`);
      }
    })();
  }, []);

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

  const updateStage = (index: number, partial: Partial<EditableStage>) => {
    setStages((prev) => prev.map((stage, idx) => (idx === index ? { ...stage, ...partial } : stage)));
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
    <div className="container mx-auto p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Case Stage Manager</h1>
        <p className="text-sm text-muted-foreground">Create, reorder, and configure case stages from the database.</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="case-select">
          Select case
        </label>
        <select
          id="case-select"
          value={selectedCaseId}
          onChange={(e) => setSelectedCaseId(e.target.value)}
          className="block w-full rounded border bg-background px-2 py-2"
        >
          {cases.map((caseItem) => (
            <option key={caseItem.id} value={caseItem.id}>
              {caseItem.title || caseItem.id}
            </option>
          ))}
        </select>
        {source && <div className="text-xs text-muted-foreground">Loaded from: {source}</div>}
      </div>

      {error && <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading && <div className="text-sm text-muted-foreground">Loading stages...</div>}

      {!loading && (
        <div className="space-y-4">
          {stages.map((stage, index) => (
            <div key={`${stage.id ?? "new"}-${index}`} className="rounded border p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">Stage {index + 1}</div>
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

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm">
                  <div className="mb-1 font-medium">Title</div>
                  <input
                    className="w-full rounded border px-2 py-1"
                    value={stage.title}
                    onChange={(e) => updateStage(index, { title: e.target.value })}
                  />
                </label>

                <label className="text-sm">
                  <div className="mb-1 font-medium">Role Label</div>
                  <input
                    className="w-full rounded border px-2 py-1"
                    value={stage.role_label}
                    onChange={(e) => updateStage(index, { role_label: e.target.value })}
                  />
                </label>
              </div>

              <label className="text-sm block">
                <div className="mb-1 font-medium">Description</div>
                <textarea
                  rows={2}
                  className="w-full rounded border px-2 py-1"
                  value={stage.description}
                  onChange={(e) => updateStage(index, { description: e.target.value })}
                />
              </label>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="text-sm">
                  <div className="mb-1 font-medium">Persona</div>
                  <select
                    className="w-full rounded border px-2 py-1"
                    value={stage.persona_role_key}
                    onChange={(e) => updateStage(index, { persona_role_key: e.target.value })}
                  >
                    {PERSONA_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm">
                  <div className="mb-1 font-medium">Role Info Key</div>
                  <select
                    className="w-full rounded border px-2 py-1"
                    value={stage.role_info_key}
                    onChange={(e) => updateStage(index, { role_info_key: e.target.value })}
                  >
                    {ROLE_INFO_KEYS.map((option) => (
                      <option key={option || "none"} value={option}>
                        {option || "None"}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm">
                  <div className="mb-1 font-medium">Feedback Prompt Key</div>
                  <input
                    className="w-full rounded border px-2 py-1"
                    value={stage.feedback_prompt_key}
                    onChange={(e) => updateStage(index, { feedback_prompt_key: e.target.value })}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm">
                  <div className="mb-1 font-medium">Min User Turns</div>
                  <input
                    type="number"
                    className="w-full rounded border px-2 py-1"
                    value={stage.min_user_turns}
                    onChange={(e) => updateStage(index, { min_user_turns: Number(e.target.value || 0) })}
                  />
                </label>

                <label className="text-sm">
                  <div className="mb-1 font-medium">Min Assistant Turns</div>
                  <input
                    type="number"
                    className="w-full rounded border px-2 py-1"
                    value={stage.min_assistant_turns}
                    onChange={(e) => updateStage(index, { min_assistant_turns: Number(e.target.value || 0) })}
                  />
                </label>
              </div>

              <label className="text-sm block">
                <div className="mb-1 font-medium">Stage Prompt (optional)</div>
                <textarea
                  rows={3}
                  className="w-full rounded border px-2 py-1"
                  value={stage.stage_prompt}
                  onChange={(e) => updateStage(index, { stage_prompt: e.target.value })}
                />
              </label>

              <label className="text-sm block">
                <div className="mb-1 font-medium">Transition Message (optional)</div>
                <textarea
                  rows={2}
                  className="w-full rounded border px-2 py-1"
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

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={addStage}>
              Add Stage
            </Button>
            <Button type="button" variant="outline" onClick={seedFromDefaults} disabled={saving || !selectedCaseId}>
              Seed From Defaults
            </Button>
            <Button type="button" onClick={saveStages} disabled={!isDirty || saving || !selectedCaseId}>
              {saving ? "Saving..." : "Save"}
            </Button>
            {isDirty && <span className="self-center text-sm text-muted-foreground">Unsaved changes</span>}
          </div>
        </div>
      )}
    </div>
  );
}
