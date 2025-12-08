"use client";

import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/services/authService";
import {
  ROLE_PROMPT_DEFINITIONS,
  type RolePromptKey,
} from "@/features/role-info/services/roleInfoService";
import type { PromptRecord } from "@/features/prompts/types";
import {
  CHAT_SYSTEM_GUIDELINE_PROMPT_ID,
  PERSONA_TEMPLATE_OWNER_BEHAVIOR_PROMPT_ID,
  findStagePromptConfig,
} from "@/features/prompts/defaults/personaPrompts";
import { canonicalizePersonaRole, isHiddenSharedPersona } from "@/features/personas/utils/roleMapping";

const ROLE_OPTIONS: { label: string; value: string }[] = [
  { label: "Owner", value: "owner" },
  { label: "Nurse", value: "nurse" },
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

type RolePromptField = {
  key: RolePromptKey;
  label: string;
  description: string;
  placeholders: string[];
  defaultTemplate: string;
};

const ROLE_PROMPT_FIELDS: Record<string, RolePromptField[]> = {
  owner: [
    {
      key: "getOwnerPrompt",
      label: "History stage prompt template",
      description: "Guides how the owner persona opens and responds during history-taking. Leave blank to use the default template.",
      placeholders: ["{{PRESENTING_COMPLAINT}}", "{{OWNER_BACKGROUND}}", "{{STUDENT_QUESTION}}"],
      defaultTemplate: ROLE_PROMPT_DEFINITIONS.getOwnerPrompt.defaultTemplate,
    },
    {
      key: "getOwnerFollowUpPrompt",
      label: "Follow-up discussion prompt template",
      description: "Used when the owner discusses diagnostics or planning after the exam. Leave blank for default behaviour.",
      placeholders: ["{{FOLLOW_UP_GUIDANCE}}", "{{STUDENT_QUESTION}}"],
      defaultTemplate: ROLE_PROMPT_DEFINITIONS.getOwnerFollowUpPrompt.defaultTemplate,
    },
    {
      key: "getOwnerDiagnosisPrompt",
      label: "Diagnosis delivery prompt template",
      description: "Controls how the owner reacts when hearing the diagnosis and plan.",
      placeholders: ["{{CASE_TITLE}}", "{{OWNER_DIAGNOSIS}}", "{{STUDENT_QUESTION}}"],
      defaultTemplate: ROLE_PROMPT_DEFINITIONS.getOwnerDiagnosisPrompt.defaultTemplate,
    },
  ],
  nurse: [
    {
      key: "getPhysicalExamPrompt",
      label: "Physical/diagnostic response prompt template",
      description: "Controls how the nurse relays recorded exam findings or diagnostic results.",
      placeholders: ["{{FINDINGS}}", "{{STUDENT_REQUEST}}"],
      defaultTemplate: ROLE_PROMPT_DEFINITIONS.getPhysicalExamPrompt.defaultTemplate,
    },
    {
      key: "getDiagnosticPrompt",
      label: "Diagnostic results prompt template",
      description: "Guides how the nurse reports diagnostic data back to the student.",
      placeholders: ["{{DIAGNOSTIC_RESULTS}}", "{{STUDENT_REQUEST}}"],
      defaultTemplate: ROLE_PROMPT_DEFINITIONS.getDiagnosticPrompt.defaultTemplate,
    },
  ],
};

function cloneRecord<T extends Record<string, unknown>>(value: T | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return { ...value } as T;
  }
}

function extractRolePrompts(metadata: unknown): Record<string, string> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  const record = metadata as Record<string, unknown>;
  const sourceCandidates = [record.rolePrompts, record.role_prompts];
  const source = sourceCandidates.find(
    (candidate): candidate is Record<string, unknown> =>
      candidate !== null && typeof candidate === "object" && !Array.isArray(candidate)
  );
  if (!source) return {};
  const prompts: Record<string, string> = {};
  Object.entries(source).forEach(([key, value]) => {
    if (typeof value === "string") {
      prompts[key] = value;
    }
  });
  return prompts;
}

function extractPersonality(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return "";
  }
  const record = metadata as Record<string, unknown>;
  const value = record.personality;
  return typeof value === "string" ? value : "";
}

