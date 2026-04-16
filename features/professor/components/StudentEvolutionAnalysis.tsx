"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/services/authService";
import axios from "axios";
import { Loader2 } from "lucide-react";

type Props = {
  studentId: string;
  studentName: string;
};

export function StudentEvolutionAnalysis({ studentId, studentName }: Props) {
  const { session } = useAuth();
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    setAnalysis(null);
    try {
      const resp = await axios.post(
        "/api/professor/student-evolution",
        { studentId },
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      setAnalysis(resp.data.analysis ?? resp.data.error ?? "No analysis available.");
    } catch (err) {
      const msg =
        axios.isAxiosError(err)
          ? err.response?.data?.error ?? err.message
          : "Failed to generate analysis.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Student Evolution Analysis</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              AI-powered review of {studentName}&apos;s progress across all completed cases.
            </p>
          </div>
          <Button onClick={analyze} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              "Analyze Evolution"
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}
        {loading && !analysis && (
          <div className="flex items-center gap-3 p-4 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>
              Analyzing {studentName}&apos;s case history and AI feedback...
              This may take a moment.
            </span>
          </div>
        )}
        {analysis && (
          <div className="prose prose-sm dark:prose-invert max-w-none rounded-md bg-muted/30 p-4 whitespace-pre-wrap">
            {analysis}
          </div>
        )}
        {!analysis && !loading && !error && (
          <p className="text-sm text-muted-foreground">
            Click &quot;Analyze Evolution&quot; to generate an AI-powered analysis of this
            student&apos;s progression across their completed cases.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default StudentEvolutionAnalysis;
