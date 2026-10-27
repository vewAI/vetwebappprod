"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/features/auth/services/authService";
import { getAttemptsByCase } from "@/features/attempts/services/attemptService";
import { professorService } from "@/features/professor/services/professorService";
import { Button } from "@/components/ui/button";
import { fetchCaseById } from "@/features/case-selection/services/caseService";
import type { Case } from "@/features/case-selection/models/case";
import type { AttemptSummary } from "@/features/attempts/models/attempt";
import { CaseDetails } from "@/features/case-selection/components/CaseDetails";
import { CaseAttemptsTable } from "@/features/attempts/components/CaseAttemptsTable";
import { SessionsForCaseList } from "@/features/case-sessions/components/SessionsForCaseList";
import { Breadcrumb } from "@/features/navigation/components/breadcrumb";

interface ProfessorFeedbackItem {
  id: string;
  sender_role: string;
  created_at: string;
  message: string;
}

export default function CaseInstructionsPage() {
  const { id } = useParams() as { id: string };
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [assignedProfessorId, setAssignedProfessorId] = useState<string | null>(null);
  const [professorFeedback, setProfessorFeedback] = useState<ProfessorFeedbackItem[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [caseData, setCaseData] = useState<Case | null>(null);

  const recentAttempts = useMemo(
    () =>
      [...attempts]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 3),
    [attempts],
  );

  useEffect(() => {
    async function loadCase() {
      const result = await fetchCaseById(id);
      setCaseData(result);
    }
    loadCase();
  }, [id]);

  useEffect(() => {
    const loadAttempts = async () => {
      if (!user) return;

      setIsLoading(true);
      try {
        const caseAttempts = await getAttemptsByCase(id);
        setAttempts(caseAttempts);
      } catch (error) {
        console.error("Error loading attempts:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAttempts();
  }, [id, user]);

  useEffect(() => {
    let cancelled = false;
    async function loadAssignmentAndFeedback() {
      if (!user) return;
      try {
        const assigned = await professorService.getAssignedCasesForStudent(user.id);
        type AssignedCaseRow = {
          case_id?: string;
          case?: { id?: string };
          professor_id?: string;
          professorId?: string;
        };
        const match = Array.isArray(assigned)
          ? assigned.find((a: AssignedCaseRow) => a.case_id === id || a.case?.id === id)
          : null;
        const profId = match ? match.professor_id || match.professorId || null : null;
        if (!cancelled) setAssignedProfessorId(profId);
        if (profId) {
          const resp = await fetch(
            `/api/professor-feedback?studentId=${encodeURIComponent(user.id)}&caseId=${encodeURIComponent(id)}`,
            {
              headers: { Accept: "application/json" },
            },
          );
          if (resp.ok) {
            const json = await resp.json();
            if (!cancelled) setProfessorFeedback(Array.isArray(json.feedback) ? json.feedback : []);
          } else {
            console.warn("Failed to fetch professor feedback", await resp.text());
            if (!cancelled) setProfessorFeedback([]);
          }
        }
      } catch (err) {
        console.warn("Failed to load assignment/feedback", err);
      }
    }
    loadAssignmentAndFeedback();
    return () => {
      cancelled = true;
    };
  }, [user, id]);

  if (!caseData) {
    return (
      <div className="container mx-auto px-4 pb-8">
        <Breadcrumb
          items={[{ label: "Home", href: "/dashboard" }, { label: "Start", href: "/case-sessions" }, { label: "Case not found" }]}
        />
        <div className="py-12 text-center">
          <p className="text-lg">Case not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 pb-8">
      <Breadcrumb
        items={[
          { label: "Home", href: "/dashboard" },
          { label: "Start", href: "/case-sessions" },
          { label: caseData.title },
        ]}
      />

      <div className="mb-8">
        <CaseDetails caseData={caseData} />

        <div className="prose mt-6 max-w-none">
          <h2 className="mb-2 text-xl font-semibold">Instructions</h2>
          <p>
            In this clinical case, you will interact with a simulated client and patient. Work through the case by taking a
            history, performing a physical examination, and recommending diagnostic tests as appropriate.
          </p>
          <ul>
            <li>Proceed through each stage of the case in order</li>
            <li>You can save your progress at any time</li>
            <li>Once completed, you will receive feedback on your performance</li>
          </ul>
        </div>

        <div className="mt-8 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold text-primary">Latest Attempts</h2>
            {attempts.length > 3 && (
              <Link
                href={`/attempts?caseId=${encodeURIComponent(id)}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                View all {attempts.length} attempts
              </Link>
            )}
          </div>
          <CaseAttemptsTable
            attempts={recentAttempts}
            loading={isLoading}
            emptyMessage="You haven't attempted this case yet."
            sessionHrefBase="/case-sessions"
          />
        </div>

        <div className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-primary">Sessions</h2>
          <SessionsForCaseList caseId={id} variant="start" />
        </div>
      </div>

      {assignedProfessorId && (
        <div className="mt-6">
          <h3 className="mb-2 text-lg font-semibold">Professor Feedback</h3>
          {professorFeedback.length === 0 ? (
            <div className="text-sm text-muted-foreground">No feedback yet from your professor for this case.</div>
          ) : (
            <div className="space-y-3">
              {professorFeedback.map((f) => (
                <div
                  key={f.id}
                  className={`rounded-md border p-3 ${f.sender_role === "student" ? "ml-8 border-blue-200 bg-blue-50" : "bg-background"}`}
                >
                  <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium">{f.sender_role === "student" ? "You" : "Professor"}</span>
                    <span>{new Date(f.created_at).toLocaleString()}</span>
                  </div>
                  <div className="whitespace-pre-wrap text-sm">{f.message}</div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium">Message your professor</label>
            <textarea
              className="w-full rounded-md border px-3 py-2 text-sm"
              rows={4}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a message to your professor..."
            />
            <div className="mt-2 flex justify-end">
              <Button
                onClick={async () => {
                  if (!replyText.trim()) return;
                  setSendingReply(true);
                  try {
                    const studentId = user?.id;
                    if (!studentId) {
                      console.warn("Cannot send professor message: no authenticated user.");
                      setSendingReply(false);
                      return;
                    }

                    const resp = await fetch("/api/professor-feedback", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        professorId: assignedProfessorId,
                        studentId,
                        message: replyText,
                        caseId: id,
                        senderRole: "student",
                      }),
                    });
                    if (resp.ok) {
                      setReplyText("");
                      const json = await resp.json();
                      setProfessorFeedback((prev) => [json.feedback, ...prev]);
                    } else {
                      console.error("Failed to send message to professor", await resp.text());
                    }
                  } catch (err) {
                    console.error("Error sending professor message", err);
                  } finally {
                    setSendingReply(false);
                  }
                }}
                disabled={sendingReply}
              >
                {sendingReply ? "Sending..." : "Send"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
