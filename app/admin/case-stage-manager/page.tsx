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
        // Default: all stages active unless explicitly set to false in activation map
        // Accept stored string booleans like "true"/"false".
        const withDefaults: Record<string, boolean> = {};
        s.forEach((_, idx) => {
          const key = String(idx);
          if (act.hasOwnProperty(key)) {
            const v = (act as any)[key];
            withDefaults[key] = v === true || v === "true";
          } else {
            withDefaults[key] = true;
          }
        });
        setActivation(withDefaults);
        setOriginalActivation(withDefaults);
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
      const resp = await fetch(`/api/cases/${encodeURIComponent(selectedCase)}/stage-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageActivation: activation }),
      });
      const payload = await resp.json().catch(() => ({}));
      if (payload?.ok === false) {
        console.warn("Save failed", payload.error);
      } else {
        setOriginalActivation(activation);
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
          <div key={s.idx} className="flex items-center gap-3 mb-2">
            <Checkbox checked={Boolean(activation[String(s.idx)])} onCheckedChange={() => toggleLocal(s.idx)} />
            <div>
              <div className="font-medium">{s.title}</div>
              <div className="text-sm text-muted-foreground">{s.description}</div>
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
