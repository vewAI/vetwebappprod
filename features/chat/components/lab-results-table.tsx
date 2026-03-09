import { AlertTriangle, Circle, Droplet, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LabResultPanel, LabResultRow, LabResultsPayload } from "../models/chat";

type LabResultsTableProps = {
  data: LabResultsPayload;
};

function FlagBadge({ flag }: { flag: LabResultRow["flag"] }) {
  if (!flag) return <span className="inline-flex h-5 items-center text-muted-foreground">-</span>;

  if (flag === "critical") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-red-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-900">
        <AlertTriangle className="h-3 w-3" />
        Critical
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700">
      {flag === "low" ? "Low" : "High"}
    </span>
  );
}

function panelIcon(title: string) {
  const t = title.toLowerCase();
  if (t.includes("haematology") || t.includes("hematology") || t.includes("cbc")) {
    return <Droplet className="h-4 w-4 text-red-600" />;
  }
  if (t.includes("biochemistry") || t.includes("chemistry")) {
    return <FlaskConical className="h-4 w-4 text-sky-600" />;
  }
  return <Circle className="h-4 w-4 text-muted-foreground" />;
}

function isLongNarrativeRow(row: LabResultRow): boolean {
  const value = (row.value || "").trim();
  if (!value) return false;
  const hasNumericLead = /^[-+]?\d/.test(value);
  const hasNarrativePunctuation = /[,;.]\s*[A-Za-z]/.test(value);
  return !hasNumericLead && (value.length > 42 || hasNarrativePunctuation);
}

function PanelTable({ panel }: { panel: LabResultPanel }) {
  const useTwoColumnLayout = panel.rows.some(isLongNarrativeRow);

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <header className="border-b border-border bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2">
          {panelIcon(panel.title)}
          <h4 className="text-base font-semibold tracking-tight">{panel.title}</h4>
        </div>
        {panel.subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{panel.subtitle}</p> : null}
      </header>

      <div className="overflow-x-auto">
        <table className={cn("w-full text-sm", useTwoColumnLayout ? "min-w-[420px]" : "min-w-[560px]")}>
          <thead>
            <tr className="border-b border-border bg-muted/20 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 font-semibold">Parameter</th>
              {useTwoColumnLayout ? (
                <th className="px-4 py-2.5 font-semibold">Details</th>
              ) : (
                <>
                  <th className="px-4 py-2.5 font-semibold">Value</th>
                  <th className="px-4 py-2.5 font-semibold">Unit</th>
                  <th className="hidden px-4 py-2.5 font-semibold sm:table-cell">Ref. Range</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {panel.rows.map((row, idx) => (
              <tr key={`${panel.title}-${row.name}-${idx}`} className={cn("hover:bg-muted/20", row.flag === "critical" && "bg-red-50/70")}>
                <td className="px-4 py-2.5 font-medium">{row.name}</td>
                {useTwoColumnLayout ? (
                  <td className="px-4 py-2.5 align-top text-foreground">
                    <div className="whitespace-pre-wrap break-words">{row.value || "-"}</div>
                    {row.flag ? (
                      <div className="mt-1">
                        <FlagBadge flag={row.flag} />
                      </div>
                    ) : null}
                  </td>
                ) : (
                  <>
                    <td className={cn("px-4 py-2.5 tabular-nums", row.flag ? "font-semibold text-red-700" : "text-foreground")}>
                      {row.flag ? <span className="mr-0.5">*</span> : null}
                      {row.value || "-"}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.unit || "-"}</td>
                    <td className="hidden px-4 py-2.5 text-muted-foreground sm:table-cell">{row.refRange || "-"}</td>
                    <td className="px-4 py-2.5">
                      <FlagBadge flag={row.flag} />
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function LabResultsTable({ data }: LabResultsTableProps) {
  if (!data?.panels?.length) return null;

  return (
    <div className="mt-3 space-y-3">
      {data.panels.map((panel, idx) => (
        <PanelTable key={`${panel.title}-${idx}`} panel={panel} />
      ))}
    </div>
  );
}
