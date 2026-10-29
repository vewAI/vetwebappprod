"use client";

import React, { useRef, useState } from "react";
import { GripVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { bundleLabel, bundlesForTest, setTestBundleMembership, type BundledTestsMap } from "../utils/bundledTests";

type ColumnWidths = [number, number, number];
const DEFAULT_WIDTHS: ColumnWidths = [220, 250, 220];
const MIN_WIDTH = 120;
const MAX_WIDTH = 900;

function ResizeHandle({ label, width, onResize }: {
  label: string;
  width: number;
  onResize: (width: number) => void;
}) {
  const drag = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null);

  return (
    <span
      role="separator"
      aria-label={`Resize ${label} column`}
      aria-orientation="vertical"
      aria-valuemin={MIN_WIDTH}
      aria-valuemax={MAX_WIDTH}
      aria-valuenow={width}
      tabIndex={0}
      title={`Drag to resize ${label} column`}
      className="absolute right-0 top-0 flex h-full w-3 cursor-col-resize touch-none items-center justify-center rounded-sm hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      onPointerDown={(event) => {
        event.preventDefault();
        drag.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: width };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (drag.current?.pointerId === event.pointerId) {
          onResize(drag.current.startWidth + event.clientX - drag.current.startX);
        }
      }}
      onPointerUp={(event) => {
        if (drag.current?.pointerId === event.pointerId) {
          drag.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={() => { drag.current = null; }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          onResize(width + (event.key === "ArrowRight" ? 24 : -24));
        }
      }}
    >
      <GripVertical className="h-3 w-3 text-muted-foreground" />
    </span>
  );
}

export function LabReferenceRangesTable({
  ranges,
  bundles,
  filter = "",
  maxHeightClassName = "max-h-56",
  onBundleChange,
  onRemove,
}: {
  ranges: Record<string, string>;
  bundles: BundledTestsMap;
  filter?: string;
  maxHeightClassName?: string;
  onBundleChange?: (bundles: BundledTestsMap) => void;
  onRemove?: (testName: string) => void;
}) {
  const [widths, setWidths] = useState<ColumnWidths>(DEFAULT_WIDTHS);

  const updateWidth = (index: number, value: number) => {
    setWidths((current) => {
      const next = [...current] as ColumnWidths;
      next[index] = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(value)));
      return next;
    });
  };
  const gridTemplateColumns = `${widths[0]}px ${widths[1]}px ${widths[2]}px${onRemove ? " 28px" : ""}`;
  const visibleRanges = Object.entries(ranges)
    .filter(([name, value]) => !filter || `${name} ${value}`.toLowerCase().includes(filter.toLowerCase()))
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <>
    <p className="mb-1 text-[11px] text-muted-foreground">Drag the column dividers to change their widths.</p>
    <div className={`${maxHeightClassName} overflow-auto`} role="table" aria-label="Lab reference ranges">
      <div className="w-max min-w-full space-y-1">
        <div className="sticky top-0 z-10 grid gap-2 border-b bg-background py-1 text-xs font-medium text-muted-foreground" style={{ gridTemplateColumns }} role="row">
          {["Parameter", "Reference range", "Bundle"].map((label, index) => (
            <span key={label} className="relative pr-3" role="columnheader">
              {label}
              <ResizeHandle label={label.toLowerCase()} width={widths[index]} onResize={(value) => updateWidth(index, value)} />
            </span>
          ))}
          {onRemove && <span className="sr-only" role="columnheader">Remove</span>}
        </div>
        {visibleRanges.map(([name, value]) => {
          const memberships = bundlesForTest(bundles, name).map(bundleLabel);
          return (
            <div key={name} className="grid items-start gap-2 border-b border-border/40 py-1 text-xs" style={{ gridTemplateColumns }} role="row">
              <strong className="min-w-0 break-words" role="cell">{name}</strong>
              <span className="min-w-0 whitespace-pre-wrap break-words font-mono text-[11px]" role="cell">{value}</span>
              <span className="min-w-0 break-words" role="cell">
                {onBundleChange ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" size="sm" className="h-auto min-h-7 w-full justify-start whitespace-normal break-words text-left text-xs font-normal">
                        {memberships.join(", ") || "None — select bundle"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="max-h-64 w-64 space-y-2 overflow-y-auto">
                      {Object.keys(bundles).map((bundleId) => (
                        <label key={bundleId} className="flex cursor-pointer items-center gap-2 text-xs">
                          <Checkbox
                            checked={bundles[bundleId].includes(name)}
                            onCheckedChange={(checked) => onBundleChange(setTestBundleMembership(bundles, name, bundleId, checked === true))}
                          />
                          <span>{bundleLabel(bundleId)}</span>
                        </label>
                      ))}
                      {Object.keys(bundles).length === 0 && <span className="text-xs text-muted-foreground">Create a bundle below first.</span>}
                    </PopoverContent>
                  </Popover>
                ) : memberships.join(", ") || "—"}
              </span>
              {onRemove && (
                <button type="button" aria-label={`Remove ${name}`} className="p-1 text-destructive hover:text-destructive/80" onClick={() => onRemove(name)}>
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
        {visibleRanges.length === 0 && <p className="py-2 text-xs italic text-muted-foreground">{filter ? "No matching lab ranges." : "No lab reference ranges added yet."}</p>}
      </div>
    </div>
    </>
  );
}
