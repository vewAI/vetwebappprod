"use client"

import * as React from "react"
import { HelpCircle } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface HelpTipProps {
  content: React.ReactNode
  className?: string
  side?: "top" | "right" | "bottom" | "left"
  mode?: "tooltip" | "popover"
}

export function HelpTip({ content, className, side = "top", mode = "tooltip" }: HelpTipProps) {
  if (mode === "popover") {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn("inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors", className)}
            aria-label="More information"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent side={side} className="w-80 text-sm">
          {content}
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn("inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-help", className)}
            aria-label="More information"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs text-sm">
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
