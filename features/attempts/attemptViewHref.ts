export type AttemptViewFrom = "attempts" | "session" | "case" | "student";

export function parseAttemptViewFrom(value: string | null | undefined): AttemptViewFrom {
  if (value === "session" || value === "case" || value === "student") return value;
  return "attempts";
}

export function attemptViewHref(attemptId: string, from?: AttemptViewFrom) {
  const path = `/attempts/${encodeURIComponent(attemptId)}`;
  if (!from || from === "attempts") return path;
  return `${path}?from=${from}`;
}
