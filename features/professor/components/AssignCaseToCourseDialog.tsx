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
import { useAuth } from "@/features/auth/services/authService";
import axios from "axios";

type Props = {
  courseId: string;
  onAssigned?: () => void;
};

export function AssignCaseToCourseDialog({ courseId, onAssigned }: Props) {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [cases, setCases] = useState<{ id: string; title: string; difficulty: string; species: string }[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const { data } = await supabase
          .from("cases")
          .select("id,title,difficulty,species")
          .limit(200);
        setCases(data || []);
      } catch (err) {
        console.error("Failed to load cases", err);
      }
    })();
  }, [open]);

  const assign = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const resp = await axios.post(
        `/api/professor/courses/${courseId}/assign-case`,
        { caseId: selected },
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      );
      setOpen(false);
      setSelected(null);
      if (onAssigned) onAssigned();
    } catch (err) {
      console.error("Failed to assign case to course:", err);
      alert("Failed to assign case. See console for details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Assign Case to Course</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign Case to All Students</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            This case will be assigned to every student currently enrolled in the course.
          </p>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={selected ?? ""}
            onChange={(e) => setSelected(e.target.value || null)}
          >
            <option value="">-- choose case --</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} — {c.species} ({c.difficulty})
              </option>
            ))}
          </select>
          <div className="flex justify-end">
            <Button onClick={assign} disabled={!selected || loading}>
              {loading ? "Assigning..." : "Assign to Course"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AssignCaseToCourseDialog;
