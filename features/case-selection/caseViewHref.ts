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
  params?: { attempt?: string | null; session?: string | null; test?: boolean },
) {
  const path = `/live/${encodeURIComponent(caseId)}`;
  const search = new URLSearchParams();
  if (params?.attempt) search.set("attempt", params.attempt);
  if (params?.session) search.set("session", params.session);
  if (params?.test) search.set("test", "1");
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}
