"use client";

import Image from "next/image";
import { Clock } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { Case } from "@/features/case-selection/models/case";

export function CaseDetails({ caseData }: { caseData: Case }) {
  const imageSrc = /^https?:\/\//.test(String(caseData.imageUrl ?? ""))
    ? String(caseData.imageUrl)
    : "/placeholder.svg";

  return (
    <>
      <div className="flex gap-3">
        <div className="relative mb-2 h-40 w-40">
          <Image
            src={imageSrc}
            alt={caseData.title}
            className="border p-1"
            sizes="200px"
            priority
            width={200}
            height={200}
          />
        </div>
        <div>
          <h1 className="block text-3xl font-bold tracking-tight text-primary md:text-4xl">{caseData.title}</h1>
          <p className="mb-3 font-bold text-muted-foreground">ID: {caseData.id}</p>
          <div className="mb-2 flex items-center text-sm text-muted-foreground">
            <Clock className="mr-1 h-4 w-4" />
            <span>Estimated time: {caseData.estimatedTime} minutes</span>
          </div>
          <div className="mb-4 flex items-center gap-2 text-sm">
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

      <div className="prose max-w-none">
        <h2 className="mb-2 text-xl font-semibold">Case Overview</h2>
        <p>{caseData.description}</p>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded-md border p-3">
            <h3 className="text-sm font-medium">Species</h3>
            <p className="mt-1">{caseData.species}</p>
          </div>
          <div className="rounded-md border p-3">
            <h3 className="text-sm font-medium">Category</h3>
            <p className="mt-1">{caseData.category}</p>
          </div>
          <div className="rounded-md border p-3">
            <h3 className="text-sm font-medium">Difficulty</h3>
            <p className="mt-1">{caseData.difficulty}</p>
          </div>
        </div>
      </div>
    </>
  );
}
