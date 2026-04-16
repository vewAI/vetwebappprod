"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import axios from "axios";
import { useAuth } from "@/features/auth/services/authService";

type Props = {
  courseId: string;
  currentName: string;
  currentDescription: string;
  onUpdated?: () => void;
};

export function EditCourseDialog({
  courseId,
  currentName,
  currentDescription,
  onUpdated,
}: Props) {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [description, setDescription] = useState(currentDescription);
  const [loading, setLoading] = useState(false);

  const update = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await axios.patch(
        `/api/professor/courses/${courseId}`,
        { name: name.trim(), description: description.trim() },
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      );
      setOpen(false);
      if (onUpdated) onUpdated();
    } catch (err) {
      console.error("Update course error:", err);
      alert("Failed to update course.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setName(currentName);
          setDescription(currentDescription);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Course</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Course Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={update} disabled={!name.trim() || loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default EditCourseDialog;
