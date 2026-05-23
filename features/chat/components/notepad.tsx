"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type NotepadProps = {
  isOpen: boolean;
  onClose: () => void;
  caseId?: string;
  attemptId?: string;
};

export function Notepad({ isOpen, onClose, caseId, attemptId }: NotepadProps) {
  const [notes, setNotes] = useState("");

  const storageKey = `osce-notes-${caseId || "nocase"}-${attemptId || "noattempt"}`;

  useEffect(() => {
    const savedNotes = localStorage.getItem(storageKey);
    if (savedNotes) {
      setNotes(savedNotes);
    } else {
      setNotes("");
    }
  }, [storageKey]);

  useEffect(() => {
    if (notes !== undefined) {
      localStorage.setItem(storageKey, notes);
    }
  }, [notes, storageKey]);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-[80px] right-4 z-50 w-80 rounded-lg border bg-background shadow-lg md:w-96">
      <div className="flex items-center justify-between border-b p-3">
        <h3 className="font-medium">Clinical Notes</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="p-3">
        <Textarea
          id="clinical-notes"
          name="clinical-notes"
          autoComplete="off"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Take notes during your examination..."
          className="min-h-[200px] resize-none"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Notes are saved per case and attempt
        </p>
      </div>
    </div>
  );
}
