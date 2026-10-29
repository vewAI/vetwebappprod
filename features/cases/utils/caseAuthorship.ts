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

function explicitSourceValue(details: unknown, label: "Author" | "Institution"): string {
  if (typeof details !== "string") return "";
  const header = details.slice(0, 6000);
  const pattern = new RegExp(`(?:^|\\n)\\s*${label}\\s*(?::|\\t|\\|)\\s*([^\\n|]{2,160})`, "i");
  let line = header.match(pattern)?.[1]?.trim() ?? "";
  if (!line) {
    const lines = header.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    const tableStart = lines.findIndex((value, index) =>
      value === "Author" && lines.slice(index + 1, index + 5).some((next) => /^Date\s*\/\s*version$/i.test(next))
    );
    if (tableStart !== -1) {
      const headings = ["Author"];
      let valueIndex = tableStart + 1;
      while (valueIndex < lines.length && /^(?:Institution|Date\s*\/\s*version|Clinical reviewer)$/i.test(lines[valueIndex])) {
        headings.push(lines[valueIndex]);
        valueIndex += 1;
      }
      const columnIndex = headings.findIndex((heading) => heading.toLowerCase() === label.toLowerCase());
      if (columnIndex !== -1) line = lines[valueIndex + columnIndex] ?? "";
    }
  }
  if (!line || /^\[(?:enter|insert|author|institution)/i.test(line) || /^(?:n\/a|unknown|pending)$/i.test(line)) return "";
  return line;
}

export function getCaseAuthorDetails(settings: unknown, details?: unknown): { authorName: string; institutionName: string } {
  const record = asRecord(settings);
  const authorName = typeof record.authorName === "string" ? record.authorName.trim() : "";
  const institutionName = typeof record.institutionName === "string" ? record.institutionName.trim() : "";
  const sectionCredit = typeof details === "string"
    ? details.slice(0, 6000).match(/^1\.1\s+Author name and institution\s*\r?\n+\s*([^\r\n]+)/im)?.[1]?.trim() ?? ""
    : "";
  const [sectionAuthor = "", sectionInstitution = ""] = sectionCredit.split(/\s*;\s*/, 2);
  const validCredit = (value: string) => value && !/^\[(?:enter|insert)/i.test(value) ? value : "";
  return {
    authorName: authorName || explicitSourceValue(details, "Author") || validCredit(sectionAuthor),
    institutionName: institutionName || explicitSourceValue(details, "Institution") || validCredit(sectionInstitution),
  };
}

export function moveCaseAuthorFields(body: Record<string, unknown>): Record<string, unknown> {
  const next = { ...body };
  const settings = { ...asRecord(next.settings) };
  for (const [field, setting] of [["author_name", "authorName"], ["author_institution", "institutionName"]] as const) {
    if (Object.prototype.hasOwnProperty.call(next, field)) {
      settings[setting] = typeof next[field] === "string" ? next[field].trim() : "";
      delete next[field];
    }
  }
  if (Object.keys(settings).length > 0) next.settings = settings;
  return next;
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
