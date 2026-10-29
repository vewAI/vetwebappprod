"use client";

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { parseReferenceRanges } from "../utils/parseReferenceRanges";
import { Check, AlertTriangle, Layers, Replace, ListFilter, Trash2 } from "lucide-react";

export interface BulkReferenceRangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  existingCount: number;
  onApply: (ranges: Record<string, string>, mode: "merge" | "replace") => void;
}

export function BulkReferenceRangesDialog({
  open,
  onOpenChange,
  title,
  existingCount,
  onApply,
}: BulkReferenceRangesDialogProps) {
  const [rawText, setRawText] = useState("");
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [prefixSectionHeaders, setPrefixSectionHeaders] = useState(true);
  const [showSkipped, setShowSkipped] = useState(false);

  const parsed = useMemo(() => {
    if (!rawText.trim()) {
      return { ranges: {}, entries: [], skippedHeaderLines: [], unparsedLines: [], count: 0 };
    }
    return parseReferenceRanges(rawText, { prefixSectionHeaders });
  }, [rawText, prefixSectionHeaders]);

  const handleApply = () => {
    if (parsed.count === 0) return;
    onApply(parsed.ranges, mode);
    onOpenChange(false);
    setRawText("");
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <ListFilter className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm">
            Paste multiple reference ranges from a document, spreadsheet, or text file.
            Parameters are automatically recognized and parsed into the correct format.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Text input area */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Paste Raw Text
              </Label>
              {rawText && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRawText("")}
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3 mr-1" /> Clear
                </Button>
              )}
            </div>
            <Textarea
              placeholder={`Supported formats:\n• Parameter [32–53%]\n• Parameter: 32–53%\n• Two columns copied from Excel / Word (tab-separated)\n• Section headers like "BLOOD/SERUM", "URINALYSIS", "CSF"`}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={7}
              className="font-mono text-xs leading-relaxed"
            />
          </div>

          {/* Options: Mode toggle & Prefix toggle */}
          <div className="bg-muted/40 rounded-lg p-3 space-y-3 border text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">Import Mode:</span>
                <div className="inline-flex rounded-md border bg-background p-0.5">
                  <button
                    type="button"
                    onClick={() => setMode("merge")}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      mode === "merge"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Layers className="h-3 w-3" />
                    Merge (Keep {existingCount} existing)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("replace")}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      mode === "replace"
                        ? "bg-destructive text-destructive-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Replace className="h-3 w-3" />
                    Replace all existing
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="prefixSections"
                  checked={prefixSectionHeaders}
                  onCheckedChange={(checked) => setPrefixSectionHeaders(!!checked)}
                />
                <Label htmlFor="prefixSections" className="cursor-pointer text-xs font-normal">
                  Prefix fluid headers (e.g. &ldquo;CSF - Glucose&rdquo;)
                </Label>
              </div>
            </div>
          </div>

          {/* Live Preview Table */}
          {parsed.count > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-3 py-2 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs">Parsed Preview</span>
                  <Badge variant="success" className="text-xs h-5">
                    {parsed.count} parameters ready
                  </Badge>
                </div>
                {parsed.skippedHeaderLines.length > 0 && (
                  <span className="text-[11px] text-muted-foreground">
                    {parsed.skippedHeaderLines.length} header/comment lines skipped
                  </span>
                )}
              </div>

              <div className="max-h-56 overflow-y-auto divide-y text-xs">
                {parsed.entries.map((item, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 px-3 py-1.5 hover:bg-muted/20 items-center gap-2"
                  >
                    <div className="col-span-6 font-medium text-foreground truncate" title={item.key}>
                      {item.key}
                    </div>
                    <div className="col-span-6 font-mono text-muted-foreground truncate" title={item.value}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unparsed lines warning */}
          {parsed.unparsedLines.length > 0 && (
            <div className="border border-amber-300 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-950/20 rounded-lg p-3 text-xs text-amber-900 dark:text-amber-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>{parsed.unparsedLines.length} line(s) were not recognized as parameters</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSkipped(!showSkipped)}
                  className="text-[11px] underline hover:text-amber-700 dark:hover:text-amber-300"
                >
                  {showSkipped ? "Hide lines" : "Show lines"}
                </button>
              </div>

              {showSkipped && (
                <ul className="mt-2 space-y-1 font-mono text-[11px] bg-background/50 rounded p-2 max-h-32 overflow-y-auto">
                  {parsed.unparsedLines.map((line, i) => (
                    <li key={i} className="truncate">
                      {line}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="mt-3 pt-3 border-t flex flex-row items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            {parsed.count > 0 ? (
              <span>
                Will {mode === "merge" ? "merge with" : "replace"} existing list (
                {mode === "merge" ? `${existingCount} existing` : "clearing old entries"})
              </span>
            ) : (
              <span>Paste your text above to begin</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={parsed.count === 0}
              onClick={handleApply}
              className="gap-1.5"
            >
              <Check className="h-4 w-4" />
              Apply {parsed.count} Parameters
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