function mergeRolePrompts(
  baseMetadata: Record<string, unknown> | null,
  prompts: Record<string, string>
): Record<string, unknown> | null {
  const cleanedEntries = Object.entries(prompts).filter(([, value]) => value.trim().length > 0);
  const cleaned: Record<string, string> = Object.fromEntries(cleanedEntries);

  const hasPrompts = Object.keys(cleaned).length > 0;
  const next = cloneRecord(baseMetadata) ?? {};
  if (hasPrompts) {
    next.rolePrompts = cleaned;
    next.role_prompts = cleaned;
  } else {
    if ("rolePrompts" in next) delete next.rolePrompts;
    if ("role_prompts" in next) delete (next as Record<string, unknown>).role_prompts;
  }
  return Object.keys(next).length ? next : null;
}

function areRolePromptMapsEqual(
  a: Record<string, string>,
  b: Record<string, string>
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if ((a[key] ?? "") !== (b[key] ?? "")) {
      return false;
    }
  }
  return true;
}

function formatIso(iso?: string | null): string {
  if (!iso) return "";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleString();
}

const GLOBAL_PROMPT_COPY: Record<
  string,
  { title: string; description: string; helper?: string }
> = {
  [CHAT_SYSTEM_GUIDELINE_PROMPT_ID]: {
    title: "Universal chat system guideline",
    description:
      "Inserted at the top of every conversation before any persona-specific instructions.",
    helper:
      "Keep directives concise and focused on tone and guardrails that should apply across all personas and cases.",
  },
  [PERSONA_TEMPLATE_OWNER_BEHAVIOR_PROMPT_ID]: {
    title: "Persona seeding template · Owner narrative",
    description:
      "Defines how owner personas are generated whenever a case owner record is created or refreshed.",
    helper:
      "Supports tokens like {{FULL_NAME}} and {{PATIENT_NAME}}. Updates immediately affect newly seeded owner personas.",
  },
};

function createPromptEditorState(record: PromptRecord): PromptEditorState {
  return {
    record,
    draftValue: record.value ?? "",
    isDirty: false,
    saving: false,
    message: null,
    error: null,
  };
}

function parseStageIndexFromPromptId(id: string): number | null {
  const match = id.match(/\.transition\.(\d+)$/);
  if (!match) return null;
  const value = Number.parseInt(match[1], 10);
  return Number.isNaN(value) ? null : value;
}

function buildStagePromptDescription(record: PromptRecord): string {
  if (!record.caseId) {
    return record.description;
  }
  const stageIndex = parseStageIndexFromPromptId(record.id);
  const config =
    typeof stageIndex === "number"
      ? findStagePromptConfig(record.caseId, stageIndex)
      : undefined;
  const pieces: string[] = [];
  if (typeof stageIndex === "number") {
    pieces.push(
      `Broadcast when stage ${stageIndex + 1} begins for ${record.caseId}.`
    );
  }
  if (config?.role) {
    const personaRole = config.role === "owner" ? "owner persona" : "nurse persona";
    pieces.push(`Shapes the ${personaRole}'s tone for the opening of this stage.`);
  } else {
    pieces.push("Shapes the persona tone as the stage opens.");
  }
  if (record.description) {
    pieces.push(record.description);
  }
  return pieces.join(" ").trim();
}

function formatPromptStatus(record: PromptRecord): string {
  return record.hasOverride ? "Override active" : "Using default";
}

type PersonaEditorState = {
  scope: PersonaScope;
  persona: PersonaRecord;
  draftBehaviorPrompt: string;
  draftPrompt: string;
  draftDisplayName: string;
  draftImageUrl: string;
  draftPersonality: string;
  draftMetadata: Record<string, unknown> | null;
  draftRolePrompts: Record<string, string>;
  isDirty: boolean;
  saving: boolean;
  saveMessage?: string | null;
  error?: string | null;
  autoMessage?: string | null;
  autoError?: string | null;
  autoLoading?: boolean;
  autoPreview?: string | null;
  autoPreviewError?: string | null;
  autoPreviewLoading?: boolean;
  autoPreviewOpen?: boolean;
  rolePromptLoading: Record<string, boolean>;
  rolePromptErrors: Record<string, string | null>;
};

type PromptEditorState = {
  record: PromptRecord;
  draftValue: string;
  isDirty: boolean;
  saving: boolean;
  message?: string | null;
  error?: string | null;
};

