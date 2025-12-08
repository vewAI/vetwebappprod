export type UserRole = "admin" | "professor" | "student";

const ROLE_ALIASES: Record<string, UserRole> = {
  admin: "admin",
  administrator: "admin",
  moderator: "admin",
  professor: "professor",
  faculty: "professor",
  instructor: "professor",
  student: "student",
  learner: "student",
  trainee: "student",
  user: "student",
};

/**
 * Normalizes a raw role value coming from Supabase profiles or metadata into
 * one of the supported {@link UserRole} identifiers. Returns null when the
 * input cannot be mapped to a known role.
 */
export function ensureUserRole(rawRole: unknown): UserRole | null {
  if (typeof rawRole !== "string") {
    return null;
  }

  const normalized = rawRole.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return ROLE_ALIASES[normalized] ?? null;
}
