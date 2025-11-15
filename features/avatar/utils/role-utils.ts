export function normalizeRoleKey(raw?: string | null): string | null {
  if (!raw) return null;
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}
