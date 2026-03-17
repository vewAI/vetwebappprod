import { buildAuthHeaders } from "@/lib/auth-headers";
import type {
  CaseVerificationResult,
  CaseVerificationItem,
} from "../models/caseVerification";

export const caseVerificationService = {
  /**
   * Trigger deep clinical verification of the case data.
   */
  async verify(
    caseData: Record<string, string>
  ): Promise<CaseVerificationResult> {
    const headers = await buildAuthHeaders({
      "Content-Type": "application/json",
    });
    const res = await fetch("/api/case-intake/verify", {
      method: "POST",
      headers,
      body: JSON.stringify({ caseData }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        (err as { error?: string }).error ?? "Verification failed"
      );
    }
    return res.json();
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
      throw new Error(
        (err as { error?: string }).error ?? "Chat request failed"
      );
    }
    return res.json();
  },
};
