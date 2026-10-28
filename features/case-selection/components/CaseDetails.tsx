"use client";

import { type ReactNode } from "react";
import Image from "next/image";
import { Clock } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { Case } from "@/features/case-selection/models/case";

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <li className="flex items-center gap-5 py-2.5">
      <span className="w-1/2 text-sm text-gray-500 sm:w-1/3 dark:text-gray-400">{label}</span>
      <span className="w-1/2 text-sm font-medium text-gray-700 sm:w-2/3 dark:text-gray-400">{children || "—"}</span>
    </li>
  );
}

export function CaseSectionCard({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]",
        className,
      )}
    >
      <div className="px-6 py-5">
        <h3 className="text-base font-medium text-primary dark:text-white/90">{title}</h3>
      </div>
      <div className="flex min-h-0 flex-1 flex-col border-t border-gray-200 p-4 sm:p-6 dark:border-gray-800">
        {children}
      </div>
    </div>
  );
}

export function CaseHeroCard({ caseData }: { caseData: Case }) {
  const imageSrc = /^https?:\/\//.test(String(caseData.imageUrl ?? ""))
    ? String(caseData.imageUrl)
    : "/placeholder.svg";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-stretch">
        <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-gray-100 sm:h-40 sm:w-40 dark:border-gray-800">
          <Image src={imageSrc} alt={caseData.title} fill className="object-cover" sizes="160px" priority />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">{caseData.title}</h1>
          <p className="mt-1 text-sm font-medium text-gray-500 dark:text-gray-400">ID: {caseData.id}</p>
          <div className="mt-auto flex items-end justify-between gap-3 pt-4">
            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
              <Clock className="mr-1 h-4 w-4" />
              <span>Estimated time: {caseData.estimatedTime} minutes</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={Boolean(caseData.isPublished)}
                disabled
                aria-readonly="true"
                className="size-5 disabled:cursor-default disabled:opacity-100 data-[state=checked]:border-brand-500 data-[state=checked]:bg-brand-500"
              />
              <span className={caseData.isPublished ? "font-medium text-brand-700 dark:text-brand-400" : "text-muted-foreground"}>
                {caseData.isPublished ? "Published" : "Unpublished"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CaseDescriptionAndDetails({ caseData }: { caseData: Case }) {
  return (
    <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3">
      <CaseSectionCard title="Description" className="lg:col-span-2">
        <p className="text-sm text-gray-700 dark:text-gray-400">{caseData.description || "No description."}</p>
      </CaseSectionCard>
      <CaseSectionCard title="Case Details">
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          <InfoRow label="Species">{caseData.species}</InfoRow>
          <InfoRow label="Category">{caseData.category}</InfoRow>
          <InfoRow label="Difficulty">{caseData.difficulty}</InfoRow>
        </ul>
      </CaseSectionCard>
    </div>
  );
}

export function CaseDetails({ caseData }: { caseData: Case }) {
  return (
    <div className="space-y-6">
      <CaseHeroCard caseData={caseData} />
      <CaseDescriptionAndDetails caseData={caseData} />
    </div>
  );
}
