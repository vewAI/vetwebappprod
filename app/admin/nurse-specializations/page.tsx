"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Trash2, Edit, Save, X } from "lucide-react";

type Skill = {
  name: string;
  category?: string;
  description?: string;
};

type Specialization = {
  id?: string;
  species_key: string;
  display_name: string;
  image_url?: string | null;
  sex?: string | null;
  voice_id?: string | null;
  behavior_prompt: string;
  skills: Skill[];
  lab_reference_ranges: Record<string, string>;
  vital_reference_ranges: Record<string, string>;
  common_pathologies: string[];
  metadata?: Record<string, unknown>;
};

const SPECIES_OPTIONS = [
  { key: "equine", label: "Equine" },
  { key: "bovine", label: "Bovine" },
  { key: "canine", label: "Canine" },
  { key: "feline", label: "Feline" },
  { key: "ovine", label: "Ovine" },
  { key: "caprine", label: "Caprine" },
  { key: "porcine", label: "Porcine" },
  { key: "camelid", label: "Camelid" },
  { key: "avian", label: "Avian" },
];

const emptySpec = (): Specialization => ({
  species_key: "",
  display_name: "",
  behavior_prompt: "",
  skills: [],
  lab_reference_ranges: {},
  vital_reference_ranges: {},
  common_pathologies: [],
});

