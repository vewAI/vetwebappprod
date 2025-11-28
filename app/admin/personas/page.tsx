"use client";

import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/services/authService";

const ROLE_OPTIONS: { label: string; value: string }[] = [
  { label: "Owner", value: "owner" },
  { label: "Laboratory Technician", value: "lab-technician" },
  { label: "Attending Veterinarian", value: "veterinarian" },
  { label: "Veterinary Nurse", value: "veterinary-nurse" },
  { label: "Agricultural Producer", value: "producer" },
  { label: "Veterinary Assistant", value: "veterinary-assistant" },
  { label: "Clinical Professor", value: "professor" },
];

const ROLE_ORDER = new Map(ROLE_OPTIONS.map((option, index) => [option.value, index] as const));

type PersonaScope = "global" | "case";

type PersonaRecord = {
  id: string;
  case_id?: string | null;
  role_key: string;
  display_name: string | null;
  status: string | null;
  image_url: string | null;
  prompt: string | null;
  behavior_prompt: string | null;
  metadata: unknown;
  generated_by: string | null;
  last_generated_at: string | null;
  updated_at: string | null;
};

function formatIso(iso?: string | null): string {
  if (!iso) return "";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleString();
}

type PersonaEditorState = {
  scope: PersonaScope;
  persona: PersonaRecord;
  draftBehaviorPrompt: string;
  draftDisplayName: string;
  draftImageUrl: string;
  isDirty: boolean;
  saving: boolean;
  saveMessage?: string | null;
  error?: string | null;
  autoMessage?: string | null;
  autoError?: string | null;
  autoLoading?: boolean;
};

type CaseSummary = {
  id: string;
  title: string | null;
};

