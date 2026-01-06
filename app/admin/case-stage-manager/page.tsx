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
        setActivation(act);
      } catch (e) {
        console.warn("Failed to load stages for case", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedCase]);

  const toggle = async (idx: number) => {
    const next = !Boolean(activation[String(idx)]);
    setActivation((p) => ({ ...p, [String(idx)]: next }));
    try {
      await fetch(`/api/cases/${encodeURIComponent(selectedCase!)}/stage-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageIndex: idx, active: next }),
      });
    } catch (e) {
      console.warn("Failed to update activation", e);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Case Stage Manager</h1>
      <div className="mb-4">
        <label className="block text-sm mb-2">Select case</label>
        <select value={selectedCase ?? ""} onChange={(e) => setSelectedCase(e.target.value)} className="border rounded px-2 py-1">
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
            <Checkbox checked={Boolean(activation[String(s.idx)])} onCheckedChange={() => toggle(s.idx)} />
            <div>
              <div className="font-medium">{s.title}</div>
              <div className="text-sm text-muted-foreground">{s.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
