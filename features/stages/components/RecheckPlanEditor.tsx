"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  newRecheckOutcome,
  readFutureMapPlan,
  readRecheckOutcomes,
  type FutureMapPlan,
  type RecheckOutcome,
} from "../recheckPlan";

type Props = {
  settings: Record<string, unknown>;
  onChange: (settings: Record<string, unknown>) => void;
};

const fields: Array<{ key: keyof FutureMapPlan; label: string; placeholder: string }> = [
  { key: "monitoringWindow", label: "Monitoring window", placeholder: "For example, the first 24 hours after admission" },
  { key: "repeatableChecks", label: "Repeatable checks", placeholder: "What can students ask for again, and how often? Include units." },
  { key: "timePattern", label: "Pattern over time", placeholder: "Describe expected trends, ranges and time of day effects." },
  { key: "treatmentTiming", label: "Effect of treatment timing", placeholder: "What changes if treatment is early, late, incomplete or omitted?" },
  { key: "exitConditions", label: "When the loop ends", placeholder: "What moves the case to another encounter or finishes it?" },
];

export function RecheckPlanEditor({ settings, onChange }: Props) {
  const outcomes = readRecheckOutcomes(settings.recheck_outcomes);
  const plan = readFutureMapPlan(settings.future_map_plan);
  const [activeId, setActiveId] = useState<string | null>(null);
  const selectedId = outcomes.some((outcome) => outcome.id === activeId) ? activeId : outcomes[0]?.id;
  const selected = outcomes.find((outcome) => outcome.id === selectedId);

  const setOutcomes = (next: RecheckOutcome[]) => onChange({ ...settings, recheck_outcomes: next });
  const editSelected = (field: keyof RecheckOutcome, value: string) => {
    setOutcomes(outcomes.map((outcome) => outcome.id === selectedId ? { ...outcome, [field]: value } : outcome));
  };
  const addOutcome = (title = `Outcome ${outcomes.length + 1}`) => {
    const next = newRecheckOutcome(title);
    setOutcomes([...outcomes, next]);
    setActiveId(next.id);
  };

  return <div className="space-y-4 rounded-xl border border-orange-300 bg-white/80 p-4 dark:border-orange-700 dark:bg-slate-900/70">
    <div>
      <h3 className="font-semibold">Alternative outcomes at this recheck</h3>
      <p className="text-xs text-muted-foreground">These are alternatives at the same recheck. Keep one outcome for a fixed course, or add more for different treatment responses. This is an authoring plan; Live outcome selection is not active yet.</p>
    </div>
    <div role="tablist" aria-label="Recheck outcomes" className="flex flex-wrap gap-2 border-b pb-2">
      {outcomes.map((outcome, index) => <button
        key={outcome.id}
        type="button"
        role="tab"
        aria-selected={outcome.id === selectedId}
        onClick={() => setActiveId(outcome.id)}
        className={`rounded-t-lg border px-3 py-2 text-sm ${outcome.id === selectedId ? "border-orange-500 bg-orange-100 font-semibold dark:bg-orange-950" : "bg-slate-50 dark:bg-slate-800"}`}
      >{outcome.title || `Outcome ${index + 1}`}</button>)}
      <Button type="button" variant="outline" size="sm" onClick={() => addOutcome()} disabled={outcomes.length >= 20}>Add outcome</Button>
      {outcomes.length === 1 && (
        <Button type="button" variant="outline" size="sm" onClick={() => {
          const presets = [
            { title: "Expected response", trigger: "Standard treatment given as planned", report: "Noticeable clinical improvement reported by owner." },
            { title: "Limited improvement", trigger: "Treatment administered with incomplete response", report: "Mild persistent signs; owner reports partial improvement." },
            { title: "Deterioration", trigger: "Treatment ineffective or complications arose", report: "Worsening clinical signs reported by owner." },
          ].map((preset) => ({
            ...newRecheckOutcome(preset.title),
            trigger: preset.trigger,
            ownerReport: preset.report,
          }));
          setOutcomes(presets);
          setActiveId(presets[0].id);
        }}>Use three starting outcomes</Button>
      )}
    </div>
    {selected ? <div role="tabpanel" className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-48 flex-1 text-sm">Outcome name
          <input className="mt-1 w-full rounded-md border bg-background p-2" value={selected.title} onChange={(event) => editSelected("title", event.target.value)} />
        </label>
        <Button type="button" variant="outline" size="sm" onClick={() => {
          const copy = { ...selected, id: crypto.randomUUID(), title: `${selected.title} copy` };
          setOutcomes([...outcomes, copy]);
          setActiveId(copy.id);
        }} disabled={outcomes.length >= 20}>Duplicate</Button>
        <Button type="button" variant="outline" size="sm" disabled={outcomes.length === 1} onClick={() => setOutcomes(outcomes.filter((outcome) => outcome.id !== selectedId))}>Remove</Button>
      </div>
      {([
        ["trigger", "When this outcome applies", "Treatments given and their timing. For a single fixed outcome, this can be left blank."],
        ["ownerReport", "What the owner reports", "Changes the owner has noticed since the previous encounter."],
        ["examination", "Examination findings", "Relevant recheck findings, including values and units."],
        ["repeatTests", "Repeat tests and results", "Specify which results are available and their values."],
        ["feedbackFocus", "Feedback focus", "What should feedback discuss about the learner's decisions?"],
      ] as const).map(([key, label, placeholder]) => <label key={key} className="block text-sm">{label}
        <textarea rows={2} className="mt-1 w-full rounded-md border bg-background p-2" placeholder={placeholder} value={selected[key]} onChange={(event) => editSelected(key, event.target.value)} />
      </label>)}
    </div> : <p className="text-sm text-muted-foreground">Add the first outcome to describe this recheck.</p>}
    <details className="rounded-lg border p-3">
      <summary className="cursor-pointer font-medium">Future case map and repeated monitoring</summary>
      <p className="my-2 text-xs text-muted-foreground">Optional planning notes for complex cases. The future map could be drafted with AI and approved by the author. These notes do not change the student case yet.</p>
      <div className="space-y-3">{fields.map(({ key, label, placeholder }) => <label key={key} className="block text-sm">{label}
        <textarea rows={2} className="mt-1 w-full rounded-md border bg-background p-2" placeholder={placeholder} value={plan[key]} onChange={(event) => onChange({ ...settings, future_map_plan: { ...plan, [key]: event.target.value } })} />
      </label>)}</div>
    </details>
  </div>;
}