export default function PersonasAdminPage() {
  const { session, loading: authLoading } = useAuth();
  const accessToken = session?.access_token ?? null;
  const authHeaders = useMemo(() => {
    return accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
  }, [accessToken]);

  const router = useRouter();
  const [caseSummaries, setCaseSummaries] = useState<CaseSummary[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [loadingCases, setLoadingCases] = useState(false);
  const [casesError, setCasesError] = useState<string | null>(null);

  const [globalPersonaRows, setGlobalPersonaRows] = useState<PersonaEditorState[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [globalLoading, setGlobalLoading] = useState(false);

  const [casePersonaRows, setCasePersonaRows] = useState<PersonaEditorState[]>([]);
  const [personasError, setPersonasError] = useState<string | null>(null);
  const [personasLoading, setPersonasLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!authHeaders) {
      setCasesError("You must be signed in as an admin to manage personas.");
      return;
    }

    async function loadCases() {
      setLoadingCases(true);
      setCasesError(null);
      try {
        const response = await axios.get("/api/cases", { headers: authHeaders });
        const data = Array.isArray(response.data) ? response.data : [];
        const summaries = data
          .map((item: Record<string, unknown>) => ({
            id: typeof item.id === "string" ? item.id : "",
            title: typeof item.title === "string" ? item.title : null,
          }))
          .filter((item) => item.id);
        setCaseSummaries(summaries);
        setSelectedCaseId((prev) => prev || summaries[0]?.id || "");
      } catch (error) {
        const message = extractAxiosMessage(error) ?? "Failed to load cases";
        setCasesError(message);
      } finally {
        setLoadingCases(false);
      }
    }

    void loadCases();
  }, [authHeaders, authLoading]);

  useEffect(() => {
    if (!authHeaders) {
      setGlobalPersonaRows([]);
      setGlobalError(null);
      return;
    }

    async function loadGlobalPersonas() {
      setGlobalLoading(true);
      setGlobalError(null);
      try {
        const response = await axios.get("/api/global-personas", {
          headers: authHeaders,
        });
        const payload = response.data as { personas?: PersonaRecord[] } | undefined;
        const rows = Array.isArray(payload?.personas)
          ? payload?.personas ?? []
          : [];

        const editorRows: PersonaEditorState[] = rows.map((persona): PersonaEditorState => ({
          scope: "global",
          persona,
          draftBehaviorPrompt: persona.behavior_prompt ?? "",
          draftDisplayName: persona.display_name ?? "",
          draftImageUrl: persona.image_url ?? "",
          isDirty: false,
          saving: false,
          saveMessage: null,
          error: null,
          autoMessage: null,
          autoError: null,
          autoLoading: false,
        }));

        editorRows.sort((a, b) => {
          const aOrder = ROLE_ORDER.get(a.persona.role_key) ?? Number.MAX_SAFE_INTEGER;
          const bOrder = ROLE_ORDER.get(b.persona.role_key) ?? Number.MAX_SAFE_INTEGER;
          return aOrder - bOrder;
        });

        setGlobalPersonaRows(editorRows);
      } catch (error) {
        const message = extractAxiosMessage(error) ?? "Failed to load shared personas";
        setGlobalError(message);
      } finally {
        setGlobalLoading(false);
      }
    }

    void loadGlobalPersonas();
  }, [authHeaders]);

  useEffect(() => {
    if (!selectedCaseId || !authHeaders) {
      setCasePersonaRows([]);
      setPersonasError(null);
      return;
    }

    async function loadPersonas() {
      setPersonasLoading(true);
      setPersonasError(null);
      try {
        const response = await axios.get("/api/personas", {
          headers: authHeaders,
          params: { caseId: selectedCaseId },
        });
        const payload = response.data as
          | { personas?: PersonaRecord[] }
          | undefined;
        const rows = Array.isArray(payload?.personas)
          ? payload?.personas ?? []
          : [];
        const ownerRows = rows.filter((persona) => persona.role_key === "owner");

        const editorRows: PersonaEditorState[] = ownerRows.map((persona): PersonaEditorState => ({
          scope: "case",
          persona,
          draftBehaviorPrompt: persona.behavior_prompt ?? "",
          draftDisplayName: persona.display_name ?? "",
          draftImageUrl: persona.image_url ?? "",
          isDirty: false,
          saving: false,
          saveMessage: null,
          error: null,
          autoMessage: null,
          autoError: null,
          autoLoading: false,
        }));

        editorRows.sort((a, b) => {
          const aOrder = ROLE_ORDER.get(a.persona.role_key) ?? Number.MAX_SAFE_INTEGER;
          const bOrder = ROLE_ORDER.get(b.persona.role_key) ?? Number.MAX_SAFE_INTEGER;
          return aOrder - bOrder;
        });

        setCasePersonaRows(editorRows);
      } catch (error) {
        const message = extractAxiosMessage(error) ?? "Failed to load personas";
        setPersonasError(message);
      } finally {
        setPersonasLoading(false);
      }
    }

    void loadPersonas();
  }, [selectedCaseId, authHeaders]);

  const handleCaseChange = (caseId: string) => {
    setSelectedCaseId(caseId);
  };

  const updateDraft = (
    scope: PersonaScope,
    roleKey: string,
    updater: (prev: PersonaEditorState) => PersonaEditorState
  ) => {
    const setter =
      scope === "global" ? setGlobalPersonaRows : setCasePersonaRows;

    setter((prevEntries) =>
      prevEntries.map((entry) =>
        entry.persona.role_key === roleKey ? updater(entry) : entry
      )
    );
  };

  const handleInputChange = (
    scope: PersonaScope,
    roleKey: string,
    field: "behavior" | "display" | "image",
    value: string
  ) => {
    updateDraft(scope, roleKey, (prev) => {
      const next = { ...prev };
      if (field === "behavior") {
        next.draftBehaviorPrompt = value;
      } else if (field === "display") {
        next.draftDisplayName = value;
      } else if (field === "image") {
        next.draftImageUrl = value;
      }
      next.isDirty =
        next.draftBehaviorPrompt !== (next.persona.behavior_prompt ?? "") ||
        next.draftDisplayName !== (next.persona.display_name ?? "") ||
        next.draftImageUrl !== (next.persona.image_url ?? "");
      next.saveMessage = null;
      return next;
    });
  };

  const handleSave = async (scope: PersonaScope, roleKey: string) => {
    if (!authHeaders) return;
    const rows = scope === "global" ? globalPersonaRows : casePersonaRows;
    const target = rows.find((entry) => entry.persona.role_key === roleKey);
    if (!target || !target.isDirty) return;

    updateDraft(scope, roleKey, (prev) => ({ ...prev, saving: true, error: null }));

    try {
      if (scope === "global") {
        const response = await axios.put(
          "/api/global-personas",
          {
            id: target.persona.id,
            display_name: target.draftDisplayName,
            image_url: target.draftImageUrl || null,
            behavior_prompt: target.draftBehaviorPrompt || null,
          },
          { headers: authHeaders }
        );
        const payload = response.data as { persona?: PersonaRecord } | undefined;
        const updated = payload?.persona;
        if (updated) {
          updateDraft(scope, roleKey, (prev) => ({
            ...prev,
            persona: updated,
            draftBehaviorPrompt: updated.behavior_prompt ?? "",
            draftDisplayName: updated.display_name ?? "",
            draftImageUrl: updated.image_url ?? "",
            isDirty: false,
            saving: false,
            saveMessage: "Persona updated",
          }));
        } else {
          updateDraft(scope, roleKey, (prev) => ({
            ...prev,
            saving: false,
            error: "Unexpected response format",
          }));
        }
        return;
      }

      const response = await axios.put(
        "/api/personas",
        {
          id: target.persona.id,
          case_id: target.persona.case_id,
          role_key: target.persona.role_key,
          display_name: target.draftDisplayName,
          image_url: target.draftImageUrl || null,
          behavior_prompt: target.draftBehaviorPrompt || null,
        },
        { headers: authHeaders }
      );
      const payload = response.data as { persona?: PersonaRecord } | undefined;
      const updated = payload?.persona;
      if (updated) {
        updateDraft(scope, roleKey, (prev) => ({
          ...prev,
          persona: updated,
          draftBehaviorPrompt: updated.behavior_prompt ?? "",
          draftDisplayName: updated.display_name ?? "",
          draftImageUrl: updated.image_url ?? "",
          isDirty: false,
          saving: false,
          saveMessage: "Persona updated",
        }));
      } else {
        updateDraft(scope, roleKey, (prev) => ({
          ...prev,
          saving: false,
          error: "Unexpected response format",
        }));
      }
    } catch (error) {
      const message = extractAxiosMessage(error) ?? "Failed to save persona";
      updateDraft(scope, roleKey, (prev) => ({
        ...prev,
        saving: false,
        error: message,
      }));
    }
  };

  const handleAutoBehavior = async (scope: PersonaScope, roleKey: string) => {
    if (!authHeaders) return;

    if (scope === "case" && !selectedCaseId) {
      updateDraft(scope, roleKey, (prev) => ({
        ...prev,
        autoLoading: false,
        autoError: "Select a case first",
      }));
      return;
    }

    updateDraft(scope, roleKey, (prev) => ({
      ...prev,
      autoLoading: true,
      autoMessage: null,
      autoError: null,
    }));

    try {
      const requestBody =
        scope === "case"
          ? { caseId: selectedCaseId, roleKey }
          : { roleKey };

      const response = await axios.post(
        "/api/personas/auto-behavior",
        requestBody,
        { headers: authHeaders }
      );
      const payload = response.data as
        | {
            persona?: {
              behavior_prompt?: string | null;
              display_name?: string | null;
            };
          }
        | undefined;
      const behavior = payload?.persona?.behavior_prompt ?? null;
      const display = payload?.persona?.display_name ?? null;

      if (!behavior) {
        updateDraft(scope, roleKey, (prev) => ({
          ...prev,
          autoLoading: false,
          autoError: "No behavior prompt returned",
        }));
        return;
      }

      updateDraft(scope, roleKey, (prev) => ({
        ...prev,
        draftBehaviorPrompt: behavior,
        draftDisplayName: display ?? prev.draftDisplayName,
        isDirty: true,
        autoLoading: false,
        autoMessage: "Behavior prompt refreshed",
      }));
    } catch (error) {
      const message = extractAxiosMessage(error) ?? "Failed to auto-generate";
      updateDraft(scope, roleKey, (prev) => ({
        ...prev,
        autoLoading: false,
        autoError: message,
      }));
    }
  };

  const handleOpenChat = (roleKey: string) => {
    if (!selectedCaseId) return;
    router.push(`/attempts/new?caseId=${encodeURIComponent(selectedCaseId)}&role=${encodeURIComponent(roleKey)}`);
  };

  const renderPersonaRow = (row: PersonaEditorState) => {
    const { scope } = row;
    const showOpenChat = scope === "case";
    const personaIdLabel = row.persona.id;
    const scopeDescription =
      scope === "global"
        ? "Shared across all cases"
        : `Case ID: ${row.persona.case_id ?? selectedCaseId ?? ""}`;

    return (
      <section
        key={`${scope}-${row.persona.role_key}`}
        className="rounded-lg border bg-card p-6 shadow-sm"
      >
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">
              {resolveRoleLabel(row.persona.role_key)}
            </h2>
            <p className="text-sm text-muted-foreground">Persona ID: {personaIdLabel}</p>
            <p className="text-xs text-muted-foreground">{scopeDescription}</p>
            <p className="text-xs text-muted-foreground">
              Last updated: {formatIso(row.persona.updated_at)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {showOpenChat ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleOpenChat(row.persona.role_key)}
              >
                Open Chat
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => handleAutoBehavior(scope, row.persona.role_key)}
              disabled={row.autoLoading}
            >
              {row.autoLoading ? "Generating…" : "Auto behavior"}
            </Button>
            <Button
              type="button"
              onClick={() => handleSave(scope, row.persona.role_key)}
              disabled={row.saving || !row.isDirty}
            >
              {row.saving ? "Saving…" : "Save persona"}
            </Button>
          </div>
        </header>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`display-${scope}-${row.persona.role_key}`}>
              Display name
            </Label>
            <Input
              id={`display-${scope}-${row.persona.role_key}`}
              placeholder="Display name"
              value={row.draftDisplayName}
              onChange={(event) =>
                handleInputChange(
                  scope,
                  row.persona.role_key,
                  "display",
                  event.target.value
                )
              }
            />
            <p className="text-xs text-muted-foreground">
              Currently shown to students and admins.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`image-${scope}-${row.persona.role_key}`}>
              Portrait URL
            </Label>
            <Input
              id={`image-${scope}-${row.persona.role_key}`}
              placeholder="https://"
              value={row.draftImageUrl}
              onChange={(event) =>
                handleInputChange(
                  scope,
                  row.persona.role_key,
                  "image",
                  event.target.value
                )
              }
            />
            <p className="text-xs text-muted-foreground">
              Used by the chat UI. Leave blank to remove.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <Label htmlFor={`behavior-${scope}-${row.persona.role_key}`}>
            Behavior prompt
          </Label>
          <Textarea
            id={`behavior-${scope}-${row.persona.role_key}`}
            placeholder="Describe how this persona behaves during chat sessions"
            rows={8}
            value={row.draftBehaviorPrompt}
            onChange={(event) =>
              handleInputChange(
                scope,
                row.persona.role_key,
                "behavior",
                event.target.value
              )
            }
          />
          <p className="text-xs text-muted-foreground">
            Injected into chat sessions to guide persona responses. Keep factual and aligned with the case record.
          </p>
        </div>

        {row.saveMessage ? (
          <p className="mt-3 text-sm text-green-600">{row.saveMessage}</p>
        ) : null}
        {row.error ? (
          <p className="mt-3 text-sm text-red-600">{row.error}</p>
        ) : null}
        {row.autoMessage ? (
          <p className="mt-3 text-sm text-blue-600">{row.autoMessage}</p>
        ) : null}
        {row.autoError ? (
          <p className="mt-3 text-sm text-red-600">{row.autoError}</p>
        ) : null}
      </section>
    );
  };

  const selectedCase = caseSummaries.find((entry) => entry.id === selectedCaseId);

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Persona Management</h1>
          <p className="text-sm text-muted-foreground">
            Update persona display names, behavior prompts, and portrait URLs.
          </p>
        </div>
        <Button
          variant="outline"
          type="button"
          onClick={() => router.push("/admin")}
        >
          Back to Admin
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <Label htmlFor="case-selector">Select case</Label>
          <div className="relative">
            <select
              id="case-selector"
              className="w-full appearance-none rounded border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={selectedCaseId}
              onChange={(event) => handleCaseChange(event.target.value)}
              disabled={loadingCases || !caseSummaries.length}
            >
              {loadingCases ? (
                <option value="">Loading cases…</option>
              ) : (
                caseSummaries.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.title ? `${entry.title} (${entry.id})` : entry.id}
                  </option>
                ))
              )}
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">
              v
            </span>
          </div>
          {casesError ? (
            <p className="mt-2 text-sm text-red-600">{casesError}</p>
          ) : null}
        </div>
        {selectedCase ? (
          <div className="md:col-span-1">
            <Label>Case details</Label>
            <div className="rounded border p-3 text-sm">
              <p className="font-semibold">{selectedCase.title ?? "Untitled"}</p>
              <p className="text-muted-foreground">{selectedCase.id}</p>
            </div>
          </div>
        ) : null}
      </div>
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Shared Personas</h2>
          <p className="text-sm text-muted-foreground">
            These personas are reused across every case except for the owner role.
          </p>
        </div>
        {globalLoading ? (
          <p className="text-center">Loading shared personas…</p>
        ) : globalError ? (
          <p className="text-center text-red-600">{globalError}</p>
        ) : !globalPersonaRows.length ? (
          <p className="text-center text-muted-foreground">No shared personas found.</p>
        ) : (
          <div className="grid gap-6">
            {globalPersonaRows.map(renderPersonaRow)}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Case Personas</h2>
          <p className="text-sm text-muted-foreground">
            Owners remain case-specific. Select a case to manage its owner persona.
          </p>
        </div>
        {personasLoading ? (
          <p className="text-center">Loading personas…</p>
        ) : personasError ? (
          <p className="text-center text-red-600">{personasError}</p>
        ) : !casePersonaRows.length ? (
          <p className="text-center text-muted-foreground">No owner persona found for this case.</p>
        ) : (
          <div className="grid gap-6">
            {casePersonaRows.map(renderPersonaRow)}
          </div>
        )}
      </section>
    </div>
  );
}

function resolveRoleLabel(roleKey: string): string {
  const match = ROLE_OPTIONS.find((option) => option.value === roleKey);
  if (match) return match.label;
  return roleKey.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

type AxiosErrorLike = {
  isAxiosError?: boolean;
  message?: string;
  response?: {
    data?: unknown;
  };
};

function extractAxiosMessage(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === "string") return error;
  const candidate = error as AxiosErrorLike;
  if (candidate?.isAxiosError) {
    const data = candidate.response?.data as { error?: unknown } | undefined;
    const value = data?.error;
    if (typeof value === "string") return value;
    if (value && typeof value === "object" && "message" in value) {
      const nested = (value as { message?: unknown }).message;
      if (typeof nested === "string") return nested;
    }
    if (typeof candidate.message === "string") return candidate.message;
  }
  if (error instanceof Error) return error.message;
  return null;
}
