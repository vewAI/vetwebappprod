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
    } catch (err: any) {
      setError("Error adding case. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Add New Case</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {Object.entries(initialFormState).map(([key, _]) => (
          <div key={key}>
            <label className="block font-medium mb-1" htmlFor={key}>
              {key.replace(/_/g, " ")}
            </label>
            {key === "details" ? (
              <Textarea
                name={key}
                value={form[key as keyof typeof form]}
                onChange={handleChange}
                className="w-full"
                rows={3}
              />
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
    </div>
  );
}
