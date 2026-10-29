const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function getCaseCreatorUserId(settings: unknown): string | null {
  const value = asRecord(settings).createdByUserId;
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
}

export function prepareCaseSettings(
  incoming: unknown,
  existing: unknown,
  creatorUserId: string,
  isNewCase: boolean,
): Record<string, unknown> {
  const merged = { ...asRecord(existing), ...asRecord(incoming) };
  delete merged.createdByUserId;

  const recordedCreator = getCaseCreatorUserId(existing);
  if (recordedCreator) {
    merged.createdByUserId = recordedCreator;
  } else if (isNewCase && UUID_PATTERN.test(creatorUserId)) {
    merged.createdByUserId = creatorUserId;
  }
  return merged;
}
