"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function NurseIntroModal({ open, nurse, onClose }: { open: boolean; nurse: any | null; onClose: () => void }) {
  if (!nurse) return null;

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{nurse.displayName ?? "Veterinary Nurse"}</DialogTitle>
          <DialogDescription className="mt-2">
            {nurse.behaviorPrompt ? (
              <div className="prose text-sm max-h-40 overflow-y-auto break-words">{nurse.behaviorPrompt}</div>
            ) : (
              <p className="text-sm text-muted-foreground">A helpful nursing assistant will be available in this case.</p>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-3">
          {nurse.imageUrl && (
            <div className="w-28 h-28 rounded overflow-hidden">
              <img src={nurse.imageUrl} alt={nurse.displayName} className="w-full h-full object-cover" />
            </div>
          )}

          {nurse.skills && nurse.skills.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold">Skills</h4>
              <ul className="list-disc ml-5 text-sm">
                {nurse.skills.map((s: any, idx: number) => (
                  <li key={idx}>{s.name ?? s}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Dismiss
            </Button>
            <Button onClick={onClose}>Continue</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
