export type CaseMediaType = "image" | "video" | "audio" | "document";

export type CaseMediaStageRef = {
  stageId?: string;
  stageKey?: string;
  roleKey?: string;
};

export interface CaseMediaItem {
  id: string;
  type: CaseMediaType;
  url: string;
  caption?: string;
  transcript?: string;
  stage?: CaseMediaStageRef;
  mimeType?: string;
  durationMs?: number;
  thumbnailUrl?: string;
  loop?: boolean;
  metadata?: Record<string, unknown> | null;
}

export function isCaseMediaItem(value: unknown): value is CaseMediaItem {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Partial<CaseMediaItem>;
  if (typeof item.id !== "string" || !item.id.trim()) {
    return false;
  }
  if (typeof item.type !== "string") {
    return false;
  }
  if (typeof item.url !== "string" || !item.url.trim()) {
    return false;
  }
  return true;
}

function coerceJsonRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return { ...(value as Record<string, unknown>) };
}

function normalizeStageRef(value: unknown): CaseMediaStageRef | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const stageId = typeof record.stageId === "string" ? record.stageId.trim() : undefined;
  const stageKey = typeof record.stageKey === "string" ? record.stageKey.trim() : undefined;
  const roleKey = typeof record.roleKey === "string" ? record.roleKey.trim() : undefined;
  if (!stageId && !stageKey && !roleKey) {
    return undefined;
  }
  return { stageId, stageKey, roleKey };
}

export function normalizeCaseMedia(input: unknown): CaseMediaItem[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input
    .map((value) => {
      if (!isCaseMediaItem(value)) {
        return null;
      }
      const loop = typeof value.loop === "boolean" ? value.loop : undefined;
      const durationMs =
        typeof value.durationMs === "number" && Number.isFinite(value.durationMs)
          ? value.durationMs
          : undefined;

      const item: CaseMediaItem = {
        id: value.id.trim(),
        type: value.type,
        url: value.url.trim(),
      };

      if (typeof value.caption === "string" && value.caption.trim().length) {
        item.caption = value.caption.trim();
      }
      if (
        typeof value.transcript === "string" &&
        value.transcript.trim().length
      ) {
        item.transcript = value.transcript.trim();
      }
      const stageRef = normalizeStageRef(value.stage);
      if (stageRef) {
        item.stage = stageRef;
      }
      if (
        typeof value.mimeType === "string" &&
        value.mimeType.trim().length
      ) {
        item.mimeType = value.mimeType.trim();
      }
      if (durationMs !== undefined) {
        item.durationMs = durationMs;
      }
      if (
        typeof value.thumbnailUrl === "string" &&
        value.thumbnailUrl.trim().length
      ) {
        item.thumbnailUrl = value.thumbnailUrl.trim();
      }
      if (loop !== undefined) {
        item.loop = loop;
      }
      const metadata = coerceJsonRecord(value.metadata);
      item.metadata = metadata;
      return item;
    })
    .filter((value): value is CaseMediaItem => value !== null);
}
