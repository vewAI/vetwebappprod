import type { BreadcrumbItem } from "@/features/navigation/models/breadcrumb";
import { professorCaseHref } from "@/features/case-selection/caseViewHref";

export type SessionViewFrom = "sessions" | "case";

export function parseSessionViewFrom(value: string | null | undefined): SessionViewFrom {
  return value === "case" ? "case" : "sessions";
}

export function professorSessionHref(sessionId: string, from?: SessionViewFrom) {
  const path = `/professor/sessions/${encodeURIComponent(sessionId)}`;
  if (from === "case") return `${path}?from=case`;
  return path;
}

export function professorSessionBreadcrumbItems({
  from,
  currentLabel,
  caseTitle,
  caseId,
}: {
  from: SessionViewFrom;
  currentLabel: string;
  caseTitle?: string | null;
  caseId?: string | null;
}): BreadcrumbItem[] {
  const current = { label: currentLabel };

  if (from === "case") {
    return [
      { label: "Home", href: "/dashboard" },
      { label: "Cases", href: "/cases" },
      {
        label: caseTitle || "Case",
        href: caseId ? professorCaseHref(caseId) : undefined,
      },
      current,
    ];
  }

  return [
    { label: "Home", href: "/dashboard" },
    { label: "Case Sessions", href: "/professor/sessions" },
    current,
  ];
}
