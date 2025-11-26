"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import axios from "axios";
import ImageUploader from "@/components/ui/image-uploader";
import {
  caseFieldMeta,
  createEmptyCaseFormState,
  orderedCaseFieldKeys,
  type CaseFieldKey,
  getFieldMeta,
} from "@/features/cases/fieldMeta";

export default function CaseEntryForm() {
  const [expandedField, setExpandedField] = useState<CaseFieldKey | null>(
    null
  );
  const [form, setForm] = useState<Record<CaseFieldKey, string>>(
    createEmptyCaseFormState
  );
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    if (!getFieldMeta(name)) return;
    setForm((prev) => ({ ...prev, [name as CaseFieldKey]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSuccess("");
    setError("");
    try {
      // Prepare payload and merge in case-specific structured fields when empty
      const payload: Record<string, unknown> = { ...form };

      // Helper to inject default text only when empty
      const ensure = (key: CaseFieldKey, value: string) => {
        const v = payload[key];
        if (
          v === undefined ||
          v === null ||
          (typeof v === "string" && v.trim() === "")
        ) {
          payload[key] = value;
        }
      };

      // Basic case-specific defaults based on id/title
  const patientLabel = String(
    payload["title"] ?? payload["id"] ?? "the patient"
  );

  const diagnostic_findings_template = `List the diagnostic data that is already available for this case. Present each value on its own line with units where appropriate. When responding to the student, release only the specific result they request. If a test has not been performed, state that it is pending or unavailable.`;

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

  // Prompts for interactive roles
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

  const get_owner_follow_up_prompt_template = `You are roleplaying as the owner or caretaker during the diagnostic planning conversation. Ask for clear explanations, raise practical concerns, and acknowledge when the student addresses them effectively.`;

  const get_owner_follow_up_feedback_prompt_template = `Provide structured feedback on the student's diagnostic planning discussion. Highlight strengths, note missing explanations, and recommend actionable improvements.`;

  const get_owner_diagnosis_prompt_template = `You are the owner or caretaker receiving the results discussion. Respond with practical questions about management, monitoring, and communication while staying consistent with the owner's persona.`;

  const get_overall_feedback_prompt_template = `Provide a comprehensive teaching summary covering communication, clinical reasoning, diagnostic planning, and professionalism observed across the entire case.`;

      // Inject defaults when empty
      ensure("diagnostic_findings", diagnostic_findings_template);
      ensure("owner_background", owner_background_template);
      ensure("history_feedback", history_feedback_template);
      ensure("owner_follow_up", owner_follow_up_template);
      ensure("owner_follow_up_feedback", owner_follow_up_feedback_template);
      ensure("owner_diagnosis", owner_diagnosis_template);
      ensure("get_owner_prompt", get_owner_prompt_template);
      ensure(
        "get_history_feedback_prompt",
        get_history_feedback_prompt_template
      );
      ensure("get_physical_exam_prompt", get_physical_exam_prompt_template);
      ensure("get_diagnostic_prompt", get_diagnostic_prompt_template);
      ensure("get_owner_follow_up_prompt", get_owner_follow_up_prompt_template);
      ensure(
        "get_owner_follow_up_feedback_prompt",
        get_owner_follow_up_feedback_prompt_template
      );
      ensure("get_owner_diagnosis_prompt", get_owner_diagnosis_prompt_template);
      ensure(
        "get_overall_feedback_prompt",
        get_overall_feedback_prompt_template
      );

      // Post to API
      await axios.post("/api/cases", payload);
      setSuccess("Case added successfully!");
      setForm(createEmptyCaseFormState());
    } catch (err: unknown) {
      // Prefer server-provided error message when available
      const e = err as {
        response?: { data?: { error?: string } };
        message?: string;
      };
      const serverMsg =
        e?.response?.data?.error ??
        e?.message ??
        (typeof err === "string" ? err : undefined);
      setError(serverMsg ?? "Error adding case. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Add New Case</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {orderedCaseFieldKeys.map((key) => {
          const meta = caseFieldMeta[key];
          const helpId = meta.help ? `${key}-help` : undefined;

          if (key === "image_url") {
            return (
              <div key={key}>
                <label className="block font-medium mb-1" htmlFor={key}>
                  {meta.label}
                </label>
                <div className="space-y-2">
                  <ImageUploader
                    existingUrl={form.image_url}
                    onUpload={(url) =>
                      setForm((prev) => ({ ...prev, image_url: url }))
                    }
                  />
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
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setExpandedField(key)}
                  >
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
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Submitting..." : "Submit"}
        </Button>
        {success && <div className="text-green-600 mt-2">{success}</div>}
        {error && <div className="text-red-600 mt-2">{error}</div>}
      </form>
      {/* Modal for expanded field */}
      {expandedField && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-2xl w-full p-6">
            <h2 className="text-lg font-bold mb-2">
              {caseFieldMeta[expandedField]?.label ?? expandedField}
            </h2>
            <Textarea
              value={form[expandedField]}
              onChange={handleChange}
              name={expandedField}
              autoComplete="off"
              className="w-full h-64"
              placeholder={caseFieldMeta[expandedField]?.placeholder}
              aria-describedby={
                caseFieldMeta[expandedField]?.help
                  ? `${expandedField}-help`
                  : undefined
              }
              rows={caseFieldMeta[expandedField]?.rows ?? 12}
            />
            {caseFieldMeta[expandedField]?.help && (
              <p
                id={`${expandedField}-help`}
                className="mt-2 text-sm text-muted-foreground"
              >
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
    </div>
  );
}
