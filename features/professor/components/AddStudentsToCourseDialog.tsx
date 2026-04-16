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
import { useAuth } from "@/features/auth/services/authService";
import { professorService } from "../services/professorService";
import axios from "axios";

type Props = {
  courseId: string;
  onAdded?: () => void;
};

export function AddStudentsToCourseDialog({ courseId, onAdded }: Props) {
  const { session, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [allStudents, setAllStudents] = useState<
    { id: string; fullName: string; email: string }[]
  >([]);
  const [existingIds, setExistingIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !user?.id) return;
    (async () => {
      try {
        // Fetch professor's students
        const students = await professorService.getProfessorStudents(user.id);
        setAllStudents(
          students.map((s: Record<string, unknown>) => ({
            id: s.student_id as string,
            fullName: (s.full_name as string) ?? (s.email as string) ?? "Unknown",
            email: (s.email as string) ?? "",
          }))
        );

        // Fetch students already in course
        const resp = await axios.get(
          `/api/professor/courses/${courseId}/students`,
          { headers: { Authorization: `Bearer ${session?.access_token}` } }
        );
        const enrolled: { studentId: string }[] = resp.data;
        setExistingIds(new Set(enrolled.map((e) => e.studentId)));
      } catch (err) {
        console.error("Failed to load students", err);
      }
    })();
  }, [open, user?.id, courseId, session?.access_token]);

  const available = allStudents.filter((s) => !existingIds.has(s.id));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const add = async () => {
    if (selected.size === 0) return;
    setLoading(true);
    try {
      await axios.post(
        `/api/professor/courses/${courseId}/students`,
        { studentIds: Array.from(selected) },
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      );
      setOpen(false);
      setSelected(new Set());
      if (onAdded) onAdded();
    } catch (err) {
      console.error("Failed to add students:", err);
      alert("Failed to add students. See console for details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Add Students</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Students to Course</DialogTitle>
        </DialogHeader>
        {available.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            All your students are already in this course, or you have no students yet.
          </p>
        ) : (
          <div className="grid gap-2 max-h-80 overflow-y-auto">
            {available.map((s) => (
              <label
                key={s.id}
                className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.has(s.id)}
                  onChange={() => toggle(s.id)}
                  className="rounded"
                />
                <div>
                  <p className="text-sm font-medium">{s.fullName}</p>
                  <p className="text-xs text-muted-foreground">{s.email}</p>
                </div>
              </label>
            ))}
          </div>
        )}
        <div className="flex justify-between items-center mt-4">
          <span className="text-sm text-muted-foreground">
            {selected.size} selected
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={add} disabled={selected.size === 0 || loading}>
              {loading ? "Adding..." : `Add ${selected.size} Student${selected.size !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AddStudentsToCourseDialog;
