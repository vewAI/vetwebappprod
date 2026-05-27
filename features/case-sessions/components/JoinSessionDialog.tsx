"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CaseSession } from "../models/caseSession";
import { joinSessionCreateAttempt } from "../services/caseSessionService";
import { Loader2 } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: CaseSession;
  caseId: string;
};

export function JoinSessionDialog({
  open,
  onOpenChange,
  session,
  caseId,
}: Props) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsCode = Boolean(session.accessCode?.trim());

  const reset = () => {
    setCode("");
    setError(null);
    setLoading(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      const attempt = await joinSessionCreateAttempt(
        session.id,
        needsCode ? code : undefined
      );
      onOpenChange(false);
      reset();
      router.push(
        `/case/${encodeURIComponent(caseId)}/attempt?attempt=${encodeURIComponent(attempt.id)}&session=${encodeURIComponent(session.id)}`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start attempt");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start case attempt</DialogTitle>
          <DialogDescription>
            {session.friendlyName} — {session.name}
            {needsCode
              ? " Enter the access code from your instructor to continue."
              : " Confirm to begin a new attempt for this session."}
          </DialogDescription>
        </DialogHeader>
        {needsCode && (
          <div className="grid gap-2 py-2">
            <Label htmlFor="access-code">Access code</Label>
            <Input
              id="access-code"
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter code"
            />
          </div>
        )}
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="sessions"
            onClick={() => void submit()}
            disabled={loading || (needsCode && !code.trim())}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting…
              </>
            ) : (
              "Start attempt"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
