"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import axios from "axios";

export default function CaseViewerPage() {
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
  if (!cases.length) return <div className="p-8 text-center">No cases found.</div>;

  const currentCase = cases[currentIndex];

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Case Viewer</h1>
      <div className="mb-4 flex justify-between">
        <Button onClick={handlePrev} disabled={currentIndex === 0}>
          ← Prev
        </Button>
        <span className="font-semibold">Case {currentIndex + 1} of {cases.length}</span>
        <Button onClick={handleNext} disabled={currentIndex === cases.length - 1}>
          Next →
        </Button>
      </div>
      <form className="space-y-4">
        {Object.entries(currentCase).map(([key, value]) => (
          <div key={key}>
            <label className="block font-medium mb-1" htmlFor={key}>{key.replace(/_/g, " ")}</label>
            <input
              type="text"
              name={key}
              value={typeof value === "object" && value !== null ? JSON.stringify(value) : value !== undefined ? String(value) : ""}
              readOnly
              className="w-full bg-gray-100 dark:bg-gray-900 border rounded px-2 py-1"
            />
          </div>
        ))}
      </form>
    </div>
  );
}
