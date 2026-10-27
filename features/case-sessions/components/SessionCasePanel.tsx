"use client";

import { CaseCard } from "@/features/case-selection/components/case-card";
import type { Case } from "@/features/case-selection/models/case";
import type { CaseSession } from "../models/caseSession";

type Props = {
  session: CaseSession;
  href?: string;
  titleClassName?: string;
};

function toCaseItem(session: CaseSession): Case | null {
  const caseInfo = session.case;
  if (!caseInfo) return null;
  const difficulty =
    caseInfo.difficulty === "Hard" || caseInfo.difficulty === "Medium" || caseInfo.difficulty === "Easy"
      ? caseInfo.difficulty
      : "Easy";
  return {
    id: caseInfo.id || session.caseId,
    title: caseInfo.title,
    description: caseInfo.description,
    species: caseInfo.species,
    condition: "",
    category: caseInfo.category,
    difficulty,
    estimatedTime: 0,
    imageUrl: caseInfo.imageUrl,
  };
}

export function SessionCasePanel({ session, href, titleClassName }: Props) {
  const caseItem = toCaseItem(session);
  if (!caseItem) return null;
  return <CaseCard caseItem={caseItem} href={href} titleClassName={titleClassName} />;
}
