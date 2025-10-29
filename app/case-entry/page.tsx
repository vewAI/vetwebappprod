"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import axios from "axios";
import ImageUploader from "@/components/ui/image-uploader";

const initialFormState = {
  id: "",
  title: "",
  description: "",
  species: "",
  condition: "",
  category: "",
  difficulty: "",
  estimated_time: "",
  image_url: "",
  details: "",
  physical_exam_findings: "",
  diagnostic_findings: "",
  owner_background: "",
  history_feedback: "",
  owner_follow_up: "",
  owner_follow_up_feedback: "",
  owner_diagnosis: "",
  get_owner_prompt: "",
  get_history_feedback_prompt: "",
  get_physical_exam_prompt: "",
  get_diagnostic_prompt: "",
  get_owner_follow_up_prompt: "",
  get_owner_follow_up_feedback_prompt: "",
  get_owner_diagnosis_prompt: "",
  get_overall_feedback_prompt: "",
};

export default function CaseEntryForm() {
  // List of fields considered long text
  const longTextFields = [
    "description",
    "details",
    "physical_exam_findings",
    "diagnostic_findings",
    "owner_background",
    "history_feedback",
    "owner_follow_up",
    "owner_follow_up_feedback",
    "owner_diagnosis",
    "get_owner_prompt",
    "get_history_feedback_prompt",
    "get_physical_exam_prompt",
    "get_diagnostic_prompt",
    "get_owner_follow_up_prompt",
    "get_owner_follow_up_feedback_prompt",
    "get_owner_diagnosis_prompt",
    "get_overall_feedback_prompt",
  ];
  const [expandedField, setExpandedField] = useState<string | null>(null);
  const [form, setForm] = useState(initialFormState);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    setForm({ ...form, [e.target.name]: e.target.value });
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
      const ensure = (key: string, value: string) => {
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
      const horseName = String(
        payload["title"] ?? payload["id"] ?? "the patient"
      );

      const diagnostic_findings_template = `Note: Only provide results for tests specifically requested by the student. If they request other tests not listed here, results should be within normal range but note these may be unnecessary tests.`;

      const owner_background_template = `Role: Horse Owner (Female, initially worried but responsive to reassurance)\nHorse: ${horseName} (3-year-old Cob mare)\n\nPrimary Concern:\n- Horse is off color and not eating well (this is very concerning as she's usually a good eater)\n- Should express worry about these symptoms ONLY ONCE at the beginning of the conversation\n- If the student provides reassurance or shows empathy, IMMEDIATELY transition to a more calm and cooperative demeanor and DO NOT express worry again\n\nClinical Information (ONLY PROVIDE WHEN SPECIFICALLY REQUESTED):\n1. Current Symptoms:\n- Poor appetite\n- Quieter than usual\n- Feces have been normal until today, they are now a bit dry)\n- No nasal discharge noticed\n- Everything else appears normal\n\n2. Living Situation (ONLY PROVIDE WHEN SPECIFICALLY REQUESTED):\n- Housed at a large yard with 45 horses\n- Stabled at night, out in pasture in morning\n- Not in training yet\n- Other horses come and go for shows frequently\n- ${horseName} hasn't been to any shows for 8 weeks\n\n3. Healthcare (ONLY PROVIDE WHEN SPECIFICALLY REQUESTED):\n- Regular vaccinations for flu and tetanus\n- Not vaccinated for EHV or strangles\n- Regular fecal egg counts performed\n- Last worming was 6 months ago (can't remember product used)\n- Fecal egg counts consistently low\n\n4. Diet (ONLY PROVIDE WHEN SPECIFICALLY REQUESTED):\n- High-quality hay (9-10 kg/day)\n- Commercial feed (low starch, high fiber)\n- Gets speedy-beet\n- Recent nutritionist consultation\n\nImportant Character Notes:\n- Should initially be hesitant about sharing information with yard manager/other owners\n- Will agree to share information if the student explains the importance\n- Can be convinced to allow discussion with yard manager and other vets\n- Should show concern for horse's wellbeing WITHOUT repeatedly mentioning worry\n- Use non-technical language\n- Only provide information when specifically asked\n- If asked about anything not listed above, respond that everything seems normal or you haven't noticed anything unusual\n- IMPORTANT: After any reassurance from the student, switch to a calm, cooperative tone and do not mention being worried again`;

      const history_feedback_template = `You are an experienced veterinary educator providing feedback on a student's history-taking during a case of a horse presenting with poor appetite and being "off color". Base your evaluation on the following criteria: CRITICAL INFORMATION THAT SHOULD BE COLLECTED: 1. Current Clinical Signs - Appetite changes (type, duration) - General demeanor/behavior - Any nasal discharge - Fecal output/consistency - Temperature if checked - Duration of symptoms 2. Yard Environment & Contacts - Details about the yard (size, population) - Contact with other horses - Recent travel/shows - Movement of other horses on yard - Housing arrangements 3. Preventive Healthcare - Vaccination status - Parasite control/worming - Recent health issues 4. Current Management - Housing routine - Diet and feeding - Current work/exercise\n\nEVALUATION GUIDELINES: 1. First acknowledge what the student did well 2. Identify any critical missing information 3. Note the logical flow of questioning (or lack thereof) 4. Provide specific examples of questions they should have asked 5. Be constructive but direct about serious oversights\n\nProvide feedback using the structured format in the UI when requested.`;

      const owner_follow_up_template = `Role: Horse Owner (Female, worried but cooperative and wants to know what's next)\nHorse: ${horseName} (3-year-old Cob mare)\n\nCurrent Understanding:\n- Aware that ${horseName} has: * High temperature * Poor appetite * Some swollen areas around the head * Not quite herself - No diagnosis yet - Wanting to know what happens next\n\nKey Questions/Responses:\n- "So what do we need to do next?"\n- "Why do we need these tests?"\n- "How much will all this cost?"\n- "Do we need to do all of these tests?"\n- "Could we just try some treatment first?"\n- If student suggests treatment without diagnosis: \"Shouldn't we know what we're dealing with first?\"`;

      const owner_follow_up_feedback_template = `CRITICAL INFORMATION THAT SHOULD BE DISCUSSED: 1. Essential Diagnostic Tests: - Nasopharyngeal swab/lavage for: * Strep equi PCR and culture * PCR for flu and EHV1/4 - Lymph node assessment: * Ultrasound of regional lymph nodes * Consider fine needle aspirate of enlarged submandibular lymph node - Blood work if suggested: * Comment on cost vs benefit * Note that biochemistry may be expensive and non-informative 2. Test Prioritization: - Focus on tests specific to suspected infectious disease - Avoid unnecessary testing - Consider cost-effectiveness of each test 3. Biosecurity Measures: - CRITICAL: Discussion of isolation requirements - Temperature monitoring protocol - Communication with yard manager - Prevention of nose-to-nose contact 4. Treatment Considerations: - Explanation of why diagnosis before treatment is important - Discussion of why antimicrobials may not be appropriate - Appropriate use of NSAIDs if suggested - Avoidance of corticosteroids`;

      const owner_diagnosis_template = `Role: Relative/Owner receiving diagnosis (concerned but receptive)\nPatient: ${horseName}\n\nTest Results to Discuss and typical owner questions about diagnosis and management. Provide guidance for student conversation and common owner reactions.`;

      // Prompts for interactive roles
      const get_owner_prompt_template = `You are roleplaying as Catalina's owner in a veterinary consultation. Maintain character according to the following background information while responding to the student's questions. Please remember to only provide information that is specifically asked for.\n\n{ownerBackground}\n\nStudent's question: {studentQuestion}`;

      const get_history_feedback_prompt_template = `IMPORTANT - FIRST CHECK FOR MINIMAL INTERACTION: ... (use the full feedback guidance when requested)`;

      const get_physical_exam_prompt_template = `You are a veterinary assistant helping with the physical examination of ${horseName}. Provide findings only when asked.`;

      const get_diagnostic_prompt_template = `You are a laboratory technician providing diagnostic test results for ${horseName}. Only provide results when specifically requested.`;

      const get_owner_follow_up_prompt_template = `You are roleplaying as ${horseName}'s owner in a follow-up discussion after the physical examination. Maintain character and answer why tests are needed.`;

      const get_owner_follow_up_feedback_prompt_template = `Provide structured feedback on diagnostic planning and biosecurity for follow-up discussions.`;

      const get_owner_diagnosis_prompt_template = `You are roleplaying as the owner in a follow-up about test results. Respond in character.`;

      const get_overall_feedback_prompt_template = `You are an experienced veterinary educator providing comprehensive feedback on the student's performance across the case. Use the structured guidance provided.`;

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
      setForm(initialFormState);
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
        {Object.entries(initialFormState).map(([key]) => (
          <div key={key}>
            <label className="block font-medium mb-1" htmlFor={key}>
              {key.replace(/_/g, " ")}
            </label>
            {key === "image_url" ? (
              <div>
                <ImageUploader
                  existingUrl={form.image_url}
                  onUpload={(url) => setForm({ ...form, image_url: url })}
                />
                <Input
                  name={key}
                  value={form[key as keyof typeof form]}
                  onChange={handleChange}
                  className="w-full mt-2"
                />
              </div>
            ) : longTextFields.includes(key) ? (
              <div className="flex gap-2 items-center">
                <Textarea
                  name={key}
                  value={form[key as keyof typeof form]}
                  onChange={handleChange}
                  className="w-full"
                  rows={3}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setExpandedField(key)}
                >
                  Expand
                </Button>
              </div>
            ) : (
              <Input
                name={key}
                value={form[key as keyof typeof form]}
                onChange={handleChange}
                className="w-full"
              />
            )}
          </div>
        ))}
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
              {expandedField.replace(/_/g, " ")}
            </h2>
            <Textarea
              value={form[expandedField as keyof typeof form]}
              onChange={handleChange}
              name={expandedField}
              className="w-full h-64"
              rows={12}
            />
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
