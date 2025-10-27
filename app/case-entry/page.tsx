"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import axios from "axios";

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
      // You may need to adjust the API endpoint and payload for Supabase
      await axios.post("/api/cases", form);
      setSuccess("Case added successfully!");
      setForm(initialFormState);
    } catch (err: unknown) {
      // Prefer server-provided error message when available
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      const serverMsg = e?.response?.data?.error ?? e?.message ?? (typeof err === "string" ? err : undefined);
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
            {longTextFields.includes(key) ? (
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
