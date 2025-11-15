"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
// ImageUploader intentionally not used here to allow manual image_url input in edit mode.
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
  const [cases, setCases] = useState<Record<string, unknown>[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editable, setEditable] = useState(false);
  const [formState, setFormState] = useState<Record<string, unknown> | null>(
    null
  );
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchCases() {
      setLoading(true);
      setError("");
      try {
        // You may need to adjust the API endpoint for Supabase
        const response = await axios.get("/api/cases");
        const data = response.data as unknown;
        setCases((data as Record<string, unknown>[]) || []);
        // initialize formState for first case
        if (Array.isArray(data) && data.length > 0) {
          setFormState(data[0] as Record<string, unknown>);
        }
      } catch (error: unknown) {
        const e = error instanceof Error ? error.message : String(error);
        setError(`Error loading cases: ${e}`);
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

  // Sync formState when currentIndex changes
  useEffect(() => {
    if (!cases || cases.length === 0) return;
    setFormState(cases[currentIndex] as Record<string, unknown>);
  }, [currentIndex, cases]);
  if (loading) return <div className="p-8 text-center">Loading cases...</div>;
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>;
  if (!cases.length)
    return <div className="p-8 text-center">No cases found.</div>;

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Case Viewer</h1>
      {/* Show image if available */}
      {formState && Boolean(formState["image_url"]) && (
        <div className="mb-4 bg-gray-100 rounded overflow-hidden">
          <img
            src={String(formState.image_url)}
            alt={`Case ${String(formState.id)} image`}
            className="w-full max-h-80 object-contain object-center"
          />
        </div>
      )}
      <div className="mb-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
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

        <div className="flex items-center gap-2">
          <Button
            variant={editable ? "ghost" : "default"}
            onClick={() => setEditable((v) => !v)}
          >
            {editable ? "Lock" : "Edit"}
          </Button>
          <Button
            onClick={async () => {
              if (!formState) return;
              try {
                const resp = await axios.put("/api/cases", formState);
                // update local cases list with returned row
                const respData = resp.data as unknown;
                const respObj = respData as Record<string, unknown>;
                if (respObj && respObj["data"]) {
                  const updated = respObj["data"] as Record<string, unknown>;
                  const nextCases = [...cases];
                  nextCases[currentIndex] = updated;
                  setCases(nextCases);
                  setFormState(updated as Record<string, unknown>);
                  setEditable(false);
                }
              } catch (err) {
                console.error("Error saving case:", err);
                alert("Error saving case. See console for details.");
              }
            }}
          >
            Save
          </Button>
          <Button
            className="bg-red-600 text-white hover:bg-red-700"
            onClick={() => {
              setDeleteStep(1);
              setShowDeleteModal(true);
            }}
          >
            Delete
          </Button>
        </div>
      </div>
      <form className="space-y-4">
        {formState &&
          Object.entries(formState).map(([key]) => (
            <div key={key}>
              <label className="block font-medium mb-1" htmlFor={key}>
                {key.replace(/_/g, " ")}
              </label>
              {key === "image_url" ? (
                <div>
                  {editable ? (
                    <input
                      type="text"
                      name={key}
                      value={
                        typeof formState[key] === "object" &&
                        formState[key] !== null
                          ? JSON.stringify(formState[key])
                          : formState[key] !== undefined
                          ? String(formState[key])
                          : ""
                      }
                      onChange={(e) =>
                        setFormState({ ...formState, [key]: e.target.value })
                      }
                      className="w-full bg-white border rounded px-2 py-1"
                    />
                  ) : (
                    <input
                      type="text"
                      name={key}
                      value={
                        typeof formState[key] === "object" &&
                        formState[key] !== null
                          ? JSON.stringify(formState[key])
                          : formState[key] !== undefined
                          ? String(formState[key])
                          : ""
                      }
                      readOnly
                      className="w-full bg-white border rounded px-2 py-1"
                    />
                  )}
                </div>
              ) : longTextFields.includes(key) ? (
                <div className="flex gap-2 items-center">
                  <textarea
                    value={
                      typeof formState[key] === "object" &&
                      formState[key] !== null
                        ? JSON.stringify(formState[key])
                        : formState[key] !== undefined
                        ? String(formState[key])
                        : ""
                    }
                    id={key}
                    name={key}
                    autoComplete="off"
                    readOnly={!editable}
                    onChange={(e) =>
                      setFormState({ ...formState, [key]: e.target.value })
                    }
                    className="w-full bg-white border rounded px-2 py-1"
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
                    typeof formState[key] === "object" &&
                    formState[key] !== null
                      ? JSON.stringify(formState[key])
                      : formState[key] !== undefined
                      ? String(formState[key])
                      : ""
                  }
                  readOnly={!editable}
                  onChange={(e) =>
                    setFormState({ ...formState, [key]: e.target.value })
                  }
                  className="w-full bg-white border rounded px-2 py-1"
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
                  formState &&
                  typeof formState[expandedField] === "object" &&
                  formState[expandedField] !== null
                    ? JSON.stringify(formState[expandedField], null, 2)
                    : formState && formState[expandedField] !== undefined
                    ? String(formState[expandedField])
                    : ""
                }
                id={`${expandedField}-expanded`}
                name={expandedField || "expanded-field"}
                autoComplete="off"
                readOnly={!editable}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    [expandedField]: e.target.value,
                  })
                }
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
        {/* Delete confirmation modal (two-step) */}
        {showDeleteModal && formState && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div
              className={`rounded-lg shadow-lg max-w-md w-full p-6 ${
                deleteStep === 2
                  ? "bg-red-600 text-white"
                  : "bg-white text-black"
              }`}
            >
              {deleteStep === 1 ? (
                <>
                  <h3 className="text-xl font-bold mb-2">Confirm Delete</h3>
                  <p className="mb-4">
                    Are you sure you want to delete the case{" "}
                    <strong>
                      {String((formState as Record<string, unknown>)["id"])}
                    </strong>
                    ?
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => setShowDeleteModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="bg-yellow-500 text-black hover:bg-yellow-600"
                      onClick={() => setDeleteStep(2)}
                    >
                      Proceed to Delete
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-xl font-bold mb-2">Final Confirmation</h3>
                  <p className="mb-4">
                    This action is irreversible. Deleting the case will remove
                    it from the system permanently.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setDeleteStep(1);
                      }}
                    >
                      Back
                    </Button>
                    <Button
                      className="ml-auto bg-white text-red-600 hover:bg-red-100"
                      onClick={async () => {
                        if (!formState?.id) return;
                        try {
                          setIsDeleting(true);
                          const resp = await axios.delete(
                            `/api/cases?id=${encodeURIComponent(
                              String(
                                (formState as Record<string, unknown>)["id"]
                              )
                            )}`
                          );
                          const respData = resp.data as unknown;
                          const respObj = respData as Record<string, unknown>;
                          if (respObj && respObj["success"]) {
                            // remove from local list
                            const next = cases.filter(
                              (c) =>
                                String((c as Record<string, unknown>)["id"]) !==
                                String(formState.id)
                            );
                            setCases(next as Record<string, unknown>[]);
                            const newIndex = Math.max(
                              0,
                              Math.min(currentIndex, next.length - 1)
                            );
                            setCurrentIndex(newIndex);
                            setFormState(
                              next[newIndex]
                                ? (next[newIndex] as Record<string, unknown>)
                                : null
                            );
                            setShowDeleteModal(false);
                            setEditable(false);
                          } else {
                            const errMsg =
                              typeof respObj["error"] === "string"
                                ? String(respObj["error"])
                                : undefined;
                            throw new Error(errMsg ?? "Delete failed");
                          }
                        } catch (err) {
                          console.error("Error deleting case:", err);
                          alert(
                            "Error deleting case. See console for details."
                          );
                        } finally {
                          setIsDeleting(false);
                        }
                      }}
                      disabled={isDeleting}
                    >
                      {isDeleting ? "Deleting..." : "Delete Case"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
