"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
// ImageUploader intentionally not used here to allow manual image_url input in edit mode.
import axios from "axios";
import {
  caseFieldMeta,
  orderedCaseFieldKeys,
  type CaseFieldKey,
} from "@/features/cases/fieldMeta";
import { isCaseFieldAutomatable } from "@/features/prompts/services/casePromptAutomation";
import { useAuth } from "@/features/auth/services/authService";
import { CaseMediaEditor } from "@/features/cases/components/case-media-editor";
import {
  normalizeCaseMedia,
  type CaseMediaItem,
} from "@/features/cases/models/caseMedia";

type CaseRecord = Record<string, unknown>;

type PersonaRow = {
  id: string;
  case_id?: string | null;
  role_key?: string | null;
  display_name?: string | null;
  status?: string | null;
  image_url?: string | null;
  prompt?: string | null;
  metadata?: Record<string, unknown> | null;
  generated_by?: string | null;
  last_generated_at?: string | null;
  updated_at?: string | null;
};

const knownFieldKeys = new Set<CaseFieldKey>(orderedCaseFieldKeys);

type AxiosErrorLike = {
  isAxiosError?: boolean;
  message: string;
  response?: {
    data?: unknown;
  };
};

export default function CaseViewerPage() {
  const { session, loading: authLoading } = useAuth();
  const accessToken = session?.access_token ?? null;
  const authHeaders = useMemo(() => {
    return accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
  }, [accessToken]);

  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editable, setEditable] = useState(false);
  const [formState, setFormState] = useState<CaseRecord | null>(null);
  const [expandedField, setExpandedField] = useState<CaseFieldKey | null>(
    null
  );
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [personas, setPersonas] = useState<PersonaRow[]>([]);
  const [personasLoading, setPersonasLoading] = useState(false);
  const [personasError, setPersonasError] = useState<string | null>(null);
  const [automationState, setAutomationState] = useState<
    Record<
      string,
      {
        loading: boolean;
        message: string | null;
        error: string | null;
      }
    >
  >({});
  const [mediaDraft, setMediaDraft] = useState<CaseMediaItem[]>([]);

  const parseMedia = useCallback((raw: unknown): CaseMediaItem[] => {
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        return normalizeCaseMedia(parsed);
      } catch {
        return [];
      }
    }
    return normalizeCaseMedia(raw);
  }, []);

  const loadCaseIntoForm = useCallback(
    (record: CaseRecord | null) => {
      if (!record) {
        setFormState(null);
        setMediaDraft([]);
        return;
      }
      const media = parseMedia((record as Record<string, unknown>)["media"]);
      setFormState({ ...record, media });
      setMediaDraft(media);
    },
    [parseMedia]
  );

  const handleMediaChange = useCallback(
    (items: CaseMediaItem[]) => {
      setMediaDraft(items);
      setFormState((prev) => (prev ? { ...prev, media: items } : prev));
    },
    []
  );

  const loadPersonas = useCallback(
    async (caseId: string) => {
      if (!authHeaders) {
        setPersonas([]);
        setPersonasError("You must be signed in to load personas.");
        return;
      }

      try {
        setPersonasLoading(true);
        setPersonasError(null);
        const resp = await axios.get("/api/personas", {
          headers: authHeaders,
          params: { caseId },
        });
        const data = resp.data as { personas?: PersonaRow[] };
        const list = Array.isArray(data?.personas) ? data.personas ?? [] : [];
        const ownerRows = list.filter((row) => row.role_key === "owner");

        let combined = [...ownerRows];
        try {
          const sharedResp = await axios.get("/api/global-personas", {
            headers: authHeaders,
          });
          const shared = sharedResp.data as { personas?: PersonaRow[] };
          if (Array.isArray(shared?.personas)) {
            combined = combined.concat(shared.personas);
          }
        } catch (sharedErr) {
          console.warn(
            "Failed to load shared personas in case viewer",
            sharedErr
          );
        }

        setPersonas(combined);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setPersonasError(`Failed to load personas: ${message}`);
        setPersonas([]);
      } finally {
        setPersonasLoading(false);
      }
    },
    [authHeaders]
  );

  useEffect(() => {
    async function fetchCases() {
      if (!authHeaders) {
        setCases([]);
        setFormState(null);
        setError("You must be signed in to view cases.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      try {
        const response = await axios.get("/api/cases", {
          headers: authHeaders,
        });
        const data = response.data as unknown;
        const parsed = Array.isArray(data)
          ? (data as CaseRecord[])
          : ([] as CaseRecord[]);
        setCases(parsed);
        if (parsed.length > 0) {
          setCurrentIndex(0);
          loadCaseIntoForm(parsed[0]);
          const firstId = formatValue(parsed[0]["id"]).trim();
          if (firstId) {
            void loadPersonas(firstId);
          }
        } else {
          setCurrentIndex(0);
          loadCaseIntoForm(null);
          setPersonas([]);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(`Error loading cases: ${message}`);
      } finally {
        setLoading(false);
      }
    }

    if (authLoading) return;
    void fetchCases();
  }, [authHeaders, authLoading, loadCaseIntoForm, loadPersonas]);

  useEffect(() => {
    if (!cases.length) {
      loadCaseIntoForm(null);
      setPersonas([]);
      return;
    }
    const next = cases[currentIndex];
    loadCaseIntoForm(next ?? null);
    const nextId = next ? formatValue(next["id"]).trim() : "";
    if (nextId) {
      void loadPersonas(nextId);
    } else {
      setPersonas([]);
    }
  }, [cases, currentIndex, loadCaseIntoForm, loadPersonas]);

  useEffect(() => {
    setAutomationState({});
  }, [currentIndex]);

  const updateField = (field: string, value: string) => {
    setFormState((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const isAxiosError = (error: unknown): error is AxiosErrorLike => {
    return (
      typeof error === "object" &&
      error !== null &&
      Boolean((error as { isAxiosError?: boolean }).isAxiosError)
    );
  };

  const updateAutomationStatus = (
    field: CaseFieldKey,
    updater: (
      prev:
        | {
            loading: boolean;
            message: string | null;
            error: string | null;
          }
        | undefined
    ) => {
      loading: boolean;
      message: string | null;
      error: string | null;
    }
  ) => {
    setAutomationState((prev) => {
      const next = { ...prev };
      next[field] = updater(prev[field]);
      return next;
    });
  };

  const clearAutomationMessageLater = (field: CaseFieldKey) => {
    setTimeout(() => {
      setAutomationState((prev) => {
        const current = prev[field];
        if (!current || current.loading) {
          return prev;
        }
        if (!current.message) {
          return prev;
        }
        return {
          ...prev,
          [field]: {
            ...current,
            message: null,
          },
        };
      });
    }, 2000);
  };

  const handleAutoGenerateImage = async () => {
    if (!formState) {
      return;
    }

    if (!authHeaders) {
      updateAutomationStatus("image_url", () => ({
        loading: false,
        message: null,
        error: "Sign in required to auto-generate images.",
      }));
      clearAutomationMessageLater("image_url");
      return;
    }

    const field: CaseFieldKey = "image_url";
    const caseId = formatValue(formState["id"]).trim();
    if (!caseId) {
      updateAutomationStatus(field, () => ({
        loading: false,
        message: null,
        error: "Case id missing. Save the case before auto-generating.",
      }));
      clearAutomationMessageLater(field);
      return;
    }

    updateAutomationStatus(field, () => ({
      loading: true,
      message: null,
      error: null,
    }));

    try {
      const response = await axios.post(
        "/api/cases/image",
        {
          id: caseId,
          force: true,
        },
        {
          headers: authHeaders,
        }
      );
      const data = response.data as { data?: { image_url?: string } };
      const generatedUrl = data?.data?.image_url ?? "";

      if (generatedUrl) {
        setFormState((prev) =>
          prev ? { ...prev, image_url: generatedUrl } : prev
        );
        setCases((prev) => {
          const next = [...prev];
          if (next[currentIndex]) {
            next[currentIndex] = {
              ...next[currentIndex],
              image_url: generatedUrl,
            };
          }
          return next;
        });
        updateAutomationStatus(field, () => ({
          loading: false,
          message: "Image updated",
          error: null,
        }));
      } else {
        updateAutomationStatus(field, () => ({
          loading: false,
          message: null,
          error: "Image generation returned no URL.",
        }));
      }
    } catch (err: unknown) {
      let message: string;
      if (isAxiosError(err)) {
        const data = err.response?.data as { error?: string } | undefined;
        message = data?.error ?? err.message;
      } else if (err instanceof Error) {
        message = err.message;
      } else {
        message = String(err ?? "Unknown error");
      }

      updateAutomationStatus(field, () => ({
        loading: false,
        message: null,
        error: message,
      }));
    }

    clearAutomationMessageLater(field);
  };

  const handleAutoGenerateField = async (field: CaseFieldKey) => {
    if (!formState) {
      return;
    }

    if (!authHeaders) {
      updateAutomationStatus(field, () => ({
        loading: false,
        message: null,
        error: "Sign in required to auto-generate fields.",
      }));
      clearAutomationMessageLater(field);
      return;
    }

    const caseId = formatValue(formState["id"]).trim();
    if (!caseId) {
      updateAutomationStatus(field, () => ({
        loading: false,
        message: null,
        error: "Case id missing. Save the case before auto-generating.",
      }));
      clearAutomationMessageLater(field);
      return;
    }

    if (!isCaseFieldAutomatable(field)) {
      updateAutomationStatus(field, () => ({
        loading: false,
        message: null,
        error: "Automation not available for this field.",
      }));
      clearAutomationMessageLater(field);
      return;
    }

    updateAutomationStatus(field, () => ({
      loading: true,
      message: null,
      error: null,
    }));

    try {
      const response = await axios.post(
        "/api/cases/auto-field",
        {
          caseId,
          field,
        },
        {
          headers: authHeaders,
        }
      );
      const data = response.data as { content?: string };
      const content = typeof data.content === "string" ? data.content : "";

      let updatedSnapshot: CaseRecord | null = null;
      setFormState((prev) => {
        if (!prev) {
          return prev;
        }
        updatedSnapshot = { ...prev, [field]: content };
        return updatedSnapshot;
      });

      if (updatedSnapshot) {
        const snapshot = updatedSnapshot;
        setCases((prev) => {
          const next = [...prev];
          const current = next[currentIndex];
          if (current) {
            next[currentIndex] = Object.assign({}, current, snapshot);
          }
          return next;
        });
      }
      updateAutomationStatus(field, () => ({
        loading: false,
        message: "Auto-generated",
        error: null,
      }));
      clearAutomationMessageLater(field);
    } catch (err: unknown) {
      let message: string;
      if (isAxiosError(err)) {
        const data = err.response?.data as { error?: string } | undefined;
        message = data?.error ?? err.message;
      } else if (err instanceof Error) {
        message = err.message;
      } else {
        message = String(err ?? "Unknown error");
      }

      updateAutomationStatus(field, () => ({
        loading: false,
        message: null,
        error: message,
      }));
    }
  };

  const formatValue = (value: unknown, pretty = false) => {
    if (value === undefined || value === null) return "";
    if (typeof value === "object") {
      try {
        return JSON.stringify(value, null, pretty ? 2 : 0);
      } catch {
        return String(value);
      }
    }
    return String(value);
  };

  const extraEntries = useMemo(() => {
    if (!formState) return [] as [string, unknown][];
    return Object.entries(formState).filter(
      ([key]) => key !== "media" && !knownFieldKeys.has(key as CaseFieldKey)
    );
  }, [formState]);

  const handlePrev = () => {
    setCurrentIndex((i) => Math.max(0, i - 1));
  };

  const handleNext = () => {
    if (!cases.length) return;
    setCurrentIndex((i) => Math.min(cases.length - 1, i + 1));
  };

  if (loading) return <div className="p-8 text-center">Loading cases...</div>;
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>;
  if (!cases.length)
    return <div className="p-8 text-center">No cases found.</div>;

  const imageUrl = formState ? formatValue(formState["image_url"]) : "";
  const caseIdValue = formState ? formatValue(formState["id"]).trim() : "";

  const baseFieldClasses =
    "w-full rounded-md border border-input px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors";
  const editableFieldClasses = "bg-card text-card-foreground";
  const readOnlyFieldClasses = "bg-muted/30 text-card-foreground";
  const inputFieldClass = `${baseFieldClasses} ${editable ? editableFieldClasses : readOnlyFieldClasses}`;
  const textareaFieldClass = `${baseFieldClasses} ${editable ? editableFieldClasses : readOnlyFieldClasses}`;

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Case Viewer</h1>
      {/* Show image if available */}
      {imageUrl && (
        <div className="mb-4 rounded bg-gray-100">
          <div
            className="relative w-full overflow-hidden"
            style={{ aspectRatio: "4 / 3" }}
          >
            <Image
              src={imageUrl}
              alt={`Case ${formatValue(formState?.["id"])} image`}
              fill
              className="object-contain object-center"
              sizes="(max-width: 768px) 100vw, 640px"
              unoptimized
            />
          </div>
        </div>
      )}
      <div className="mb-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Button
            onClick={handlePrev}
            disabled={currentIndex === 0}
          >
            ← Prev
          </Button>
          <span className="font-semibold">
            Case {currentIndex + 1} of {cases.length}
          </span>
          <Button
            onClick={handleNext}
            disabled={currentIndex === cases.length - 1}
          >
            Next →
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={editable ? "ghost" : "default"}
            onClick={() => {
              setEditable((prev) => {
                if (prev && cases[currentIndex]) {
                  loadCaseIntoForm(cases[currentIndex]);
                }
                return !prev;
              });
            }}
          >
            {editable ? "Lock" : "Edit"}
          </Button>
          <Button
            onClick={async () => {
              if (!formState) return;
              if (!authHeaders) {
                alert("You must be signed in to save cases.");
                return;
              }
              try {
                const payload = { ...formState, media: mediaDraft };
                const resp = await axios.put("/api/cases", payload, {
                  headers: authHeaders,
                });
                const respData = resp.data as unknown;
                const respObj = respData as Record<string, unknown>;
                if (respObj && respObj["data"]) {
                  const updated = respObj["data"] as CaseRecord;
                  const normalizedUpdated = {
                    ...updated,
                    media: parseMedia((updated as Record<string, unknown>)["media"]),
                  } as CaseRecord;
                  const nextCases = [...cases];
                  nextCases[currentIndex] = normalizedUpdated;
                  setCases(nextCases);
                  loadCaseIntoForm(normalizedUpdated);
                  const updatedId = formatValue(updated["id"]).trim();
                  if (updatedId) {
                    void loadPersonas(updatedId);
                  }
                  setEditable(false);
                  setExpandedField(null);
                }
              } catch (err) {
                console.error("Error saving case:", err);
                alert("Error saving case. See console for details.");
              }
            }}
          >
            Save
          </Button>
          <Button
            className="bg-red-600 text-white hover:bg-red-700"
            onClick={() => {
              setDeleteStep(1);
              setShowDeleteModal(true);
            }}
          >
            Delete
          </Button>
        </div>
      </div>
      {formState && caseIdValue && (
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Persona Portraits</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const caseId = caseIdValue;
                if (caseId) {
                  void loadPersonas(caseId);
                }
              }}
              disabled={personasLoading}
            >
              {personasLoading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
          {personasError && (
            <p className="mb-2 text-sm text-red-600">{personasError}</p>
          )}
          {personas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {personasLoading
                ? "Loading portraits..."
                : "No personas found for this case yet."}
            </p>
          ) : (
            <div className="space-y-3">
              {personas.map((persona) => {
                const label = persona.display_name ?? persona.role_key ?? "Persona";
                const statusLabel = persona.status ?? "pending";
                const updatedAt = persona.updated_at ?? persona.last_generated_at;
                const errorDetail =
                  persona.metadata &&
                  typeof persona.metadata === "object" &&
                  "error" in persona.metadata
                    ? String((persona.metadata as Record<string, unknown>).error ?? "")
                    : "";
                const metadata =
                  persona.metadata && typeof persona.metadata === "object"
                    ? (persona.metadata as Record<string, unknown>)
                    : null;
                const identityRaw = metadata?.identity as
                  | {
                      fullName?: string;
                      voiceId?: string;
                      sex?: string;
                    }
                  | undefined;
                const identityFullName = identityRaw?.fullName;
                const voiceId = (metadata?.voiceId ?? identityRaw?.voiceId) as
                  | string
                  | undefined;
                const sex = (metadata?.sex ?? identityRaw?.sex) as
                  | string
                  | undefined;
                return (
                  <div
                    key={persona.id ?? `${persona.case_id ?? ""}-${persona.role_key ?? ""}`}
                    className="flex items-center gap-3 rounded border p-3"
                  >
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded bg-muted">
                      {persona.image_url ? (
                        <Image
                          src={persona.image_url}
                          alt={`${label} portrait`}
                          fill
                          className="object-cover"
                          sizes="64px"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                          No image
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{label}</div>
                      <div className="text-xs text-muted-foreground">
                        Role key: {persona.role_key ?? "unknown"}
                      </div>
                      {identityFullName && (
                        <div className="text-xs text-muted-foreground">
                          Identity: {identityFullName}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        Voice: {voiceId ?? "auto"}
                        {sex ? ` · Sex: ${sex}` : ""}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Status: {statusLabel}
                        {updatedAt && (
                          <span className="pl-1">
                            · Updated {new Date(updatedAt).toLocaleString()}
                          </span>
                        )}
                        {errorDetail && (
                          <span className="block text-red-600">
                            Error: {errorDetail}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {formState && (
        <div className="mb-6">
          <CaseMediaEditor
            caseId={caseIdValue || undefined}
            value={mediaDraft}
            onChange={handleMediaChange}
            readOnly={!editable}
          />
        </div>
      )}
      <form className="space-y-4">
        {formState &&
          orderedCaseFieldKeys.map((key) => {
            const meta = caseFieldMeta[key];
            const helpId = meta.help ? `${key}-help` : undefined;
            const rawValue = formState[key];
            const automation = automationState[key];
            const isAutomatable = isCaseFieldAutomatable(key);
            const canAutoGenerate = editable && isAutomatable;

            if (key === "image_url") {
              return (
                <div key={key}>
                  <label className="block font-medium mb-1" htmlFor={key}>
                    {meta.label}
                  </label>
                  <div className="flex items-start gap-2">
                    <input
                      type="text"
                      name={key}
                      value={formatValue(rawValue)}
                      readOnly={!editable}
                      onChange={(e) => updateField(key, e.target.value)}
                      placeholder={meta.placeholder}
                      aria-describedby={helpId}
                      className={inputFieldClass}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => void handleAutoGenerateImage()}
                      disabled={!editable || automation?.loading}
                    >
                      {automation?.loading ? "Generating..." : "Auto-generate"}
                    </Button>
                  </div>
                  {meta.help && (
                    <p
                      id={helpId}
                      className="mt-1 text-sm text-muted-foreground"
                    >
                      {meta.help}
                    </p>
                  )}
                  {automation?.error ? (
                    <p className="mt-1 text-sm text-red-600">
                      {automation.error}
                    </p>
                  ) : null}
                  {automation?.message ? (
                    <p className="mt-1 text-sm text-green-600">
                      {automation.message}
                    </p>
                  ) : null}
                </div>
              );
            }

            if (meta.multiline) {
              return (
                <div key={key}>
                  <label className="block font-medium mb-1" htmlFor={key}>
                    {meta.label}
                  </label>
                  <div className="flex items-start gap-2">
                    <textarea
                      value={formatValue(rawValue, true)}
                      id={key}
                      name={key}
                      autoComplete="off"
                      readOnly={!editable}
                      onChange={(e) => updateField(key, e.target.value)}
                      placeholder={meta.placeholder}
                      aria-describedby={helpId}
                      className={textareaFieldClass}
                      rows={3}
                    />
                    <div className="flex flex-col gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setExpandedField(key)}
                      >
                        Expand
                      </Button>
                      {isAutomatable ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => void handleAutoGenerateField(key)}
                          disabled={!canAutoGenerate || automation?.loading}
                        >
                          {automation?.loading ? "Generating..." : "Auto-generate"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {meta.help && (
                    <p
                      id={helpId}
                      className="mt-1 text-sm text-muted-foreground"
                    >
                      {meta.help}
                    </p>
                  )}
                  {automation?.error ? (
                    <p className="mt-1 text-sm text-red-600">{automation.error}</p>
                  ) : null}
                  {automation?.message ? (
                    <p className="mt-1 text-sm text-green-600">{automation.message}</p>
                  ) : null}
                </div>
              );
            }

            return (
              <div key={key}>
                <label className="block font-medium mb-1" htmlFor={key}>
                  {meta.label}
                </label>
                <div className="flex items-start gap-2">
                  <input
                    type="text"
                    name={key}
                    value={formatValue(rawValue)}
                    readOnly={!editable}
                    onChange={(e) => updateField(key, e.target.value)}
                    placeholder={meta.placeholder}
                    aria-describedby={helpId}
                    className={inputFieldClass}
                  />
                  {isAutomatable ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => void handleAutoGenerateField(key)}
                      disabled={!canAutoGenerate || automation?.loading}
                    >
                      {automation?.loading ? "Generating..." : "Auto-generate"}
                    </Button>
                  ) : null}
                </div>
                {meta.help && (
                  <p
                    id={helpId}
                    className="mt-1 text-sm text-muted-foreground"
                  >
                    {meta.help}
                  </p>
                )}
                {automation?.error ? (
                  <p className="mt-1 text-sm text-red-600">{automation.error}</p>
                ) : null}
                {automation?.message ? (
                  <p className="mt-1 text-sm text-green-600">{automation.message}</p>
                ) : null}
              </div>
            );
          })}

        {extraEntries.length > 0 && (
          <div className="pt-4 border-t border-border/40 space-y-4">
            <h2 className="text-lg font-semibold">Additional Fields</h2>
            {extraEntries.map(([key, value]) => (
              <div key={key}>
                <label className="block font-medium mb-1" htmlFor={key}>
                  {key.replace(/_/g, " ")}
                </label>
                <textarea
                  value={formatValue(value, true)}
                  id={key}
                  name={key}
                  autoComplete="off"
                  readOnly={!editable}
                  onChange={(e) => updateField(key, e.target.value)}
                  className={textareaFieldClass}
                  rows={3}
                />
              </div>
            ))}
          </div>
        )}

        {/* Modal for expanded field */}
        {expandedField && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-background text-foreground rounded-lg shadow-lg max-w-2xl w-full p-6">
              <h2 className="text-lg font-bold mb-2">
                {caseFieldMeta[expandedField]?.label ?? expandedField}
              </h2>
              <textarea
                value={formatValue(formState?.[expandedField], true)}
                id={`${expandedField}-expanded`}
                name={expandedField}
                autoComplete="off"
                readOnly={!editable}
                onChange={(e) => updateField(expandedField, e.target.value)}
                className={`${textareaFieldClass} h-64`}
                rows={caseFieldMeta[expandedField]?.rows ?? 12}
              />
              {caseFieldMeta[expandedField]?.help && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {caseFieldMeta[expandedField]?.help}
                </p>
              )}
              <div className="flex justify-end mt-4">
                <Button type="button" onClick={() => setExpandedField(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Delete confirmation modal (two-step) */}
        {showDeleteModal && formState && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div
              className={`rounded-lg shadow-lg max-w-md w-full p-6 ${
                deleteStep === 2
                  ? "bg-red-600 text-white"
                  : "bg-white text-black"
              }`}
            >
              {deleteStep === 1 ? (
                <>
                  <h3 className="text-xl font-bold mb-2">Confirm Delete</h3>
                  <p className="mb-4">
                    Are you sure you want to delete the case{" "}
                    <strong>{formatValue(formState["id"])}</strong>?
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => setShowDeleteModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="bg-yellow-500 text-black hover:bg-yellow-600"
                      onClick={() => setDeleteStep(2)}
                    >
                      Proceed to Delete
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-xl font-bold mb-2">Final Confirmation</h3>
                  <p className="mb-4">
                    This action is irreversible. Deleting the case will remove
                    it from the system permanently.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setDeleteStep(1);
                      }}
                    >
                      Back
                    </Button>
                    <Button
                      className="ml-auto bg-white text-red-600 hover:bg-red-100"
                      onClick={async () => {
                        const id = formatValue(formState["id"]);
                        if (!id) return;
                        if (!authHeaders) {
                          alert("You must be signed in to delete cases.");
                          return;
                        }
                        try {
                          setIsDeleting(true);
                          const resp = await axios.delete(
                            `/api/cases?id=${encodeURIComponent(id)}`,
                            {
                              headers: authHeaders,
                            }
                          );
                          const respData = resp.data as unknown;
                          const respObj = respData as Record<string, unknown>;
                          if (respObj && respObj["success"]) {
                            const next = cases.filter(
                              (c) => formatValue(c["id"]) !== id
                            );
                            setCases(next);
                            const newIndex = Math.max(
                              0,
                              Math.min(currentIndex, next.length - 1)
                            );
                            setCurrentIndex(newIndex);
                            setFormState(
                              next[newIndex] ? { ...next[newIndex] } : null
                            );
                            setShowDeleteModal(false);
                            setEditable(false);
                            setExpandedField(null);
                          } else {
                            const errMsg =
                              typeof respObj["error"] === "string"
                                ? respObj["error"]
                                : undefined;
                            throw new Error(errMsg ?? "Delete failed");
                          }
                        } catch (err) {
                          console.error("Error deleting case:", err);
                          alert(
                            "Error deleting case. See console for details."
                          );
                        } finally {
                          setIsDeleting(false);
                        }
                      }}
                      disabled={isDeleting}
                    >
                      {isDeleting ? "Deleting..." : "Delete Case"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
