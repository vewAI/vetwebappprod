"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { fetchCaseById, fetchCases } from "@/features/case-selection/services/caseService";
import type { Case } from "@/features/case-selection/models/case";
import { getStagesForCase } from "@/features/stages/services/stageService";

export default function CaseStageManager() {
  const [cases, setCases] = useState<Case[]>([]);
  const [selectedCase, setSelectedCase] = useState<string | null>(null);
  const [stages, setStages] = useState<any[]>([]);
  const [activation, setActivation] = useState<Record<string, boolean>>({});
  const [originalActivation, setOriginalActivation] = useState<Record<string, boolean>>({});
  const [stageOverrides, setStageOverrides] = useState<Record<string, any>>({});
  const [originalStageOverrides, setOriginalStageOverrides] = useState<Record<string, any>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const list = await fetchCases({ includeUnpublished: true, limit: 200 });
        setCases(list || []);
        if (list && list.length > 0) setSelectedCase(list[0].id);
      } catch (e) {
        console.warn("Failed to list cases", e);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedCase) return;
    (async () => {
      setLoading(true);
      try {
        const c = await fetchCaseById(selectedCase);
        const s = getStagesForCase(selectedCase);
        setStages(s.map((st, idx) => ({ ...st, idx })));
        const resp = await fetch(`/api/cases/${encodeURIComponent(selectedCase)}/stage-settings`);
        const payload = await resp.json().catch(() => ({}));
        const act = payload?.stageActivation || {};
        const overrides = payload?.stageOverrides || {};
        // Default: all stages active unless explicitly set to false in activation map
        // Accept stored string booleans like "true"/"false".
        const withDefaults: Record<string, boolean> = {};
        const overridesWithDefaults: Record<string, any> = {};
        s.forEach((_, idx) => {
          const key = String(idx);
          if (act.hasOwnProperty(key)) {
            const v = (act as any)[key];
            withDefaults[key] = v === true || v === "true";
          } else {
            withDefaults[key] = true;
          }
          // populate overrides with shape; default numeric fields to 1 and default title/description to the current stage values
          const inc = overrides[key] || {};
          overridesWithDefaults[key] = {
            title: inc.title != null ? String(inc.title) : (s[idx]?.title ?? undefined),
            description: inc.description != null ? String(inc.description) : (s[idx]?.description ?? undefined),
            minUserTurns: inc.minUserTurns != null ? Number(inc.minUserTurns) : 1,
            minAssistantTurns: inc.minAssistantTurns != null ? Number(inc.minAssistantTurns) : 1,
            minAssistantKeywordHits: inc.minAssistantKeywordHits != null ? Number(inc.minAssistantKeywordHits) : 1,
            basePrompt: inc.basePrompt != null ? String(inc.basePrompt) : undefined,
          };
        });
        setActivation(withDefaults);
        setOriginalActivation(withDefaults);
        setStageOverrides(overridesWithDefaults);
        setOriginalStageOverrides(overridesWithDefaults);
        setHasChanges(false);
      } catch (e) {
        console.warn("Failed to load stages for case", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedCase]);

  const toggleLocal = (idx: number) => {
    const key = String(idx);
    setActivation((p) => {
      const next = { ...p, [key]: !Boolean(p[key]) };
      setHasChanges(true);
      return next;
    });
  };

  const saveChanges = async () => {
    if (!selectedCase) return;
    setLoading(true);
    try {
      // sanitize overrides before saving: ensure numeric fields default to 1 when not set
      const sanitizedOverrides: Record<string, any> = {};
      stages.forEach((st, idx) => {
        const key = String(idx);
        const inc = stageOverrides[key] || {};
        sanitizedOverrides[key] = {
          title: inc.title != null ? String(inc.title) : st.title || "",
          description: inc.description != null ? String(inc.description) : st.description || "",
          minUserTurns: inc.minUserTurns != null ? Number(inc.minUserTurns) : 1,
          minAssistantTurns: inc.minAssistantTurns != null ? Number(inc.minAssistantTurns) : 1,
          minAssistantKeywordHits: inc.minAssistantKeywordHits != null ? Number(inc.minAssistantKeywordHits) : 1,
          basePrompt: inc.basePrompt != null ? String(inc.basePrompt) : "",
        };
      });

      const resp = await fetch(`/api/cases/${encodeURIComponent(selectedCase)}/stage-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageActivation: activation, stageOverrides: sanitizedOverrides }),
      });
      let payload: any = {};
      try {
        payload = await resp.json();
      } catch {
        payload = {};
      }

      if (!resp.ok || payload?.ok === false) {
        const msg = payload?.error || `Save failed (${resp.status})`;
        console.warn("Save failed", msg);
        window.alert(`Failed to save stage settings: ${msg}`);
        return;
      }

      // On success, re-fetch saved settings to ensure DB persistence and correct typing
      try {
        const getResp = await fetch(`/api/cases/${encodeURIComponent(selectedCase)}/stage-settings`);
        const getPayload = await getResp.json().catch(() => ({}));
        const saved = getPayload?.stageActivation || {};
        const savedOverrides = getPayload?.stageOverrides || {};
        // Coerce saved values to booleans
        const coerced: Record<string, boolean> = {};
        Object.keys(saved).forEach((k) => {
          const v = (saved as any)[k];
          coerced[k] = v === true || v === "true";
        });
        // Coerce overrides into the expected shape with sensible defaults
        const coercedOverrides: Record<string, any> = {};
        // Ensure we include an entry for each stage index (defaults to current stage labels if missing)
        (stages || []).forEach((_, idx) => {
          const k = String(idx);
          const inc = (savedOverrides as any)[k] || {};
          coercedOverrides[k] = {
            title: inc.title != null ? String(inc.title) : stages[idx]?.title ?? undefined,
            description: inc.description != null ? String(inc.description) : stages[idx]?.description ?? undefined,
            minUserTurns: inc.minUserTurns != null ? Number(inc.minUserTurns) : 1,
            minAssistantTurns: inc.minAssistantTurns != null ? Number(inc.minAssistantTurns) : 1,
            minAssistantKeywordHits: inc.minAssistantKeywordHits != null ? Number(inc.minAssistantKeywordHits) : 1,
            basePrompt: inc.basePrompt != null ? String(inc.basePrompt) : undefined,
          };
        });
        setActivation((p) => ({ ...p, ...coerced }));
        setOriginalActivation((p) => ({ ...p, ...coerced }));
        setStageOverrides((p) => ({ ...p, ...coercedOverrides }));
        setOriginalStageOverrides((p) => ({ ...p, ...coercedOverrides }));
        setHasChanges(false);
      } catch (e) {
        // If refetch fails, still mark as saved to avoid blocking the user, but warn
        console.warn("Saved but failed to refresh saved settings", e);
        setOriginalActivation(activation);
        setOriginalStageOverrides(stageOverrides);
        setHasChanges(false);
      }
    } catch (e) {
      console.warn("Failed to save activation", e);
    } finally {
      setLoading(false);
    }
  };

  const cancelChanges = () => {
    setActivation(originalActivation);
    setStageOverrides(originalStageOverrides);
    setHasChanges(false);
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Case Stage Manager</h1>
      <div className="mb-4">
        <label className="block text-sm mb-2">Select case</label>
        <select
          value={selectedCase ?? ""}
          onChange={(e) => setSelectedCase(e.target.value)}
          className="mt-1 block w-full px-2 py-1 border rounded bg-background text-foreground dark:bg-slate-800 dark:text-white"
        >
          {cases.map((c) => (
            <option key={c.id} value={c.id}>{c.title || c.id}</option>
          ))}
        </select>
      </div>

      <div>
        <h2 className="text-lg font-medium mb-2">Stages</h2>
        {loading && <div>Loading...</div>}
        {!loading && stages.length === 0 && <div>No stages defined for this case.</div>}
        {!loading && stages.map((s) => (
          <div key={s.idx} className="mb-4 p-3 border rounded">
            <div className="flex items-center gap-3 mb-2">
              <Checkbox checked={Boolean(activation[String(s.idx)])} onCheckedChange={() => { toggleLocal(s.idx); setHasChanges(true); }} />
              <div className="flex-1">
                <div className="font-medium">{stageOverrides[String(s.idx)]?.title ?? s.title}</div>
                <div className="text-sm text-muted-foreground">{stageOverrides[String(s.idx)]?.description ?? s.description}</div>
              </div>
            </div>

                <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-sm font-medium">Stage Title</label>
                <Input
                  value={stageOverrides[String(s.idx)]?.title ?? s.title ?? ""}
                  onChange={(e) => {
                    const key = String(s.idx);
                    setStageOverrides((p) => ({ ...p, [key]: { ...(p[key] || {}), title: e.target.value } }));
                    setHasChanges(true);
                  }}
                />
                <div className="text-xs text-muted-foreground mt-1">Edit the stage title shown to students for this case.</div>
              </div>

              <div>
                <label className="block text-sm font-medium">Stage Description</label>
                <textarea
                  className="mt-1 block w-full p-2 border rounded bg-background text-foreground dark:bg-slate-800 dark:text-white"
                  rows={2}
                  value={stageOverrides[String(s.idx)]?.description ?? s.description ?? ""}
                  onChange={(e) => {
                    const key = String(s.idx);
                    setStageOverrides((p) => ({ ...p, [key]: { ...(p[key] || {}), description: e.target.value } }));
                    setHasChanges(true);
                  }}
                />
                <div className="text-xs text-muted-foreground mt-1">Edit the detail/description for this stage as shown in the case UI.</div>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-2">
                <div>
                  <label className="block text-sm font-medium">Min User Turns</label>
                  <Input
                    type="number"
                    value={stageOverrides[String(s.idx)]?.minUserTurns ?? 1}
                    onChange={(e) => {
                      const key = String(s.idx);
                      const v = e.target.value === "" ? undefined : Number(e.target.value);
                      setStageOverrides((p) => ({ ...p, [key]: { ...(p[key] || {}), minUserTurns: v } }));
                      setHasChanges(true);
                    }}
                  />
                  <div className="text-xs text-muted-foreground mt-1">Minimum number of user messages required before this stage may auto-advance. Defaults to <code>1</code> if not set.</div>
                </div>

                <div>
                  <label className="block text-sm font-medium">Min Assistant Turns</label>
                  <Input
                    type="number"
                    value={stageOverrides[String(s.idx)]?.minAssistantTurns ?? 1}
                    onChange={(e) => {
                      const key = String(s.idx);
                      const v = e.target.value === "" ? undefined : Number(e.target.value);
                      setStageOverrides((p) => ({ ...p, [key]: { ...(p[key] || {}), minAssistantTurns: v } }));
                      setHasChanges(true);
                    }}
                  />
                  <div className="text-xs text-muted-foreground mt-1">Minimum number of assistant messages required before this stage may auto-advance. Defaults to <code>1</code> if not set.</div>
                </div>

                <div>
                  <label className="block text-sm font-medium">Min Assistant Keyword Hits</label>
                  <Input
                    type="number"
                    value={stageOverrides[String(s.idx)]?.minAssistantKeywordHits ?? 1}
                    onChange={(e) => {
                      const key = String(s.idx);
                      const v = e.target.value === "" ? undefined : Number(e.target.value);
                      setStageOverrides((p) => ({ ...p, [key]: { ...(p[key] || {}), minAssistantKeywordHits: v } }));
                      setHasChanges(true);
                    }}
                  />
                  <div className="text-xs text-muted-foreground mt-1">Number of keyword/structured-findings hits required in assistant messages to qualify stage completion. Defaults to <code>1</code> if not set.</div>
                </div>
              </div>
            </div>

            <div className="mt-3">
              <label className="block text-sm font-medium">Base Prompt (editable)</label>
              <textarea
                className="mt-1 block w-full p-2 border rounded bg-background text-foreground dark:bg-slate-800 dark:text-white"
                rows={3}
                value={stageOverrides[String(s.idx)]?.basePrompt ?? ""}
                onChange={(e) => {
                  const key = String(s.idx);
                  setStageOverrides((p) => ({ ...p, [key]: { ...(p[key] || {}), basePrompt: e.target.value } }));
                  setHasChanges(true);
                }}
              />
              <div className="text-xs text-muted-foreground mt-1">This text will be appended to the system prompt when evaluating messages in this stage. Use it sparingly; it is applied globally for the case when the stage is active.</div>
            </div>
          </div>
        ))}
        {stages.length > 0 && (
          <div className="mt-4 flex gap-2">
            <Button variant="default" onClick={saveChanges} disabled={!hasChanges || loading}>
              Save
            </Button>
            <Button variant="secondary" onClick={cancelChanges} disabled={!hasChanges || loading}>
              Cancel
            </Button>
            {hasChanges && <div className="ml-2 text-sm text-muted-foreground">Unsaved changes</div>}
          </div>
        )}
      </div>
    </div>
  );
}
