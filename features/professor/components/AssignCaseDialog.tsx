"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { professorService } from "../services/professorService";
import { useAuth } from "@/features/auth/services/authService";

type Props = {
  studentId: string;
  onAssigned?: () => void;
};

export function AssignCaseDialog({ studentId, onAssigned }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [cases, setCases] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const { data } = await supabase.from("cases").select("id,title,difficulty,species").limit(200);
        setCases(data || []);
      } catch (err) {
        console.error("Failed to load cases", err);
      }
    })();
  }, [open]);

  const assign = async () => {
    if (!user || !selected) return;
    setLoading(true);
    try {
      await professorService.assignCaseToStudent(user.id, studentId, selected);
      setOpen(false);
      setSelected(null);
      if (onAssigned) onAssigned();
    } catch (err) {
      try {
        const serialized = typeof err === 'object' ? JSON.stringify(err) : String(err);
        console.error("Failed to assign case", serialized);
        // show a minimal alert so the user notices
        // (avoid adding a UI toast dependency here)
        alert(`Failed to assign case: ${serialized}`);
      } catch (e) {
        console.error('Failed to assign case (unserializable error)');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Assign Case</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Select case to assign</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <select className="w-full p-2 rounded bg-slate-800/60" value={selected ?? ""} onChange={(e) => setSelected(e.target.value)}>
            <option value="">-- choose case --</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>{c.title} — {c.species} ({c.difficulty})</option>
            ))}
          </select>
          <div className="flex justify-end">
            <Button onClick={assign} disabled={!selected || loading}>Assign</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AssignCaseDialog;
