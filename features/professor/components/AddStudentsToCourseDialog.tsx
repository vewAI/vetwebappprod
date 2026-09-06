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
import axios from "axios";

type Props = {
  courseId: string;
  onAdded?: () => void;
};

export function AddStudentsToCourseDialog({ courseId, onAdded }: Props) {
  const { session, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [availableStudents, setAvailableStudents] = useState<
    { id: string; fullName: string; email: string }[]
  >([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open || !user?.id) return;
    (async () => {
      setLoading(true);
      try {
        // Students under this professor NOT enrolled in any of their courses
        const resp = await axios.get("/api/professor/students/available", {
          params: { courseId },
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        setAvailableStudents(resp.data.students ?? []);
      } catch (err) {
        console.error("Failed to load available students", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, user?.id, courseId, session?.access_token]);

  const available = availableStudents.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return s.fullName.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
  });

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
            {loading
              ? "Loading students…"
              : "No students available to add. Students you manage appear here once they are not already enrolled in any of your courses."}
          </p>
        ) : (
          <>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
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
          </>
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
