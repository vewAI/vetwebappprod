"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import axios from "axios";

export default function CaseViewerPage() {
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
  const [cases, setCases] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchCases() {
      setLoading(true);
      setError("");
      try {
        // You may need to adjust the API endpoint for Supabase
        const response = await axios.get("/api/cases");
        setCases(response.data as any[]);
      } catch (err) {
        setError("Error loading cases.");
      } finally {
        setLoading(false);
      }
    }
    fetchCases();
  }, []);

  function handlePrev() {
    setCurrentIndex((i) => (i > 0 ? i - 1 : i));
  }
  function handleNext() {
    setCurrentIndex((i) => (i < cases.length - 1 ? i + 1 : i));
  }

  if (loading) return <div className="p-8 text-center">Loading cases...</div>;
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>;
  if (!cases.length)
    return <div className="p-8 text-center">No cases found.</div>;

  const currentCase = cases[currentIndex];

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Case Viewer</h1>
      <div className="mb-4 flex justify-between">
        <Button onClick={handlePrev} disabled={currentIndex === 0}>
          ← Prev
        </Button>
        <span className="font-semibold">
          Case {currentIndex + 1} of {cases.length}
        </span>
        <Button
          onClick={handleNext}
          disabled={currentIndex === cases.length - 1}
        >
          Next →
        </Button>
      </div>
      <form className="space-y-4">
        {Object.entries(currentCase).map(([key, value]) => (
          <div key={key}>
            <label className="block font-medium mb-1" htmlFor={key}>
              {key.replace(/_/g, " ")}
            </label>
            {longTextFields.includes(key) ? (
              <div className="flex gap-2 items-center">
                <textarea
                  value={
                    typeof value === "object" && value !== null
                      ? JSON.stringify(value)
                      : value !== undefined
                      ? String(value)
                      : ""
                  }
                  readOnly
                  className="w-full bg-gray-100 dark:bg-gray-900 border rounded px-2 py-1"
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
              <input
                type="text"
                name={key}
                value={
                  typeof value === "object" && value !== null
                    ? JSON.stringify(value)
                    : value !== undefined
                    ? String(value)
                    : ""
                }
                readOnly
                className="w-full bg-gray-100 dark:bg-gray-900 border rounded px-2 py-1"
              />
            )}
          </div>
        ))}
        {/* Modal for expanded field */}
        {expandedField && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-2xl w-full p-6">
              <h2 className="text-lg font-bold mb-2">
                {expandedField.replace(/_/g, " ")}
              </h2>
              <textarea
                value={
                  typeof currentCase[expandedField] === "object" &&
                  currentCase[expandedField] !== null
                    ? JSON.stringify(currentCase[expandedField])
                    : currentCase[expandedField] !== undefined
                    ? String(currentCase[expandedField])
                    : ""
                }
                readOnly
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
      </form>
    </div>
  );
}
