"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/features/auth/services/authService";
import { Loader2, Trash2 } from "lucide-react";
import axios from "axios";

type StudentStat = {
  studentId: string;
  fullName: string;
  email: string;
  completedAttempts: number;
  totalAttempts: number;
  avgTimeSeconds: number;
  lastActivityAt: string | null;
};

type Props = {
  students: StudentStat[];
  courseId?: string;
  onStudentsChanged?: () => void;
};

export function CourseStudentsTable({ students, courseId, onStudentsChanged }: Props) {
  const { session } = useAuth();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState(false);

  const toggleStudent = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === students.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(students.map((s) => s.studentId)));
    }
  };

  const handleRemoveSelected = async () => {
    if (!courseId || selectedIds.size === 0) return;
    if (!confirm(`Remove ${selectedIds.size} student${selectedIds.size > 1 ? "s" : ""} from this course?`)) return;

    setRemoving(true);
    try {
      const headers = { Authorization: `Bearer ${session?.access_token}` };
      await Promise.all(
        Array.from(selectedIds).map((sid) =>
          axios.delete(`/api/professor/courses/${courseId}/students/${sid}`, { headers })
        )
      );
      setSelectedIds(new Set());
      onStudentsChanged?.();
    } catch (err) {
      console.error("Failed to remove students:", err);
      alert("Failed to remove some students.");
    } finally {
      setRemoving(false);
    }
  };

  if (students.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No students in this course yet.
      </p>
    );
  }

  const sortedStudents = [...students].sort((a, b) => {
    if (a.completedAttempts === 0 && b.completedAttempts > 0) return -1;
    if (b.completedAttempts === 0 && a.completedAttempts > 0) return 1;
    return a.completedAttempts - b.completedAttempts;
  });

  const formatTime = (seconds: number) => {
    if (seconds === 0) return "—";
    const min = Math.round(seconds / 60);
    return `${min} min`;
  };

  const formatDate = (date: string | null) => {
    if (!date) return "Never";
    return new Date(date).toLocaleDateString();
  };

  const needsAttention = (s: StudentStat) =>
    s.completedAttempts === 0 ||
    (!s.lastActivityAt ||
      (Date.now() - new Date(s.lastActivityAt).getTime()) > 14 * 24 * 60 * 60 * 1000);

  return (
    <div className="space-y-3">
      {courseId && selectedIds.size > 0 && (
        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleRemoveSelected}
            disabled={removing}
          >
            {removing ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-1 h-4 w-4" />
            )}
            Remove {selectedIds.size} selected
          </Button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              {courseId && (
                <th className="py-2 px-3 w-10">
                  <Checkbox
                    checked={selectedIds.size === students.length}
                    onCheckedChange={toggleAll}
                  />
                </th>
              )}
              <th className="py-2 px-3 font-medium">Student</th>
              <th className="py-2 px-3 font-medium text-center">Completed</th>
              <th className="py-2 px-3 font-medium text-center">Total</th>
              <th className="py-2 px-3 font-medium text-center">Avg Time</th>
              <th className="py-2 px-3 font-medium">Last Active</th>
              <th className="py-2 px-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {sortedStudents.map((s) => {
              const attention = needsAttention(s);
              return (
                <tr
                  key={s.studentId}
                  className={`border-b hover:bg-muted/30 ${
                    attention ? "bg-red-50/50 dark:bg-red-950/20" : ""
                  }`}
                >
                  {courseId && (
                    <td className="py-2 px-3">
                      <Checkbox
                        checked={selectedIds.has(s.studentId)}
                        onCheckedChange={() => toggleStudent(s.studentId)}
                      />
                    </td>
                  )}
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      {attention && (
                        <span className="inline-block h-2 w-2 rounded-full bg-red-500 shrink-0" title="Needs attention" />
                      )}
                      <div>
                        <p className="font-medium">{s.fullName}</p>
                        <p className="text-xs text-muted-foreground">{s.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-2 px-3 text-center">
                    <Badge variant={s.completedAttempts > 0 ? "default" : "destructive"}>
                      {s.completedAttempts}
                    </Badge>
                  </td>
                  <td className="py-2 px-3 text-center text-muted-foreground">
                    {s.totalAttempts}
                  </td>
                  <td className="py-2 px-3 text-center text-muted-foreground">
                    {formatTime(s.avgTimeSeconds)}
                  </td>
                  <td className="py-2 px-3 text-muted-foreground">
                    {formatDate(s.lastActivityAt)}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <Link
                      href={`/professor/students/${s.studentId}`}
                      className="text-xs text-primary hover:underline"
                    >
                      View Profile
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default CourseStudentsTable;
