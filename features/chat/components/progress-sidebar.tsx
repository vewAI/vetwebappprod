"use client"

import { CheckCircle, Circle, ChevronLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import type { Case } from "@/features/case-selection/models/case"
import type { Stage } from "@/features/stages/types"

type ProgressSidebarProps = {
  caseItem: Case
  stages: Stage[]
  currentStageIndex: number
  onStageSelect: (index: number) => void
}

export function ProgressSidebar({ caseItem, stages, currentStageIndex, onStageSelect }: ProgressSidebarProps) {

  return (
    <div className="flex h-full flex-col border-r bg-muted/20">
      <div className="border-b p-4">
        <Link href="/">
          <Button variant="outline" size="sm" className="w-full">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Cases
          </Button>
        </Link>
        <h2 className="mt-4 text-lg font-semibold">{caseItem.title}</h2>
        <div className="mt-1 text-sm text-muted-foreground">
          {caseItem.species} - {caseItem.category}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="mb-3 text-sm font-medium">OSCE Progress</h3>
        <div className="space-y-1">
          {stages.map((stage, index) => (
            <button
              key={stage.id}
              onClick={() => onStageSelect(index)}
              className={cn(
                "flex w-full items-center rounded-md px-3 py-2 text-sm transition-colors",
                currentStageIndex === index ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              {stage.completed ? (
                <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
              ) : (
                <Circle className="mr-2 h-4 w-4" />
              )}
              <span className="text-left">{stage.title}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t p-4">
        <div className="text-sm text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Progress</span>
            <span>
              {stages.filter((s) => s.completed).length}/{stages.length}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{
                width: `${(stages.filter((s) => s.completed).length / stages.length) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
