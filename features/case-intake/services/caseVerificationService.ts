import { buildAuthHeaders } from "@/lib/auth-headers";
import type { CaseVerificationResult, CaseVerificationItem } from "../models/caseVerification";

export const caseVerificationService = {
  /**
   * Trigger deep clinical verification of the case data.
   */
  async verify(caseData: Record<string, string>, sourceText?: string): Promise<CaseVerificationResult> {
    const headers = await buildAuthHeaders({
      "Content-Type": "application/json",
    });
    const body: Record<string, unknown> = { caseData };
    if (sourceText?.trim()) {
      body.sourceText = sourceText;
    }
    const res = await fetch("/api/case-intake/verify", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error ?? "Verification failed");
    }
    return res.json();
  },

  /**
   * Client-side download of verification questions for professor review.
   * Filters pending or missing items and produces a .txt file.
   */
  downloadVerificationQuestions(
    items: CaseVerificationItem[],
    caseContext: { caseId?: string; species?: string; condition?: string; patientName?: string; title?: string },
  ) {
    const pending = (items ?? []).filter((it) => it.status === "pending" || (it.alreadyPresent === false && !it.existingValue));

    const lines: string[] = [];
    const header = `Verification Questions for Case: ${caseContext.title ?? caseContext.caseId ?? "(unknown)"}`;
    lines.push(header);
    lines.push(`Species: ${caseContext.species ?? "(unspecified)"}`);
    lines.push(`Condition: ${caseContext.condition ?? "(unspecified)"}`);
    lines.push(`Patient: ${caseContext.patientName ?? "(unspecified)"}`);
    lines.push("\n");

    // Group by relevance: mandatory -> recommended -> optional -> unnecessary
    const order = ["mandatory", "recommended", "optional", "unnecessary"] as const;
    for (const level of order) {
      const group = pending.filter((g) => g.relevance === level);
      if (!group.length) continue;
      lines.push(`=== ${level.toUpperCase()} ITEMS ===`);
      for (const it of group) {
        lines.push(`- Item: ${it.itemName} (${it.category})`);
        if (it.suggestedPrompt) lines.push(`  Question: ${it.suggestedPrompt}`);
        if (it.reasoning) lines.push(`  Reason: ${it.reasoning}`);
        if (it.existingValue) lines.push(`  Existing: ${it.existingValue}`);
        lines.push("\n");
      }
    }

    const content = lines.join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const fileName = `verification-questions-${caseContext.caseId ?? new Date().toISOString()}.txt`;
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  /**
   * Send a chat message about a specific verification item.
   */
  async chat(params: {
    messages: Array<{ role: string; content: string }>;
    currentItem: CaseVerificationItem;
    caseContext: {
      species: string;
      condition: string;
      patientName: string;
      category: string;
    };
  }): Promise<{
    reply: string;
    extractedValue: string | null;
    isResolved: boolean;
    targetField: string;
    writeMode: "append" | "replace";
  }> {
    const headers = await buildAuthHeaders({
      "Content-Type": "application/json",
    });
    const res = await fetch("/api/case-intake/verify-chat", {
      method: "POST",
      headers,
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error ?? "Chat request failed");
    }
    return res.json();
  },

  /**
   * Generate LLM suggestions for empty case fields.
   */
  async autoFill(params: { emptyFields: string[]; caseData: Record<string, string> }): Promise<Record<string, string | null>> {
    const headers = await buildAuthHeaders({
      "Content-Type": "application/json",
    });
    const res = await fetch("/api/case-intake/auto-fill", {
      method: "POST",
      headers,
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error ?? "Auto-fill request failed");
    }
    const data = await res.json();
    return (data as { suggestions?: Record<string, string | null> }).suggestions ?? {};
  },
};
