"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchCases } from "@/features/case-selection/services/caseService";
import type { Case } from "@/features/case-selection/models/case";
import { createSession } from "../services/caseSessionService";
import { fromDatetimeLocalValue, toDatetimeLocalValue } from "../utils/datetimeLocal";
import { getAccessToken } from "@/lib/auth-headers";
import { useAuth } from "@/features/auth/services/authService";
import type { YearGroup } from "@/features/year-groups/models/yearGroup";
import { Loader2 } from "lucide-react";

type Props = {
  initialCaseId?: string | null;
};

export function CreateCaseSessionForm({ initialCaseId }: Props) {
  const router = useRouter();
  const { role } = useAuth();
  const [search, setSearch] = useState("");
  const [caseResults, setCaseResults] = useState<Case[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState(initialCaseId ?? "");
  const [name, setName] = useState("");
  const [friendlyName, setFriendlyName] = useState("");
  const [description, setDescription] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [attemptLimit, setAttemptLimit] = useState("");
  const now = new Date();
  const defaultStart = now;
  const defaultEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const [startLocal, setStartLocal] = useState(toDatetimeLocalValue(defaultStart));
  const [endLocal, setEndLocal] = useState(toDatetimeLocalValue(defaultEnd));
  const [yearGroups, setYearGroups] = useState<YearGroup[]>([]);
  const [yearGroupId, setYearGroupId] = useState("");
  const [loadingCases, setLoadingCases] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch("/api/year-groups", {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        });
        const body = await res.json().catch(() => ({}));
        if (!cancelled) setYearGroups(body.yearGroups ?? []);
      } catch {
        if (!cancelled) setYearGroups([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (initialCaseId) setSelectedCaseId(initialCaseId);
  }, [initialCaseId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoadingCases(true);
      try {
        const list = await fetchCases({
          search: search.trim() || undefined,
          limit: 50,
        });
        if (!cancelled) setCaseResults(list);
      } catch (e) {
        console.warn(e);
        if (!cancelled) setCaseResults([]);
      } finally {
        if (!cancelled) setLoadingCases(false);
      }
    };
    const t = setTimeout(run, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [search]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedCaseId) {
      setError("Select a case");
      return;
    }
    if (!name.trim() || !friendlyName.trim()) {
      setError("Session name and friendly name are required");
      return;
    }
    if (!yearGroupId) {
      setError("Select a year group");
      return;
    }
    const startAt = fromDatetimeLocalValue(startLocal);
    const endAt = fromDatetimeLocalValue(endLocal);
    if (!startAt || !endAt) {
      setError("Invalid start or end time");
      return;
    }
    let attemptLimitPerStudent: number | null = null;
    if (attemptLimit.trim() !== "") {
      const n = parseInt(attemptLimit, 10);
      if (!Number.isFinite(n) || n < 1) {
        setError("Attempts per student must be a positive integer or empty");
        return;
      }
      attemptLimitPerStudent = n;
    }

    setSubmitting(true);
    try {
      const session = await createSession({
        caseId: selectedCaseId,
        name: name.trim(),
        friendlyName: friendlyName.trim(),
        description: description.trim(),
        accessCode: accessCode.trim() || null,
        startAt,
        endAt,
        attemptLimitPerStudent,
        yearGroupId,
      });
      router.push(`/professor/sessions/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-xl space-y-6">

      <div className="space-y-2">
        <Label>Find case</Label>
        <Input
          placeholder="Search by title or description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {loadingCases && (
          <p className="text-xs text-muted-foreground">Searching…</p>
        )}
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={selectedCaseId}
          onChange={(e) => setSelectedCaseId(e.target.value)}
        >
          <option value="">— Select case —</option>
          {caseResults.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title} ({c.species})
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="year-group">Year group</Label>
        <select
          id="year-group"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={yearGroupId}
          onChange={(e) => setYearGroupId(e.target.value)}
          required
        >
          <option value="">— Select year group —</option>
          {yearGroups.map((group) => {
            const label =
              role === "admin" && group.institutionName
                ? `${group.institutionName} — ${group.name}`
                : group.name;
            return (
              <option key={group.id} value={group.id}>
                {label}
              </option>
            );
          })}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sess-name">Session name (internal)</Label>
        <Input
          id="sess-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Week 3 Lab — Small Animal"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="friendly">Friendly name (shown to students)</Label>
        <Input
          id="friendly"
          value={friendlyName}
          onChange={(e) => setFriendlyName(e.target.value)}
          placeholder="e.g. Tuesday lab session"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="desc">Description</Label>
        <textarea
          id="desc"
          className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="start">Start</Label>
          <Input
            id="start"
            type="datetime-local"
            value={startLocal}
            onChange={(e) => setStartLocal(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end">End</Label>
          <Input
            id="end"
            type="datetime-local"
            value={endLocal}
            onChange={(e) => setEndLocal(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="code">Access code (optional)</Label>
        <Input
          id="code"
          value={accessCode}
          onChange={(e) => setAccessCode(e.target.value)}
          placeholder="Leave empty for open session"
          autoComplete="off"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="limit">Attempts per student (optional)</Label>
        <Input
          id="limit"
          type="number"
          min={1}
          value={attemptLimit}
          onChange={(e) => setAttemptLimit(e.target.value)}
          placeholder="Unlimited if empty"
        />
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" variant="default" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating…
          </>
        ) : (
          "Create session"
        )}
      </Button>
    </form>
  );
}
