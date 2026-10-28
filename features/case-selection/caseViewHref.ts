export function professorCaseHref(caseId: string) {
  return `/cases/${encodeURIComponent(caseId)}`;
}

export function studentCaseHref(caseId: string) {
  return `/start/case/${encodeURIComponent(caseId)}`;
}

export function caseHref(caseId: string, isStaff: boolean) {
  return isStaff ? professorCaseHref(caseId) : studentCaseHref(caseId);
}

export function caseAttemptHref(
  caseId: string,
  params?: { attempt?: string | null; session?: string | null },
) {
  const path = `${studentCaseHref(caseId)}/attempt`;
  const search = new URLSearchParams();
  if (params?.attempt) search.set("attempt", params.attempt);
  if (params?.session) search.set("session", params.session);
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}
