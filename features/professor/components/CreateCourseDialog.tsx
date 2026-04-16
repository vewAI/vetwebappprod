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
  onCreated?: () => void;
};

export function CreateCourseDialog({ onCreated }: Props) {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const create = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    try {
      await axios.post(
        "/api/professor/courses",
        { name: name.trim(), description: description.trim() },
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      );
      setName("");
      setDescription("");
      setOpen(false);
      if (onCreated) onCreated();
    } catch (err: any) {
      const apiError = err?.response?.data?.error || err?.response?.data?.details || err?.message;
      const apiHint = err?.response?.data?.hint;
      setError(apiHint ? `${apiError} — ${apiHint}` : (apiError || "Failed to create course. Please try again."));
      console.error("Create course error:", err?.response?.data ?? err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create Course</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Course</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Course Name</label>
            <Input
              placeholder="e.g. Equine Medicine 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description (optional)</label>
            <textarea
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              rows={3}
              placeholder="Brief description of this course..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={create} disabled={!name.trim() || loading}>
              {loading ? "Creating..." : "Create Course"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CreateCourseDialog;
