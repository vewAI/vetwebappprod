"use client";

import { useEffect, useRef, useState } from "react";
import { ClipboardList, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type RevealedFinding = {
  key: string;
  label: string;
  value: string;
  source: "physical" | "diagnostic";
  revealedAt: number;
};

type TestResultsPanelProps = {
  findings: RevealedFinding[];
};

export function TestResultsPanel({ findings }: TestResultsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  // Auto-open whenever a new result is revealed so the student notices.
  useEffect(() => {
    if (findings.length > prevCountRef.current) {
      setIsOpen(true);
    }
    prevCountRef.current = findings.length;
  }, [findings.length]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const sorted = [...findings].sort((a, b) => a.revealedAt - b.revealedAt);

  return (
    <div className="relative" ref={panelRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen((prev) => !prev)}
        className="h-9 w-9 rounded-full"
        title="Test results"
      >
        <ClipboardList className="h-4 w-4" />
        {findings.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-semibold text-white">
            {findings.length}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 bottom-10 w-[28rem] max-w-[92vw] rounded-md border bg-popover shadow-md z-20 p-3 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Test results
            </p>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 p-0"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>

          {sorted.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              Results appear here as written text once you request each test or
              exam value.
            </p>
          ) : (
            <div className="max-h-[55vh] overflow-y-auto space-y-3">
              {/* Physical findings as cards */}
              {sorted.filter((f) => f.source === "physical").length > 0 && (
                <ul className="space-y-2">
                  {sorted
                    .filter((f) => f.source === "physical")
                    .map((f) => (
                      <li key={f.key} className="rounded-md border px-2 py-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold">{f.label}</span>
                          <span className="text-[10px] uppercase text-muted-foreground">exam</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{f.value}</p>
                      </li>
                    ))}
                </ul>
              )}

              {/* Lab results as a table */}
              {sorted.filter((f) => f.source === "diagnostic").length > 0 && (
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-1 pr-2 font-semibold uppercase tracking-wide text-muted-foreground">Test</th>
                      <th className="py-1 font-semibold uppercase tracking-wide text-muted-foreground">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted
                      .filter((f) => f.source === "diagnostic")
                      .map((f) => (
                        <tr key={f.key} className="border-b border-muted/60">
                          <td className="py-1 pr-2 font-medium align-top">{f.label}</td>
                          <td className="py-1 align-top text-muted-foreground">{f.value}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
