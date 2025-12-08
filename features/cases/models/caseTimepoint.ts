export type CaseTimepointRole = "owner" | "nurse";

export interface CaseTimepoint {
  id: string;
  caseId: string;
  sequence: number;
  label: string;
  summary?: string | null;
  personaRole: CaseTimepointRole;
  stagePrompt?: string | null;
  availableAfterHours?: number | null;
  afterStageId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface CaseTimepointInput {
  id?: string;
  sequence?: number;
  label: string;
  summary?: string | null;
  personaRole: CaseTimepointRole;
  stagePrompt?: string | null;
  availableAfterHours?: number | null;
  afterStageId?: string | null;
}

export function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const coerced = Number(value);
  return Number.isFinite(coerced) ? coerced : null;
}

export function normalizeCaseTimepointsInput(
  raw: unknown
): CaseTimepointInput[] {
  if (raw === null || raw === undefined || raw === "") {
    return [];
  }

  let source: unknown = raw;
  if (typeof raw === "string") {
    try {
      source = JSON.parse(raw);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(source)) {
    return [];
  }

  return source
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const record = item as Record<string, unknown>;
      const label = typeof record.label === "string" ? record.label.trim() : "";
      if (!label) {
        return null;
      }

      const personaRaw =
        record.personaRole ?? record.persona_role ?? record.role ?? "owner";
      const personaRole: CaseTimepointRole =
        personaRaw === "nurse" ? "nurse" : "owner";

      const id =
        typeof record.id === "string" && record.id.trim().length > 0
          ? record.id.trim()
          : undefined;
      const sequenceValue = normalizeNumber(
        record.sequence ?? record.order ?? record.sequence_index
      );
      const summary =
        typeof record.summary === "string"
          ? record.summary
          : record.summary === null
            ? null
            : undefined;
      const stagePrompt =
        typeof record.stagePrompt === "string"
          ? record.stagePrompt
          : typeof record.stage_prompt === "string"
            ? record.stage_prompt
            : record.stage_prompt === null
              ? null
              : record.stagePrompt === null
                ? null
                : undefined;
      const availableAfterHours = normalizeNumber(
        record.availableAfterHours ?? record.available_after_hours
      );
      const afterStageId =
        typeof record.afterStageId === "string"
          ? record.afterStageId
          : typeof record.after_stage_id === "string"
            ? record.after_stage_id
            : null;

      return {
        id,
        sequence:
          sequenceValue !== null && Number.isFinite(sequenceValue)
            ? sequenceValue
            : undefined,
        label,
        summary: summary ?? null,
        personaRole,
        stagePrompt: stagePrompt ?? null,
        availableAfterHours,
        afterStageId,
      } satisfies CaseTimepointInput;
    })
    .filter((value): value is CaseTimepointInput => Boolean(value));
}

export function mapDbTimepoints(rows: unknown): CaseTimepoint[] {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const id = typeof r.id === "string" ? r.id : `tp-${Date.now()}-${Math.random()}`;
      const caseId = typeof r.case_id === "string" ? r.case_id : "";
      const sequence = Number(r.sequence ?? 0);
      const label = typeof r.label === "string" ? r.label : "Timepoint";
      const personaRole =
        r.persona_role === "nurse" ? "nurse" : ("owner" as CaseTimepointRole);
      return {
        id,
        caseId,
        sequence: Number.isFinite(sequence) ? sequence : 0,
        label,
        summary: typeof r.summary === "string" ? r.summary : null,
        personaRole,
        stagePrompt: typeof r.stage_prompt === "string" ? r.stage_prompt : null,
        availableAfterHours: normalizeNumber(r.available_after_hours),
        afterStageId: typeof r.after_stage_id === "string" ? r.after_stage_id : null,
        createdAt: typeof r.created_at === "string" ? r.created_at : null,
        updatedAt: typeof r.updated_at === "string" ? r.updated_at : null,
      } satisfies CaseTimepoint;
    })
    .filter((value): value is CaseTimepoint => Boolean(value));
}

export function prepareTimepointsForPersistence(
  caseId: string,
  inputs: CaseTimepointInput[]
): Array<Record<string, unknown>> {
  return inputs.map((input, index) => {
    const sequence =
      input.sequence !== undefined && Number.isFinite(Number(input.sequence))
        ? Number(input.sequence)
        : index;
    return {
      id: input.id ?? undefined,
      case_id: caseId,
      sequence,
      label: input.label,
      summary: input.summary ?? null,
      persona_role: input.personaRole,
      stage_prompt: input.stagePrompt ?? null,
      available_after_hours: normalizeNumber(input.availableAfterHours),
      after_stage_id: input.afterStageId ?? null,
    };
  });
}