export default function NurseSpecializationsPage() {
  const [specs, setSpecs] = useState<Specialization[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Specialization>(emptySpec());
  const [newLabKey, setNewLabKey] = useState("");
  const [newLabValue, setNewLabValue] = useState("");
  const [newVitalKey, setNewVitalKey] = useState("");
  const [newVitalValue, setNewVitalValue] = useState("");
  const [newPathology, setNewPathology] = useState("");
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillCategory, setNewSkillCategory] = useState("");
  const [newSkillDesc, setNewSkillDesc] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchSpecs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/nurse-specializations");
      if (res.ok) {
        const data = await res.json();
        setSpecs(data.specializations ?? []);
      }
    } catch (e) {
      console.error("Failed to fetch specializations", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSpecs();
  }, [fetchSpecs]);

  const handleSave = async (spec: Specialization) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/nurse-specializations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(spec),
      });
      if (res.ok) {
        await fetchSpecs();
        setEditingId(null);
        setCreateDialogOpen(false);
      } else {
        const err = await res.json();
        alert(err.error ?? "Save failed");
      }
    } catch (e) {
      console.error("Save failed", e);
      alert("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (speciesKey: string) => {
    if (!confirm(`Delete the ${speciesKey} specialization?`)) return;
    try {
      await fetch("/api/admin/nurse-specializations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ species_key: speciesKey }),
      });
      await fetchSpecs();
    } catch (e) {
      console.error("Delete failed", e);
    }
  };

  const startEdit = (spec: Specialization) => {
    setEditingId(spec.species_key);
    setEditForm({ ...spec });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(emptySpec());
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Nurse Specializations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage species-specific veterinary nurse personas with clinical knowledge bases.
          </p>
        </div>
        <Button onClick={() => { setEditForm(emptySpec()); setCreateDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Add Species
        </Button>
      </div>

      {/* Species Cards */}
      {specs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No nurse specializations found. Run the seed script or add species above.
        </div>
      ) : (
        <div className="grid gap-4">
          {specs.map((spec) => (
            <SpecCard
              key={spec.species_key}
              spec={spec}
              isEditing={editingId === spec.species_key}
              editForm={editForm}
              setEditForm={setEditForm}
              onStartEdit={() => startEdit(spec)}
              onCancel={cancelEdit}
              onSave={() => handleSave(editForm)}
              onDelete={() => handleDelete(spec.species_key)}
              saving={saving}
              newLabKey={newLabKey}
              setNewLabKey={setNewLabKey}
              newLabValue={newLabValue}
              setNewLabValue={setNewLabValue}
              newVitalKey={newVitalKey}
              setNewVitalKey={setNewVitalKey}
              newVitalValue={newVitalValue}
              setNewVitalValue={setNewVitalValue}
              newPathology={newPathology}
              setNewPathology={setNewPathology}
              newSkillName={newSkillName}
              setNewSkillName={setNewSkillName}
              newSkillCategory={newSkillCategory}
              setNewSkillCategory={setNewSkillCategory}
              newSkillDesc={newSkillDesc}
              setNewSkillDesc={setNewSkillDesc}
            />
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Nurse Specialization</DialogTitle>
          </DialogHeader>
          <SpecEditForm
            form={editForm}
            setForm={setEditForm}
            isNew
            newLabKey={newLabKey}
            setNewLabKey={setNewLabKey}
            newLabValue={newLabValue}
            setNewLabValue={setNewLabValue}
            newVitalKey={newVitalKey}
            setNewVitalKey={setNewVitalKey}
            newVitalValue={newVitalValue}
            setNewVitalValue={setNewVitalValue}
            newPathology={newPathology}
            setNewPathology={setNewPathology}
            newSkillName={newSkillName}
            setNewSkillName={setNewSkillName}
            newSkillCategory={newSkillCategory}
            setNewSkillCategory={setNewSkillCategory}
            newSkillDesc={newSkillDesc}
            setNewSkillDesc={setNewSkillDesc}
          />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => handleSave(editForm)} disabled={saving || !editForm.species_key || !editForm.display_name}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Sub-components ─── */

function SpecCard({ spec, isEditing, editForm, setEditForm, onStartEdit, onCancel, onSave, onDelete, saving, newLabKey, setNewLabKey, newLabValue, setNewLabValue, newVitalKey, setNewVitalKey, newVitalValue, setNewVitalValue, newPathology, setNewPathology, newSkillName, setNewSkillName, newSkillCategory, setNewSkillCategory, newSkillDesc, setNewSkillDesc }: {
  spec: Specialization;
  isEditing: boolean;
  editForm: Specialization;
  setEditForm: (f: Specialization) => void;
  onStartEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete: () => void;
  saving: boolean;
  newLabKey: string;
  setNewLabKey: (v: string) => void;
  newLabValue: string;
  setNewLabValue: (v: string) => void;
  newVitalKey: string;
  setNewVitalKey: (v: string) => void;
  newVitalValue: string;
  setNewVitalValue: (v: string) => void;
  newPathology: string;
  setNewPathology: (v: string) => void;
  newSkillName: string;
  setNewSkillName: (v: string) => void;
  newSkillCategory: string;
  setNewSkillCategory: (v: string) => void;
  newSkillDesc: string;
  setNewSkillDesc: (v: string) => void;
}) {
  const speciesLabel = SPECIES_OPTIONS.find((s) => s.key === spec.species_key)?.label ?? spec.species_key;

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-muted/30">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold capitalize">{speciesLabel}</span>
          <span className="text-sm text-muted-foreground">— {spec.display_name}</span>
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            {spec.common_pathologies?.length ?? 0} pathologies
          </span>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
            {Object.keys(spec.lab_reference_ranges ?? {}).length} lab refs
          </span>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button size="sm" onClick={onSave} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              </Button>
              <Button size="sm" variant="outline" onClick={onCancel}>
                <X className="h-3 w-3" />
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={onStartEdit}>
                <Edit className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="destructive" onClick={onDelete}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      {isEditing ? (
        <div className="p-4">
          <SpecEditForm
            form={editForm}
            setForm={setEditForm}
            isNew={false}
            newLabKey={newLabKey}
            setNewLabKey={setNewLabKey}
            newLabValue={newLabValue}
            setNewLabValue={setNewLabValue}
            newVitalKey={newVitalKey}
            setNewVitalKey={setNewVitalKey}
            newVitalValue={newVitalValue}
            setNewVitalValue={setNewVitalValue}
            newPathology={newPathology}
            setNewPathology={setNewPathology}
            newSkillName={newSkillName}
            setNewSkillName={setNewSkillName}
            newSkillCategory={newSkillCategory}
            setNewSkillCategory={setNewSkillCategory}
            newSkillDesc={newSkillDesc}
            setNewSkillDesc={setNewSkillDesc}
          />
        </div>
      ) : (
        <div className="p-4 space-y-3">
          <p className="text-sm text-muted-foreground line-clamp-2">{spec.behavior_prompt}</p>
          <div className="flex flex-wrap gap-1">
            {spec.skills?.map((s, i) => (
              <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded-full">{s.name}</span>
            ))}
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground font-medium">
              Vital Ranges ({Object.keys(spec.vital_reference_ranges ?? {}).length})
            </summary>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-2 ml-4">
              {Object.entries(spec.vital_reference_ranges ?? {}).map(([k, v]) => (
                <span key={k} className="text-xs"><strong>{k}:</strong> {v}</span>
              ))}
            </div>
          </details>
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground font-medium">
              Lab Reference Ranges ({Object.keys(spec.lab_reference_ranges ?? {}).length})
            </summary>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-2 ml-4">
              {Object.entries(spec.lab_reference_ranges ?? {}).map(([k, v]) => (
                <span key={k} className="text-xs"><strong>{k}:</strong> {v}</span>
              ))}
            </div>
          </details>
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground font-medium">
              Common Pathologies ({spec.common_pathologies?.length ?? 0})
            </summary>
            <ul className="list-disc list-inside mt-2 ml-4 space-y-0.5">
              {spec.common_pathologies?.map((p, i) => (
                <li key={i} className="text-xs">{p}</li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </div>
  );
}

function SpecEditForm({ form, setForm, isNew, newLabKey, setNewLabKey, newLabValue, setNewLabValue, newVitalKey, setNewVitalKey, newVitalValue, setNewVitalValue, newPathology, setNewPathology, newSkillName, setNewSkillName, newSkillCategory, setNewSkillCategory, newSkillDesc, setNewSkillDesc }: {
  form: Specialization;
  setForm: (f: Specialization) => void;
  isNew: boolean;
  newLabKey: string;
  setNewLabKey: (v: string) => void;
  newLabValue: string;
  setNewLabValue: (v: string) => void;
  newVitalKey: string;
  setNewVitalKey: (v: string) => void;
  newVitalValue: string;
  setNewVitalValue: (v: string) => void;
  newPathology: string;
  setNewPathology: (v: string) => void;
  newSkillName: string;
  setNewSkillName: (v: string) => void;
  newSkillCategory: string;
  setNewSkillCategory: (v: string) => void;
  newSkillDesc: string;
  setNewSkillDesc: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Species</Label>
          {isNew ? (
            <Select value={form.species_key} onValueChange={(v) => setForm({ ...form, species_key: v })}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select species" /></SelectTrigger>
              <SelectContent>
                {SPECIES_OPTIONS.map((s) => (
                  <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input value={form.species_key} disabled className="mt-1" />
          )}
        </div>
        <div>
          <Label>Display Name</Label>
          <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} className="mt-1" />
        </div>
      </div>

      <div>
        <Label>Behavior Prompt</Label>
        <Textarea value={form.behavior_prompt} onChange={(e) => setForm({ ...form, behavior_prompt: e.target.value })} rows={4} className="mt-1 text-sm font-mono" />
      </div>

      {/* Skills */}
      <div>
        <Label className="text-sm font-medium">Skills</Label>
        <div className="flex flex-wrap gap-1 mt-1 mb-2">
          {form.skills.map((s, i) => (
            <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
              {s.name}
              <button className="hover:text-destructive" onClick={() => {
                const next = [...form.skills];
                next.splice(i, 1);
                setForm({ ...form, skills: next });
              }}><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input placeholder="Skill name" value={newSkillName} onChange={(e) => setNewSkillName(e.target.value)} className="flex-1" />
          <Input placeholder="Category" value={newSkillCategory} onChange={(e) => setNewSkillCategory(e.target.value)} className="w-28" />
          <Button size="sm" onClick={() => {
            if (!newSkillName.trim()) return;
            setForm({ ...form, skills: [...form.skills, { name: newSkillName.trim(), category: newSkillCategory.trim() || undefined, description: newSkillDesc.trim() || undefined }] });
            setNewSkillName(""); setNewSkillCategory(""); setNewSkillDesc("");
          }}>Add</Button>
        </div>
      </div>

      {/* Vital Reference Ranges */}
      <div>
        <Label className="text-sm font-medium">Vital Reference Ranges</Label>
        <div className="space-y-1 mt-1 mb-2">
          {Object.entries(form.vital_reference_ranges).map(([k, v]) => (
            <div key={k} className="flex items-center gap-2 text-xs">
              <span className="font-medium w-40 truncate">{k}:</span>
              <span className="flex-1">{v}</span>
              <button className="text-destructive hover:text-destructive/80" onClick={() => {
                const next = { ...form.vital_reference_ranges };
                delete next[k];
                setForm({ ...form, vital_reference_ranges: next });
              }}><X className="h-3 w-3" /></button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input placeholder="Parameter" value={newVitalKey} onChange={(e) => setNewVitalKey(e.target.value)} className="flex-1" />
          <Input placeholder="Normal range" value={newVitalValue} onChange={(e) => setNewVitalValue(e.target.value)} className="flex-1" />
          <Button size="sm" onClick={() => {
            if (!newVitalKey.trim()) return;
            setForm({ ...form, vital_reference_ranges: { ...form.vital_reference_ranges, [newVitalKey.trim()]: newVitalValue.trim() } });
            setNewVitalKey(""); setNewVitalValue("");
          }}>Add</Button>
        </div>
      </div>

      {/* Lab Reference Ranges */}
      <div>
        <Label className="text-sm font-medium">Lab Reference Ranges</Label>
        <div className="space-y-1 mt-1 mb-2 max-h-40 overflow-y-auto">
          {Object.entries(form.lab_reference_ranges).map(([k, v]) => (
            <div key={k} className="flex items-center gap-2 text-xs">
              <span className="font-medium w-32 truncate">{k}:</span>
              <span className="flex-1 truncate">{v}</span>
              <button className="text-destructive hover:text-destructive/80" onClick={() => {
                const next = { ...form.lab_reference_ranges };
                delete next[k];
                setForm({ ...form, lab_reference_ranges: next });
              }}><X className="h-3 w-3" /></button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input placeholder="Parameter" value={newLabKey} onChange={(e) => setNewLabKey(e.target.value)} className="flex-1" />
          <Input placeholder="Normal range" value={newLabValue} onChange={(e) => setNewLabValue(e.target.value)} className="flex-1" />
          <Button size="sm" onClick={() => {
            if (!newLabKey.trim()) return;
            setForm({ ...form, lab_reference_ranges: { ...form.lab_reference_ranges, [newLabKey.trim()]: newLabValue.trim() } });
            setNewLabKey(""); setNewLabValue("");
          }}>Add</Button>
        </div>
      </div>

      {/* Common Pathologies */}
      <div>
        <Label className="text-sm font-medium">Common Pathologies</Label>
        <div className="flex flex-wrap gap-1 mt-1 mb-2">
          {form.common_pathologies.map((p, i) => (
            <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded-full flex items-center gap-1">
              {p}
              <button className="hover:text-destructive" onClick={() => {
                const next = [...form.common_pathologies];
                next.splice(i, 1);
                setForm({ ...form, common_pathologies: next });
              }}><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input placeholder="Pathology name" value={newPathology} onChange={(e) => setNewPathology(e.target.value)} className="flex-1" />
          <Button size="sm" onClick={() => {
            if (!newPathology.trim()) return;
            setForm({ ...form, common_pathologies: [...form.common_pathologies, newPathology.trim()] });
            setNewPathology("");
          }}>Add</Button>
        </div>
      </div>
    </div>
  );
}
