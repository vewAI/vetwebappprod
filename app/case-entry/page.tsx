"use client";

import React, { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import axios from "axios";
import { getAccessToken, buildAuthHeaders } from "@/lib/auth-headers";
import { useAuth } from "@/features/auth/services/authService";
import ImageUploader from "@/components/ui/image-uploader";
import { caseFieldMeta, createEmptyCaseFormState, orderedCaseFieldKeys, type CaseFieldKey, getFieldMeta } from "@/features/cases/fieldMeta";
import { CaseMediaEditor } from "@/features/cases/components/case-media-editor";
import { TimeProgressionEditor } from "@/features/cases/components/case-time-progression-editor";
import { AvatarSelector } from "@/features/cases/components/avatar-selector";
import type { CaseMediaItem } from "@/features/cases/models/caseMedia";
import { VerificationChatbot } from "@/features/case-intake/components/VerificationChatbot";
import { AnalysisLoadingOverlay } from "@/features/case-intake/components/AnalysisLoadingOverlay";
import { caseVerificationService } from "@/features/case-intake/services/caseVerificationService";
import type { CaseVerificationResult } from "@/features/case-intake/models/caseVerification";

type IntakeCompletionItem = {
  fieldKey: string;
  label: string;
  extractedValue: string;
  isMissing: boolean;
  missingReason: string;
  aiSuggestion: string;
  confidence?: number;
};

type IntakeAnalysisResult = {
  draftCase: Record<string, string>;
  completionPlan: IntakeCompletionItem[];
  missingCount: number;
  sourceSummary: string;
};

function isCaseFieldKey(value: string): value is CaseFieldKey {
  return Boolean(getFieldMeta(value));
}

/**
 * Maps LLM-generated targetField names to actual form state keys.
 * The LLM sometimes uses descriptive aliases instead of the real DB column / form key.
 */
const TARGET_FIELD_ALIASES: Record<string, CaseFieldKey> = {
  learner_facing_summary: "description",
  owner_chat_prompt: "get_owner_prompt",
  history_feedback_instructions: "get_history_feedback_prompt",
  follow_up_feedback_prompt: "owner_follow_up_feedback",
  owner_follow_up_feedback_prompt: "get_owner_follow_up_feedback_prompt",
  imaging_findings: "diagnostic_findings",
  differential_diagnoses: "details",
  physical_exam_prompt: "get_physical_exam_prompt",
  diagnostic_prompt: "get_diagnostic_prompt",
  diagnostics_prompt: "get_diagnostic_prompt",
  owner_follow_up_prompt: "get_owner_follow_up_prompt",
  owner_diagnosis_prompt: "get_owner_diagnosis_prompt",
  feedback_prompt: "get_overall_feedback_prompt",
  overall_feedback_prompt: "get_overall_feedback_prompt",
};

function normalizeTargetField(field: string): string {
  return TARGET_FIELD_ALIASES[field] ?? field;
}

/** Fields safe to auto-apply without chatbot review (basic metadata, not clinical content) */
const IDENTITY_FIELDS: ReadonlySet<string> = new Set([
  "id",
  "title",
  "species",
  "condition",
  "category",
  "patient_name",
  "patient_age",
  "patient_sex",
  "difficulty",
  "estimated_time",
  "region",
]);

export default function CaseEntryForm() {
  const { role, loading: authLoading } = useAuth() as { role: string | null; loading: boolean };
  const canCreate = role === "admin" || role === "professor";

  const [expandedField, setExpandedField] = useState<CaseFieldKey | null>(null);
  const [form, setForm] = useState<Record<CaseFieldKey, string>>(createEmptyCaseFormState);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [mediaItems, setMediaItems] = useState<CaseMediaItem[]>([]);
  const [savedCaseId, setSavedCaseId] = useState<string>("");

  const [verificationResult, setVerificationResult] = useState<CaseVerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [autoFillSuggestions, setAutoFillSuggestions] = useState<Record<string, string | null>>({});
  const [showAutoFillModal, setShowAutoFillModal] = useState(false);
  const [showVerificationChat, setShowVerificationChat] = useState(false);

  const [intakeText, setIntakeText] = useState("");
  const [intakeFile, setIntakeFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [countdown, setCountdown] = useState(120); // 2 minutes countdown
  const [analysis, setAnalysis] = useState<IntakeAnalysisResult | null>(null);
  const [wizardIndex, setWizardIndex] = useState(0);
  const [reviewed, setReviewed] = useState<Record<string, boolean>>({});

  // Countdown timer during analysis
  useEffect(() => {
    if (!isAnalyzing) return;

    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [isAnalyzing]);

  // Reset countdown when analysis starts
  useEffect(() => {
    if (isAnalyzing) {
      setCountdown(120); // 2 minutes
    }
  }, [isAnalyzing]);

  const caseIdForMedia = useMemo(() => {
    const raw = form.id?.trim();
    return raw ? raw : undefined;
  }, [form.id]);

  const missingFields = useMemo(() => {
    if (!analysis) return [] as IntakeCompletionItem[];
    return analysis.completionPlan.filter((item) => item.isMissing);
  }, [analysis]);

  const currentMissing = missingFields[wizardIndex] ?? null;
  const wizardDone = missingFields.length > 0 && wizardIndex >= missingFields.length;

  const applyDraftToForm = (draftCase: Record<string, string>) => {
    setForm((prev) => {
      const next = { ...prev };
      for (const [key, value] of Object.entries(draftCase)) {
        if (!isCaseFieldKey(key)) continue;
        next[key] = String(value ?? "");
      }
      return next;
    });
  };

  const handleAnalyzeCaseSource = async () => {
    setIsAnalyzing(true);
    setError("");
    setSuccess("");

    try {
      const fd = new FormData();
      fd.append("rawText", intakeText);
      if (intakeFile) {
        fd.append("sourceFile", intakeFile);
      }

      const token = await getAccessToken();
      const headers = await buildAuthHeaders({}, token);
      const response = await fetch("/api/case-intake/analyze", {
        method: "POST",
        headers,
        body: fd,
      });

      const data = (await response.json()) as IntakeAnalysisResult | { error?: string };
      if (!response.ok) {
        throw new Error((data as { error?: string })?.error ?? "Failed to analyze source text");
      }

      const result = data as IntakeAnalysisResult;
      setAnalysis(result);
      setWizardIndex(0);
      setReviewed({});
      // Split draft: identity fields go straight to form, clinical fields wait for chatbot review
      const draft = result.draftCase ?? {};
      const identityPatch: Record<string, string> = {};
      for (const [key, value] of Object.entries(draft)) {
        if (!isCaseFieldKey(key)) continue;
        if (IDENTITY_FIELDS.has(key)) {
          identityPatch[key] = String(value ?? "");
        }
      }
      // Apply only identity fields to the form immediately
      if (Object.keys(identityPatch).length > 0) {
        applyDraftToForm(identityPatch);
      }

      // Auto-launch verification chatbot so the professor reviews AI suggestions field by field
      setSuccess("AI analysis complete. Launching clinical verification...");
      setIsVerifying(true);
      try {
        // Pass the FULL draft to verify so it can see what the AI suggested
        const formWithDraft = { ...createEmptyCaseFormState() };
        for (const [key, value] of Object.entries(draft)) {
          if (isCaseFieldKey(key)) formWithDraft[key] = String(value ?? "");
        }
        const verifyResult = await caseVerificationService.verify(formWithDraft);
        setVerificationResult(verifyResult);
        setShowVerificationChat(true);
        setSuccess("Clinical verification ready. Review each AI suggestion with the guide.");
      } catch (verifyErr) {
        const msg = verifyErr instanceof Error ? verifyErr.message : String(verifyErr);
        setError(msg || "Analysis succeeded but verification failed. You can retry below.");
      } finally {
        setIsVerifying(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "Could not analyze the input text.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const markCurrentReviewedAndNext = () => {
    if (!currentMissing) return;
    setReviewed((prev) => ({ ...prev, [currentMissing.fieldKey]: true }));
    setWizardIndex((prev) => prev + 1);
  };

  const handleVerifyCase = async () => {
    setIsVerifying(true);
    setError("");
    try {
      const result = await caseVerificationService.verify(form);
      setVerificationResult(result);
      setShowVerificationChat(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "Could not verify the case.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleFieldResolved = (targetField: string, value: string, writeMode: "append" | "replace") => {
    const normalized = normalizeTargetField(targetField);
    if (!isCaseFieldKey(normalized)) {
      console.warn(`[FIELD-RESOLVED] Unknown targetField "${targetField}" (normalized: "${normalized}") – skipping`);
      return;
    }
    console.log(`[FIELD-RESOLVED] Writing to "${normalized}" (from "${targetField}") mode=${writeMode} (${value.length} chars)`);
    setForm((prev) => {
      const existing = prev[normalized] || "";
      if (writeMode === "append" && existing.trim()) {
        return { ...prev, [normalized]: existing.trim() + "\n" + value };
      }
      return { ...prev, [normalized]: value };
    });
  };

  const handleVerificationComplete = async () => {
    setShowVerificationChat(false);
    setSuccess("Verification complete. Data has been integrated into the form.");

    // Detect empty fields that should be auto-filled (use actual form keys)
    const emptyFields = [
      "description",
      "owner_background",
      "get_history_feedback_prompt",
      "owner_follow_up",
      "get_owner_follow_up_feedback_prompt",
      "owner_diagnosis",
      "get_owner_prompt",
      "owner_follow_up_feedback",
      "details",
      "physical_exam_findings",
      "diagnostic_findings",
      "get_physical_exam_prompt",
      "get_diagnostic_prompt",
      "get_owner_follow_up_prompt",
      "get_owner_diagnosis_prompt",
      "get_overall_feedback_prompt",
    ].filter((field) => {
      const value = form[field as CaseFieldKey];
      return !value || (typeof value === "string" && value.trim() === "");
    });

    console.log("[AUTO-FILL] Empty fields detected:", emptyFields);

    if (emptyFields.length === 0) {
      console.log("[AUTO-FILL] No empty fields, skipping auto-fill");
      return; // All fields are filled
    }

    // Request auto-fill suggestions from LLM
    setIsAutoFilling(true);
    try {
      console.log("[AUTO-FILL] Requesting suggestions for fields:", emptyFields);
      const suggestions = await caseVerificationService.autoFill({
        emptyFields,
        caseData: form,
      });
      console.log("[AUTO-FILL] Received suggestions:", suggestions);

      // Verify all fields have content
      const populatedFields = Object.entries(suggestions).filter(([_, val]) => val && val.trim().length > 0);
      console.log(`[AUTO-FILL] Populated ${populatedFields.length}/${Object.keys(suggestions).length} fields`);

      setAutoFillSuggestions(suggestions);
      setShowAutoFillModal(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[AUTO-FILL] Error generating suggestions:", err);
      setError(`Could not generate suggestions: ${msg}`);
    } finally {
      setIsAutoFilling(false);
    }
  };

  const handleAutoFillApply = (selectedFields: Record<string, boolean>) => {
    // Apply only the selected suggestions to the form
    console.log("[AUTO-FILL] Applying suggestions with selected fields:", selectedFields);
    console.log("[AUTO-FILL] Current suggestions:", autoFillSuggestions);

    setForm((prev) => {
      const next = { ...prev };
      let appliedCount = 0;

      for (const [field, isSelected] of Object.entries(selectedFields)) {
        if (isSelected) {
          const suggestion = autoFillSuggestions[field];
          // Check for non-null/undefined, not just truthy (to allow empty strings)
          const hasSuggestion = suggestion !== null && suggestion !== undefined;
          const content = hasSuggestion ? String(suggestion) : "";

          console.log(`[AUTO-FILL] Field: ${field}, isSelected: ${isSelected}, hasSuggestion: ${hasSuggestion}, content length: ${content.length}`);

          if (hasSuggestion && content.trim().length > 0) {
            next[field as CaseFieldKey] = content;
            console.log(`[AUTO-FILL] ✓ Applied ${field} (${content.length} chars)`);
            appliedCount++;
          } else {
            console.warn(`[AUTO-FILL] ⚠ Skipped ${field} - no content (hasSuggestion=${hasSuggestion}, trimmed length=${content.trim().length})`);
          }
        }
      }

      console.log(`[AUTO-FILL] Total fields applied: ${appliedCount}`);
      return next;
    });

    setShowAutoFillModal(false);
    setSuccess(`Suggestions applied to ${Object.values(selectedFields).filter(Boolean).length} fields. Review and save when ready.`);
  };

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    if (!getFieldMeta(name)) return;
    setForm((prev) => ({ ...prev, [name as CaseFieldKey]: value }));
  }

  const handleDownloadTxt = async () => {
    try {
      const token = await getAccessToken();
      const headers = await buildAuthHeaders({ "Content-Type": "application/json" }, token);
      const response = await fetch("/api/case-intake/export", {
        method: "POST",
        headers,
        body: JSON.stringify({
          caseId: savedCaseId || form.id || "new-case",
          format: "txt",
          approvedValues: form,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        fileName?: string;
        mimeType?: string;
        contentBase64?: string;
      };

      if (!response.ok || !payload.contentBase64 || !payload.fileName) {
        throw new Error(payload.error || "Could not generate TXT export");
      }

      const raw = atob(payload.contentBase64);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
      const blob = new Blob([bytes], { type: payload.mimeType || "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = payload.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "Failed to export TXT");
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSuccess("");
    setError("");
    try {
      const payload: Record<string, unknown> = { ...form };
      payload["media"] = mediaItems;

      const ensure = (key: CaseFieldKey, value: string) => {
        const v = payload[key];
        if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) {
          payload[key] = value;
        }
      };

      const patientLabel = String(payload["title"] ?? payload["id"] ?? "the patient");

      const diagnostic_findings_template =
        "List the diagnostic data that is already available for this case. Present each value on its own line with units where appropriate. When responding to the student, release only the specific result they request. If a test has not been performed, state that it is pending or unavailable.";

      const owner_background_template = `Role: Animal owner or primary caretaker.
Patient: ${patientLabel}

Guidance for conversation setup:
- Open with the key concern in one or two sentences.
- Provide additional medical or management history ONLY when the student asks for it.
- Use plain language and avoid medical jargon unless the student introduces it.
- Begin slightly worried but become cooperative once a plan is explained.
- If a question falls outside the information you know, state that you are unsure rather than improvising.`;

      const history_feedback_template = `You are an experienced veterinary educator providing feedback on a student's history-taking performance.

Assessment checklist:
1. Presenting complaint details (onset, duration, severity, progression).
2. Signalment and relevant background for the patient.
3. Environment, exposure risks, and recent changes.
4. Preventive healthcare status and prior medical history.
5. Current diet, medications, and management routines.

Feedback instructions:
- Begin by highlighting what the student did well.
- Identify the most important unanswered questions.
- Suggest 2-3 concrete follow-up questions they should ask next.
- Comment briefly on organisation and rapport-building.
- Keep the tone constructive and educational.`;

      const owner_follow_up_template = `Role: Animal owner or caretaker seeking clarity on next steps.
Patient: ${patientLabel}

Conversation goals:
- Understand which diagnostics are being recommended and why.
- Ask about costs, logistics, and timing for each test or treatment.
- Raise concerns about patient comfort or practicality when appropriate.
- Become more cooperative once the clinician explains the rationale clearly.
- Avoid repeating the same concern once it has been addressed.`;

      const owner_follow_up_feedback_template = `When reviewing this stage, comment on whether the student:
- Prioritised diagnostics that align with the likely differentials.
- Explained the purpose and value of each recommendation in plain language.
- Discussed cost considerations or resource constraints when prompted.
- Addressed biosecurity, safety, or home-care logistics if relevant.
- Invited and handled owner questions respectfully.`;

      const owner_diagnosis_template = `Role: Animal owner receiving diagnostic results and management plan.
Patient: ${patientLabel}

Guidance:
- React with natural concern, then focus on practical questions about prognosis, monitoring, treatment, and communication.
- Ask about timelines for recovery, potential complications, and how to protect other animals or people if relevant.
- Acknowledge clear explanations and request clarification when something is unclear.`;

      const get_owner_prompt_template = `You are roleplaying as the patient's owner or caretaker. Stay in character using the background information below and provide only the details that are explicitly requested.

{ownerBackground}

Student's question: {studentQuestion}

Remain collaborative, use everyday language, and avoid offering your own medical diagnoses.`;

      const get_history_feedback_prompt_template = `IMPORTANT - FIRST CHECK FOR MINIMAL INTERACTION:
1. Determine if the student has supplied fewer than three substantive messages in the conversation context below.
2. If interaction is minimal, provide guidance encouraging them to gather more information before requesting feedback.
3. If interaction is sufficient, deliver detailed feedback using the rubric provided in this prompt.`;

      const get_physical_exam_prompt_template = `You are a veterinary assistant supporting the examination of ${patientLabel}. Share only the specific vital sign or system finding that the student asks about. If their request is vague, prompt them to be more specific.`;

      const get_diagnostic_prompt_template = `You are a laboratory technician answering questions about diagnostic results for ${patientLabel}. Release one requested result at a time, note if a test is pending or unperformed, and avoid interpretation beyond the raw data.`;

      const get_owner_follow_up_prompt_template =
        "You are roleplaying as the owner or caretaker during the diagnostic planning conversation. Ask for clear explanations, raise practical concerns, and acknowledge when the student addresses them effectively.";

      const get_owner_follow_up_feedback_prompt_template =
        "Provide structured feedback on the student's diagnostic planning discussion. Highlight strengths, note missing explanations, and recommend actionable improvements.";

      const get_owner_diagnosis_prompt_template =
        "You are the owner or caretaker receiving the results discussion. Respond with practical questions about management, monitoring, and communication while staying consistent with the owner's persona.";

      const get_overall_feedback_prompt_template =
        "Provide a comprehensive teaching summary covering communication, clinical reasoning, diagnostic planning, and professionalism observed across the entire case.";

      ensure("diagnostic_findings", diagnostic_findings_template);
      ensure("owner_background", owner_background_template);
      ensure("history_feedback", history_feedback_template);
      ensure("owner_follow_up", owner_follow_up_template);
      ensure("owner_follow_up_feedback", owner_follow_up_feedback_template);
      ensure("owner_diagnosis", owner_diagnosis_template);
      ensure("get_owner_prompt", get_owner_prompt_template);
      ensure("get_history_feedback_prompt", get_history_feedback_prompt_template);
      ensure("get_physical_exam_prompt", get_physical_exam_prompt_template);
      ensure("get_diagnostic_prompt", get_diagnostic_prompt_template);
      ensure("get_owner_follow_up_prompt", get_owner_follow_up_prompt_template);
      ensure("get_owner_follow_up_feedback_prompt", get_owner_follow_up_feedback_prompt_template);
      ensure("get_owner_diagnosis_prompt", get_owner_diagnosis_prompt_template);
      ensure("get_overall_feedback_prompt", get_overall_feedback_prompt_template);

      const headers = await buildAuthHeaders();

      // Check if this is an existing case (already saved) or a new case
      // Only treat as existing if we previously saved this case (savedCaseId is set AND matches current form.id)
      // If user changed the ID to something new, it's a POST (create new), not a PUT (update existing)
      const isExistingCase = Boolean(savedCaseId && form.id === savedCaseId);

      let response;
      if (isExistingCase) {
        // Use PUT to update existing case
        response = await axios.put("/api/cases", payload, { headers });
      } else {
        // Use POST to create new case
        response = await axios.post("/api/cases", payload, { headers });
      }

      const inserted = (response.data?.data?.[0] ?? response.data?.data) as { id?: string } | undefined;
      const createdId = String(inserted?.id ?? payload.id ?? "").trim();
      if (createdId) {
        setSavedCaseId(createdId);
      }

      setSuccess("Case saved successfully.");
      if (createdId) {
        setForm((prev) => ({ ...prev, id: createdId }));
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      const serverMsg = e?.response?.data?.error ?? e?.message ?? (typeof err === "string" ? err : undefined);
      setError(serverMsg ?? "Error adding case. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) {
    return <div className="max-w-2xl mx-auto p-8 text-sm text-muted-foreground">Checking permissions...</div>;
  }

  if (!canCreate) {
    return (
      <div className="max-w-2xl mx-auto p-8 space-y-3">
        <h1 className="text-2xl font-bold text-red-600">Access denied</h1>
        <p className="text-sm text-muted-foreground">Only professors and admins can create cases.</p>
      </div>
    );
  }

  // Auto-fill suggestions panel component
  const AutoFillSuggestionsPanel = ({
    suggestions,
    isLoading,
    onApply,
    onCancel,
  }: {
    suggestions: Record<string, string | null>;
    isLoading: boolean;
    onApply: (selected: Record<string, boolean>) => void;
    onCancel: () => void;
  }) => {
    console.log("[AUTO-FILL-PANEL] Rendering with suggestions:", suggestions);

    const [selected, setSelected] = useState<Record<string, boolean>>(
      Object.keys(suggestions).reduce(
        (acc, field) => {
          acc[field] = true; // Pre-select all
          return acc;
        },
        {} as Record<string, boolean>,
      ),
    );

    const fieldNames: Record<string, string> = {
      description: "Learner-Facing Summary",
      owner_background: "Owner Personality & Context",
      get_history_feedback_prompt: "History Feedback AI Rules",
      owner_follow_up: "Owner Post-Exam Questions",
      get_owner_follow_up_feedback_prompt: "Diagnostic Planning Feedback AI Rules",
      owner_diagnosis: "Owner Diagnosis Reaction",
      get_owner_prompt: "Owner AI Behaviour",
      owner_follow_up_feedback: "Diagnostic Planning Rubric",
      details: "Full Clinical History",
      physical_exam_findings: "Physical Exam Findings",
      diagnostic_findings: "Lab & Diagnostic Results",
      get_physical_exam_prompt: "Nurse AI Behaviour",
      get_diagnostic_prompt: "Lab Technician AI Behaviour",
      get_owner_follow_up_prompt: "Owner Follow-Up AI Behaviour",
      get_owner_diagnosis_prompt: "Owner Diagnosis AI Behaviour",
      get_overall_feedback_prompt: "Final Case Summary AI Rules",
    };

    const handleApply = () => {
      console.log("[AUTO-FILL-PANEL] Apply clicked with selected:", selected);
      onApply(selected);
    };

    return (
      <div className="space-y-4">
        {Object.entries(suggestions).map(([field, suggestion]) => {
          console.log(`[AUTO-FILL-PANEL] Field ${field}: has content = ${suggestion ? "YES" : "NO"}`);

          return suggestion ? (
            <div key={field} className="border rounded-lg p-4 space-y-2 bg-muted/50">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id={`select-${field}`}
                  checked={selected[field]}
                  onChange={(e) =>
                    setSelected((prev) => ({
                      ...prev,
                      [field]: e.target.checked,
                    }))
                  }
                  className="w-4 h-4"
                />
                <label htmlFor={`select-${field}`} className="font-medium text-sm">
                  {fieldNames[field] || field}
                </label>
              </div>
              <pre className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-3 max-h-32 overflow-y-auto whitespace-pre-wrap break-words">
                {suggestion}
              </pre>
            </div>
          ) : null;
        })}

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={isLoading || Object.values(selected).every((v) => !v)}>
            {isLoading ? "Generating..." : "Apply Selected"}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Add New Case</h1>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-4 bg-card">
        <div>
          <h2 className="text-lg font-semibold">1) Paste Full Case Source</h2>
          <p className="text-sm text-muted-foreground mt-1">Paste the complete case as you have it. Then optionally upload a supporting document.</p>
        </div>

        <Textarea
          value={intakeText}
          onChange={(e) => setIntakeText(e.target.value)}
          rows={10}
          placeholder="Paste full case text here (history, exam, diagnostics, owner context, prompts, etc.)"
          className="w-full"
        />

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="case-source-file">
            2) Upload Supporting File (optional)
          </label>
          <Input id="case-source-file" type="file" accept=".pdf,.txt,.docx" onChange={(e) => setIntakeFile(e.target.files?.[0] ?? null)} />
          <p className="text-xs text-muted-foreground">Allowed types: .pdf, .txt, .docx</p>
        </div>

        <div className="flex items-center gap-3">
          <Button type="button" onClick={handleAnalyzeCaseSource} disabled={isAnalyzing || isVerifying || (!intakeText.trim() && !intakeFile)}>
            {isAnalyzing ? (isVerifying ? "Verifying..." : "Analyzing...") : "Analyze and Verify Case"}
          </Button>
          {intakeFile && <span className="text-xs text-muted-foreground">Selected: {intakeFile.name}</span>}
        </div>
      </div>

      {analysis && (
        <div className="rounded-lg border border-border p-4 space-y-4 bg-card">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">3) AI Analysis & Verification</h2>
            <p className="text-sm text-muted-foreground">{analysis.sourceSummary}</p>
            {verificationResult && (
              <p className="text-sm">
                Completeness: <strong>{verificationResult.completenessScore}%</strong> — {verificationResult.counts.missing} items pending from{" "}
                {verificationResult.items.length} analyzed.
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {verificationResult && !showVerificationChat && (
              <Button type="button" onClick={() => setShowVerificationChat(true)}>
                Reopen Verification Guide ({verificationResult.completenessScore}%)
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={handleVerifyCase}
              disabled={isVerifying || !form.species?.trim() || !form.condition?.trim()}
            >
              {isVerifying ? "Re-analyzing..." : "Re-run Verification"}
            </Button>
          </div>

          {isVerifying && (
            <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">Running clinical completeness analysis...</div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg border border-border p-4">
          <h2 className="text-lg font-semibold mb-2">4) Final Edit and Save</h2>
          <p className="text-sm text-muted-foreground">Review, adjust, and save the complete case record.</p>
        </div>

        {orderedCaseFieldKeys.map((key) => {
          const meta = caseFieldMeta[key];
          const helpId = meta.help ? `${key}-help` : undefined;

          if (meta.options && meta.options.length > 0) {
            return (
              <div key={key}>
                <label className="block font-medium mb-1" htmlFor={key}>
                  {meta.label}
                </label>
                <select
                  name={key}
                  value={form[key]}
                  onChange={handleChange}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  aria-describedby={helpId}
                >
                  <option value="" disabled>
                    {meta.placeholder || "Select..."}
                  </option>
                  {meta.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                {meta.help && (
                  <p id={helpId} className="mt-1 text-sm text-muted-foreground">
                    {meta.help}
                  </p>
                )}
              </div>
            );
          }

          if (key === "image_url") {
            return (
              <div key={key}>
                <label className="block font-medium mb-1" htmlFor={key}>
                  {meta.label}
                </label>
                <div className="space-y-2">
                  <ImageUploader existingUrl={form.image_url} onUpload={(url) => setForm((prev) => ({ ...prev, image_url: url }))} />
                  <Input
                    name={key}
                    value={form[key]}
                    onChange={handleChange}
                    placeholder={meta.placeholder}
                    aria-describedby={helpId}
                    className="w-full"
                  />
                </div>
                {meta.help && (
                  <p id={helpId} className="mt-1 text-sm text-muted-foreground">
                    {meta.help}
                  </p>
                )}
              </div>
            );
          }

          if (meta.isAvatarSelector) {
            return (
              <div key={key}>
                <label className="block font-medium mb-1" htmlFor={key}>
                  {meta.label}
                </label>
                <AvatarSelector
                  role={meta.avatarRole ?? "owner"}
                  value={form[key]}
                  onChange={(url, roleKey) =>
                    setForm((prev) => {
                      const next = { ...prev, [key]: url };
                      if (roleKey) {
                        if (meta.avatarRole === "nurse") {
                          next["nurse_persona_id"] = roleKey;
                        } else if (meta.avatarRole === "owner") {
                          next["owner_persona_id"] = roleKey;
                        }
                      }
                      return next;
                    })
                  }
                />
                {meta.help && (
                  <p id={helpId} className="mt-1 text-sm text-muted-foreground">
                    {meta.help}
                  </p>
                )}
              </div>
            );
          }

          if (meta.multiline) {
            return (
              <div key={key}>
                <label className="block font-medium mb-1" htmlFor={key}>
                  {meta.label}
                </label>
                <div className="flex items-start gap-2">
                  <Textarea
                    name={key}
                    autoComplete="off"
                    value={form[key]}
                    onChange={handleChange}
                    placeholder={meta.placeholder}
                    aria-describedby={helpId}
                    className="w-full"
                    rows={meta.rows ?? 4}
                  />
                  <Button type="button" size="sm" onClick={() => setExpandedField(key)}>
                    Expand
                  </Button>
                </div>
                {meta.help && (
                  <p id={helpId} className="mt-1 text-sm text-muted-foreground">
                    {meta.help}
                  </p>
                )}
              </div>
            );
          }

          return (
            <div key={key}>
              <label className="block font-medium mb-1" htmlFor={key}>
                {meta.label}
              </label>
              <Input
                name={key}
                value={form[key]}
                onChange={handleChange}
                placeholder={meta.placeholder}
                aria-describedby={helpId}
                className="w-full"
                autoComplete="off"
              />
              {meta.help && (
                <p id={helpId} className="mt-1 text-sm text-muted-foreground">
                  {meta.help}
                </p>
              )}
            </div>
          );
        })}

        {caseIdForMedia && (
          <div className="space-y-6 pt-4">
            <div className="border border-dashed border-muted-foreground/40 rounded-lg p-4">
              <h3 className="text-lg font-medium mb-4">Case Media</h3>
              <CaseMediaEditor caseId={caseIdForMedia} value={mediaItems} onChange={setMediaItems} />
            </div>

            <div className="border border-dashed border-muted-foreground/40 rounded-lg p-4">
              <TimeProgressionEditor caseId={caseIdForMedia} />
            </div>
          </div>
        )}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Saving..." : "Save Case"}
        </Button>

        {success && <div className="text-green-600 mt-2">{success}</div>}
        {error && <div className="text-red-600 mt-2">{error}</div>}
      </form>

      {savedCaseId && (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <h3 className="font-semibold">5) Post-save actions</h3>
          <p className="text-sm text-muted-foreground">
            Case <code>{savedCaseId}</code> is saved. Choose next action:
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={handleDownloadTxt}>
              Download TXT
            </Button>
            <Button type="button" asChild variant="outline">
              <Link href="/case-viewer">Edit Saved Case</Link>
            </Button>
            <Button type="button" asChild variant="outline">
              <Link href="/admin/case-stage-manager">Edit Stages</Link>
            </Button>
          </div>
        </div>
      )}

      {expandedField && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-2xl w-full p-6">
            <h2 className="text-lg font-bold mb-2">{caseFieldMeta[expandedField]?.label ?? expandedField}</h2>
            <Textarea
              value={form[expandedField]}
              onChange={handleChange}
              name={expandedField}
              autoComplete="off"
              className="w-full h-64"
              placeholder={caseFieldMeta[expandedField]?.placeholder}
              aria-describedby={caseFieldMeta[expandedField]?.help ? `${expandedField}-help` : undefined}
              rows={caseFieldMeta[expandedField]?.rows ?? 12}
            />
            {caseFieldMeta[expandedField]?.help && (
              <p id={`${expandedField}-help`} className="mt-2 text-sm text-muted-foreground">
                {caseFieldMeta[expandedField]?.help}
              </p>
            )}
            <div className="flex justify-end mt-4">
              <Button type="button" onClick={() => setExpandedField(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Loading/Countdown Modal During Analysis */}
      {isAnalyzing && <AnalysisLoadingOverlay countdown={countdown} isVerifying={isVerifying} />}

      {verificationResult && (
        <VerificationChatbot
          open={showVerificationChat}
          onClose={() => setShowVerificationChat(false)}
          verificationResult={verificationResult}
          caseContext={{
            species: form.species || "",
            condition: form.condition || "",
            patientName: form.patient_name || form.title || "",
            category: form.category || "",
          }}
          onFieldResolved={handleFieldResolved}
          onComplete={handleVerificationComplete}
        />
      )}

      {/* Auto-Fill Suggestions Modal */}
      <Dialog open={showAutoFillModal} onOpenChange={setShowAutoFillModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AI-Generated Field Suggestions</DialogTitle>
            <DialogDescription>Review the AI suggestions for empty fields and select which ones to apply to your case.</DialogDescription>
          </DialogHeader>

          <AutoFillSuggestionsPanel
            suggestions={autoFillSuggestions}
            isLoading={isAutoFilling}
            onApply={handleAutoFillApply}
            onCancel={() => setShowAutoFillModal(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