function computePersonaDirty(state: PersonaEditorState): boolean {
  const baseBehavior = state.persona.behavior_prompt ?? "";
  const baseDisplay = state.persona.display_name ?? "";
  const baseImage = state.persona.image_url ?? "";
  const basePrompt = state.persona.prompt ?? "";
  const basePersonality = extractPersonality(state.persona.metadata ?? null);
  const originalRolePrompts = extractRolePrompts(state.persona.metadata ?? null);
  const hasRolePromptChange = !areRolePromptMapsEqual(
    state.draftRolePrompts,
    originalRolePrompts
  );

  return (
    state.draftBehaviorPrompt !== baseBehavior ||
    state.draftDisplayName !== baseDisplay ||
    state.draftImageUrl !== baseImage ||
    state.draftPrompt !== basePrompt ||
    state.draftPersonality.trim() !== basePersonality.trim() ||
    hasRolePromptChange
  );
}

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

  const [globalPromptRows, setGlobalPromptRows] = useState<PromptEditorState[]>([]);
  const [globalPromptLoading, setGlobalPromptLoading] = useState(false);
  const [globalPromptError, setGlobalPromptError] = useState<string | null>(null);

  const [casePromptRows, setCasePromptRows] = useState<PromptEditorState[]>([]);
  const [casePromptLoading, setCasePromptLoading] = useState(false);
  const [casePromptError, setCasePromptError] = useState<string | null>(null);

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
      setGlobalPromptRows([]);
      setGlobalPromptError(null);
      return;
    }

    let cancelled = false;

    async function loadGlobalPrompts() {
      setGlobalPromptLoading(true);
      setGlobalPromptError(null);
      try {
        const response = await axios.get("/api/prompts", {
          headers: authHeaders,
        });
        const payload = response.data as { prompts?: PromptRecord[] } | undefined;
        const prompts = Array.isArray(payload?.prompts)
          ? (payload?.prompts as PromptRecord[])
          : [];
        const filtered = prompts.filter((record) =>
          record.id === CHAT_SYSTEM_GUIDELINE_PROMPT_ID ||
          record.id === PERSONA_TEMPLATE_OWNER_BEHAVIOR_PROMPT_ID
        );
        if (!cancelled) {
          setGlobalPromptRows(filtered.map(createPromptEditorState));
        }
      } catch (error) {
        if (!cancelled) {
          const message = extractAxiosMessage(error) ?? "Failed to load global prompts";
          setGlobalPromptError(message);
        }
      } finally {
        if (!cancelled) {
          setGlobalPromptLoading(false);
        }
      }
    }

    void loadGlobalPrompts();

    return () => {
      cancelled = true;
    };
  }, [authHeaders]);

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

        const visibleRows = rows.filter((persona) =>
          !isHiddenSharedPersona(persona.role_key, persona.display_name)
        );

        const editorRows: PersonaEditorState[] = visibleRows.map((persona): PersonaEditorState => {
          const metadataClone = cloneRecord(
            (persona.metadata && typeof persona.metadata === "object" && !Array.isArray(persona.metadata)
              ? (persona.metadata as Record<string, unknown>)
              : null)
          );
          const rolePrompts = extractRolePrompts(persona.metadata ?? null);
          return {
            scope: "global",
            persona,
            draftBehaviorPrompt: persona.behavior_prompt ?? "",
            draftPrompt: persona.prompt ?? "",
            draftDisplayName: persona.display_name ?? "",
            draftImageUrl: persona.image_url ?? "",
            draftPersonality: extractPersonality(persona.metadata ?? null),
            draftMetadata: metadataClone,
            draftRolePrompts: rolePrompts,
            isDirty: false,
            saving: false,
            saveMessage: null,
            error: null,
            autoMessage: null,
            autoError: null,
            autoLoading: false,
            autoPreview: undefined,
            autoPreviewError: null,
            autoPreviewLoading: false,
            autoPreviewOpen: false,
            rolePromptLoading: {},
            rolePromptErrors: {},
          };
        });

        editorRows.sort((a, b) => {
          const aCanonical = canonicalizePersonaRole(a.persona.role_key, a.persona.display_name) ?? a.persona.role_key;
          const bCanonical = canonicalizePersonaRole(b.persona.role_key, b.persona.display_name) ?? b.persona.role_key;
          const aOrder = ROLE_ORDER.get(aCanonical ?? "") ?? Number.MAX_SAFE_INTEGER;
          const bOrder = ROLE_ORDER.get(bCanonical ?? "") ?? Number.MAX_SAFE_INTEGER;
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
    if (!authHeaders || !selectedCaseId) {
      setCasePromptRows([]);
      setCasePromptError(null);
      return;
    }

    let cancelled = false;

    async function loadCasePrompts() {
      setCasePromptLoading(true);
      setCasePromptError(null);
      try {
        const response = await axios.get("/api/prompts", {
          headers: authHeaders,
          params: { caseId: selectedCaseId, scope: "case" },
        });
        const payload = response.data as { prompts?: PromptRecord[] } | undefined;
        const prompts = Array.isArray(payload?.prompts)
          ? (payload?.prompts as PromptRecord[])
          : [];
        const filtered = prompts
          .filter((record) => record.scope === "case" && record.caseId === selectedCaseId)
          .sort((a, b) => {
            const aIndex = parseStageIndexFromPromptId(a.id) ?? Number.MAX_SAFE_INTEGER;
            const bIndex = parseStageIndexFromPromptId(b.id) ?? Number.MAX_SAFE_INTEGER;
            if (a.caseId === b.caseId) {
              return aIndex - bIndex;
            }
            return (a.caseId ?? "").localeCompare(b.caseId ?? "");
          });
        if (!cancelled) {
          setCasePromptRows(filtered.map(createPromptEditorState));
        }
      } catch (error) {
        if (!cancelled) {
          const message = extractAxiosMessage(error) ?? "Failed to load stage prompts";
          setCasePromptError(message);
        }
      } finally {
        if (!cancelled) {
          setCasePromptLoading(false);
        }
      }
    }

    void loadCasePrompts();

    return () => {
      cancelled = true;
    };
  }, [authHeaders, selectedCaseId]);

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
        const editableRows = rows.filter(
          (persona) => persona.role_key === "owner" || persona.role_key === "nurse"
        );

        const editorRows: PersonaEditorState[] = editableRows.map((persona): PersonaEditorState => {
          const metadataClone = cloneRecord(
            (persona.metadata && typeof persona.metadata === "object" && !Array.isArray(persona.metadata)
              ? (persona.metadata as Record<string, unknown>)
              : null)
          );
          const rolePrompts = extractRolePrompts(persona.metadata ?? null);
          return {
            scope: "case",
            persona,
            draftBehaviorPrompt: persona.behavior_prompt ?? "",
            draftPrompt: persona.prompt ?? "",
            draftDisplayName: persona.display_name ?? "",
            draftImageUrl: persona.image_url ?? "",
            draftPersonality: extractPersonality(persona.metadata ?? null),
            draftMetadata: metadataClone,
            draftRolePrompts: rolePrompts,
            isDirty: false,
            saving: false,
            saveMessage: null,
            error: null,
            autoMessage: null,
            autoError: null,
            autoLoading: false,
            autoPreview: undefined,
            autoPreviewError: null,
            autoPreviewLoading: false,
            autoPreviewOpen: false,
            rolePromptLoading: {},
            rolePromptErrors: {},
          };
        });

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
    field: "behavior" | "display" | "image" | "prompt" | "personality",
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
      } else if (field === "prompt") {
        next.draftPrompt = value;
      } else if (field === "personality") {
        next.draftPersonality = value;
        const baseMeta = cloneRecord(prev.draftMetadata) ?? {};
        const trimmed = value.trim();
        if (trimmed) {
          baseMeta.personality = trimmed;
        } else {
          delete baseMeta.personality;
        }
        next.draftMetadata = Object.keys(baseMeta).length ? baseMeta : null;
      }
      next.isDirty = computePersonaDirty(next);
      next.saveMessage = null;
      return next;
    });
  };

  const handleRolePromptChange = (
    scope: PersonaScope,
    roleKey: string,
    promptKey: RolePromptKey,
    value: string
  ) => {
    updateDraft(scope, roleKey, (prev) => {
      const next: PersonaEditorState = {
        ...prev,
        draftRolePrompts: { ...prev.draftRolePrompts },
        rolePromptErrors: { ...prev.rolePromptErrors },
      };

      if (value.trim().length > 0) {
        next.draftRolePrompts[promptKey] = value;
        next.rolePromptErrors[promptKey] = null;
      } else {
        delete next.draftRolePrompts[promptKey];
        delete next.rolePromptErrors[promptKey];
      }

      next.draftMetadata = mergeRolePrompts(prev.draftMetadata, next.draftRolePrompts);
      next.isDirty = computePersonaDirty(next);
      next.saveMessage = null;
      return next;
    });
  };

  const handleRolePromptAutofill = async (
    scope: PersonaScope,
    roleKey: string,
    promptKey: RolePromptKey
  ) => {
    if (!authHeaders) return;

    const rows = scope === "global" ? globalPersonaRows : casePersonaRows;
    const target = rows.find((entry) => entry.persona.role_key === roleKey);
    const effectiveCaseId =
      scope === "case"
        ? selectedCaseId || target?.persona.case_id || null
        : null;

    if (scope === "case" && !effectiveCaseId) {
      updateDraft(scope, roleKey, (prev) => ({
        ...prev,
        rolePromptLoading: { ...prev.rolePromptLoading, [promptKey]: false },
        rolePromptErrors: {
          ...prev.rolePromptErrors,
          [promptKey]: "Select a case first",
        },
      }));
      return;
    }

    updateDraft(scope, roleKey, (prev) => ({
      ...prev,
      rolePromptLoading: { ...prev.rolePromptLoading, [promptKey]: true },
      rolePromptErrors: { ...prev.rolePromptErrors, [promptKey]: null },
    }));

    try {
      const requestBody: Record<string, unknown> = {
        roleKey,
        promptKey,
      };
      if (effectiveCaseId) {
        requestBody.caseId = effectiveCaseId;
      }

      const response = await axios.post(
        "/api/personas/role-prompts",
        requestBody,
        { headers: authHeaders }
      );

      const payload = response.data as { prompt?: string } | undefined;
      const generatedPrompt = payload?.prompt;
      if (!generatedPrompt || !generatedPrompt.trim()) {
        throw new Error("No prompt returned");
      }

      updateDraft(scope, roleKey, (prev) => {
        const nextPrompts = { ...prev.draftRolePrompts, [promptKey]: generatedPrompt };
        const nextState: PersonaEditorState = {
          ...prev,
          draftRolePrompts: nextPrompts,
          rolePromptLoading: { ...prev.rolePromptLoading, [promptKey]: false },
          rolePromptErrors: { ...prev.rolePromptErrors, [promptKey]: null },
          saveMessage: null,
        };
        nextState.draftMetadata = mergeRolePrompts(prev.draftMetadata, nextPrompts);
        nextState.isDirty = computePersonaDirty(nextState);
        return nextState;
      });
    } catch (error) {
      const message = extractAxiosMessage(error) ?? "Failed to generate prompt";
      updateDraft(scope, roleKey, (prev) => ({
        ...prev,
        rolePromptLoading: { ...prev.rolePromptLoading, [promptKey]: false },
        rolePromptErrors: { ...prev.rolePromptErrors, [promptKey]: message },
      }));
    }
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
            prompt: target.draftPrompt || null,
            metadata: target.draftMetadata ?? null,
          },
          { headers: authHeaders }
        );
        const payload = response.data as { persona?: PersonaRecord } | undefined;
        const updated = payload?.persona;
        if (updated) {
          updateDraft(scope, roleKey, (prev) => {
            const metadataClone = cloneRecord(
              updated.metadata && typeof updated.metadata === "object" && !Array.isArray(updated.metadata)
                ? (updated.metadata as Record<string, unknown>)
                : null
            );
            const nextState: PersonaEditorState = {
              ...prev,
              persona: updated,
              draftBehaviorPrompt: updated.behavior_prompt ?? "",
              draftPrompt: updated.prompt ?? "",
              draftDisplayName: updated.display_name ?? "",
              draftImageUrl: updated.image_url ?? "",
              draftPersonality: extractPersonality(updated.metadata ?? null),
              draftMetadata: metadataClone,
              draftRolePrompts: extractRolePrompts(updated.metadata ?? null),
              saving: false,
              saveMessage: "Persona updated",
            };
            nextState.isDirty = computePersonaDirty(nextState);
            return nextState;
          });
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
          prompt: target.draftPrompt || null,
          metadata: target.draftMetadata ?? null,
        },
        { headers: authHeaders }
      );
      const payload = response.data as { persona?: PersonaRecord } | undefined;
      const updated = payload?.persona;
      if (updated) {
        updateDraft(scope, roleKey, (prev) => {
          const metadataClone = cloneRecord(
            (updated.metadata && typeof updated.metadata === "object" && !Array.isArray(updated.metadata)
              ? (updated.metadata as Record<string, unknown>)
              : null)
          );
          const nextState: PersonaEditorState = {
            ...prev,
            persona: updated,
            draftBehaviorPrompt: updated.behavior_prompt ?? "",
            draftPrompt: updated.prompt ?? "",
            draftDisplayName: updated.display_name ?? "",
            draftImageUrl: updated.image_url ?? "",
            draftPersonality: extractPersonality(updated.metadata ?? null),
            draftMetadata: metadataClone,
            draftRolePrompts: extractRolePrompts(updated.metadata ?? null),
            saving: false,
            saveMessage: "Persona updated",
          };
          nextState.isDirty = computePersonaDirty(nextState);
          return nextState;
        });
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

  const fetchAutoBehaviorPreview = async (scope: PersonaScope, roleKey: string) => {
    if (!authHeaders) return;

    if (scope === "case" && !selectedCaseId) {
      updateDraft(scope, roleKey, (prev) => ({
        ...prev,
        autoPreviewLoading: false,
        autoPreviewError: "Select a case first",
      }));
      return;
    }

    updateDraft(scope, roleKey, (prev) => ({
      ...prev,
      autoPreviewLoading: true,
      autoPreviewError: null,
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
        | { persona?: { behavior_prompt?: string | null } }
        | undefined;
      const behavior = payload?.persona?.behavior_prompt ?? null;

      updateDraft(scope, roleKey, (prev) => ({
        ...prev,
        autoPreviewLoading: false,
        autoPreviewError: behavior ? null : "No behavior prompt returned",
        autoPreview: behavior ?? prev.autoPreview ?? null,
      }));
    } catch (error) {
      const message =
        extractAxiosMessage(error) ?? "Failed to load auto behavior prompt";
      updateDraft(scope, roleKey, (prev) => ({
        ...prev,
        autoPreviewLoading: false,
        autoPreviewError: message,
      }));
    }
  };

  const toggleAutoBehaviorPreview = (scope: PersonaScope, roleKey: string) => {
    const rows = scope === "global" ? globalPersonaRows : casePersonaRows;
    const target = rows.find((entry) => entry.persona.role_key === roleKey);
    if (!target) return;

    if (target.autoPreviewOpen) {
      updateDraft(scope, roleKey, (prev) => ({
        ...prev,
        autoPreviewOpen: false,
      }));
      return;
    }

    if (scope === "case" && !selectedCaseId) {
      updateDraft(scope, roleKey, (prev) => ({
        ...prev,
        autoPreviewOpen: true,
        autoPreviewError: "Select a case first",
        autoPreviewLoading: false,
      }));
      return;
    }

    const shouldFetch =
      typeof target.autoPreview === "undefined" || Boolean(target.autoPreviewError);

    updateDraft(scope, roleKey, (prev) => ({
      ...prev,
      autoPreviewOpen: true,
      autoPreviewError: shouldFetch ? null : prev.autoPreviewError,
    }));

    if (shouldFetch) {
      void fetchAutoBehaviorPreview(scope, roleKey);
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
              prompt?: string | null;
            };
          }
        | undefined;
      const behavior = payload?.persona?.behavior_prompt ?? null;
      const display = payload?.persona?.display_name ?? null;
      const prompt = payload?.persona?.prompt ?? null;

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
        draftPrompt: prompt ?? prev.draftPrompt,
        draftDisplayName: display ?? prev.draftDisplayName,
        isDirty: true,
        autoLoading: false,
        autoMessage: "Behavior prompt refreshed",
        autoPreview: behavior ?? prev.autoPreview ?? null,
        autoPreviewError: null,
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
    const rolePromptFields =
      ROLE_PROMPT_FIELDS[row.persona.role_key as keyof typeof ROLE_PROMPT_FIELDS] || [];

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
            <div className="relative flex items-center gap-1">
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
                variant="ghost"
                size="icon"
                aria-label="Show auto behavior template"
                title="Show auto behavior template"
                onClick={() => toggleAutoBehaviorPreview(scope, row.persona.role_key)}
              >
                ?
              </Button>
              {row.autoPreviewOpen ? (
                <div className="absolute right-0 top-full z-20 mt-2 w-80 rounded-md border bg-card p-3 text-xs text-foreground shadow-lg">
                  {row.autoPreviewLoading ? (
                    <p>Loading template…</p>
                  ) : row.autoPreviewError ? (
                    <p className="text-red-600">{row.autoPreviewError}</p>
                  ) : row.autoPreview ? (
                    <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap text-xs">
                      {row.autoPreview}
                    </pre>
                  ) : (
                    <p>No behavior prompt available.</p>
                  )}
                </div>
              ) : null}
            </div>
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
          <Label htmlFor={`personality-${scope}-${row.persona.role_key}`}>
            Personality spotlight
          </Label>
          <Textarea
            id={`personality-${scope}-${row.persona.role_key}`}
            rows={3}
            placeholder="Short phrase that captures this persona's tone and priorities"
            value={row.draftPersonality}
            onChange={(event) =>
              handleInputChange(
                scope,
                row.persona.role_key,
                "personality",
                event.target.value
              )
            }
          />
          <p className="text-xs text-muted-foreground">
            Appears in admin tooling and seeds behavior instructions. Keep it concise (1-2 sentences).
          </p>
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

        {rolePromptFields.length ? (
          <div className="mt-6 space-y-4">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">Conversation prompt overrides</h3>
              <p className="text-xs text-muted-foreground">
                Override the default conversation templates for this persona. Leave any field blank to fall back to the shared template.
              </p>
            </div>
            {rolePromptFields.map((field) => {
              const inputId = `role-prompt-${field.key}-${scope}-${row.persona.role_key}`;
              const value = row.draftRolePrompts[field.key] ?? "";
              const loading = row.rolePromptLoading?.[field.key] ?? false;
              const fieldError = row.rolePromptErrors?.[field.key] ?? null;
              return (
                <div key={field.key} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor={inputId}>{field.label}</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={loading}
                      onClick={() =>
                        void handleRolePromptAutofill(
                          scope,
                          row.persona.role_key,
                          field.key
                        )
                      }
                    >
                      {loading ? "Generating…" : "Auto generate"}
                    </Button>
                  </div>
                  <Textarea
                    id={inputId}
                    rows={8}
                    placeholder={field.description}
                    value={value}
                    onChange={(event) =>
                      handleRolePromptChange(
                        scope,
                        row.persona.role_key,
                        field.key,
                        event.target.value
                      )
                    }
                  />
                  <p className="text-xs text-muted-foreground">{field.description}</p>
                  {field.placeholders.length ? (
                    <p className="text-[11px] text-muted-foreground">
                      Available tags: {field.placeholders.join(", ")}
                    </p>
                  ) : null}
                  <div className="rounded-md border bg-muted/30 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Default template
                    </p>
                    <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap text-xs">
                      {field.defaultTemplate}
                    </pre>
                  </div>
                  {fieldError ? (
                    <p className="text-xs text-red-600">{fieldError}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

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
  const selectedCaseDescriptor = selectedCase?.title && selectedCase.title.trim().length
    ? selectedCase.title
    : selectedCaseId || "the selected case";

  const updatePromptRows = (
    section: "global" | "case",
    updater: (rows: PromptEditorState[]) => PromptEditorState[]
  ) => {
    if (section === "global") {
      setGlobalPromptRows((prev) => updater(prev));
    } else {
      setCasePromptRows((prev) => updater(prev));
    }
  };

  const handlePromptChange = (
    section: "global" | "case",
    id: string,
    value: string
  ) => {
    updatePromptRows(section, (rows) =>
      rows.map((row) =>
        row.record.id === id
          ? {
              ...row,
              draftValue: value,
              isDirty: value !== row.record.value,
              message: null,
              error: null,
            }
          : row
      )
    );
  };

  const handlePromptReset = (section: "global" | "case", id: string) => {
    updatePromptRows(section, (rows) =>
      rows.map((row) =>
        row.record.id === id
          ? {
              ...row,
              draftValue: row.record.defaultValue,
              isDirty: row.record.defaultValue !== row.record.value,
              message: null,
              error: null,
            }
          : row
      )
    );
  };

  const handlePromptSave = async (section: "global" | "case", id: string) => {
    if (!authHeaders) return;

    const rows = section === "global" ? globalPromptRows : casePromptRows;
    const target = rows.find((row) => row.record.id === id);
    if (!target || target.saving) {
      return;
    }

    const payloadValue = target.draftValue;

    updatePromptRows(section, (prev) =>
      prev.map((row) =>
        row.record.id === id
          ? { ...row, saving: true, message: null, error: null }
          : row
      )
    );

    try {
      const response = await axios.put(
        "/api/prompts",
        { id, value: payloadValue },
        { headers: authHeaders }
      );
      const payload = response.data as { prompt?: PromptRecord | null } | undefined;
      const promptRecord = payload?.prompt ?? null;

      updatePromptRows(section, (prev) =>
        prev.map((row) => {
          if (row.record.id !== id) return row;

          const nextRecord: PromptRecord = promptRecord
            ? promptRecord
            : {
                ...row.record,
                value: payloadValue,
                hasOverride:
                  payloadValue.trim() !== row.record.defaultValue.trim(),
                updatedAt: row.record.updatedAt ?? null,
                updatedBy: row.record.updatedBy ?? null,
              };

          return {
            record: nextRecord,
            draftValue: nextRecord.value ?? "",
            isDirty: false,
            saving: false,
            message: "Saved changes.",
            error: null,
          };
        })
      );
    } catch (error) {
      const message = extractAxiosMessage(error) ?? "Failed to update prompt";
      updatePromptRows(section, (prev) =>
        prev.map((row) =>
          row.record.id === id
            ? { ...row, saving: false, error: message }
            : row
        )
      );
    }
  };

  const renderPromptCard = (section: "global" | "case") =>
    (row: PromptEditorState) => {
      const { record } = row;
      const copy = section === "global" ? GLOBAL_PROMPT_COPY[record.id] : undefined;
      const primaryDescription =
        section === "global"
          ? copy?.description ?? record.description
          : buildStagePromptDescription(record);
      const helperText = section === "global" ? copy?.helper ?? null : null;
      const safeId = record.id.replace(/[^a-zA-Z0-9_-]/g, "-");
      const inputId = `${section}-prompt-${safeId}`;
      const descriptionId = `${inputId}-description`;
      const title = copy?.title ?? record.label;
      const status = formatPromptStatus(record);
      const updatedLine = record.updatedAt
        ? record.updatedBy
          ? `Last updated ${formatIso(record.updatedAt)} by ${record.updatedBy}`
          : `Last updated ${formatIso(record.updatedAt)}`
        : record.hasOverride
        ? "Override saved"
        : "No override saved yet";
      const resetDisabled = row.draftValue === record.defaultValue;
      return (
        <div key={record.id} className="rounded border p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold" id={`${inputId}-title`}>
              {title}
            </h3>
            <Badge variant={record.hasOverride ? "default" : "outline"}>
              {status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground" id={descriptionId}>
            {primaryDescription}
          </p>
          {helperText ? (
            <p className="text-[11px] text-muted-foreground">{helperText}</p>
          ) : null}
          <Textarea
            id={inputId}
            aria-labelledby={`${inputId}-title`}
            aria-describedby={descriptionId}
            rows={section === "global" ? 10 : 6}
            value={row.draftValue}
            onChange={(event) =>
              handlePromptChange(section, record.id, event.target.value)
            }
            className="font-mono"
          />
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span>{updatedLine}</span>
            <span>• Scope: {record.scope}</span>
            {record.category ? <span>• Category: {record.category}</span> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => void handlePromptSave(section, record.id)}
              disabled={!row.isDirty || row.saving}
            >
              {row.saving ? "Saving…" : "Save changes"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => handlePromptReset(section, record.id)}
              disabled={row.saving || resetDisabled}
            >
              Reset to default
            </Button>
          </div>
          {row.message ? (
            <p className="text-xs text-green-600">{row.message}</p>
          ) : null}
          {row.error ? (
            <p className="text-xs text-red-600">{row.error}</p>
          ) : null}
          <details className="rounded border bg-muted/30 p-3 text-xs">
            <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Default content
            </summary>
            <pre className="mt-2 whitespace-pre-wrap">{record.defaultValue}</pre>
          </details>
        </div>
      );
    };

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Persona Management</h1>
          <p className="text-sm text-muted-foreground">
            Update persona display names, behavior prompts, portrait URLs, and conversation templates.
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
          <h2 className="text-xl font-semibold">Global Conversation Prompts</h2>
          <p className="text-sm text-muted-foreground">
            Adjust the system-wide instructions and persona seeding templates that every conversation follows.
          </p>
        </div>
        {globalPromptLoading ? (
          <p className="text-center">Loading global prompts…</p>
        ) : globalPromptError ? (
          <p className="text-center text-red-600">{globalPromptError}</p>
        ) : !globalPromptRows.length ? (
          <p className="text-center text-muted-foreground">
            No editable global prompts were found.
          </p>
        ) : (
          <div className="grid gap-4">
            {globalPromptRows.map(renderPromptCard("global"))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Stage Transition Directives</h2>
          <p className="text-sm text-muted-foreground">
            Update the role reminders delivered when each stage begins for {selectedCaseDescriptor}. Changes apply immediately to live chat sessions.
          </p>
        </div>
        {casePromptLoading ? (
          <p className="text-center">Loading stage directives…</p>
        ) : casePromptError ? (
          <p className="text-center text-red-600">{casePromptError}</p>
        ) : !casePromptRows.length ? (
          <p className="text-center text-muted-foreground">
            {selectedCaseId
              ? "No stage directives available for this case yet."
              : "Select a case to review stage directives."}
          </p>
        ) : (
          <div className="grid gap-4">
            {casePromptRows.map(renderPromptCard("case"))}
          </div>
        )}
      </section>

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
