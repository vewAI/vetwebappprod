"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { updateProfessorFeedback } from "@/features/attempts/services/attemptService";
import {
  Attempt,
  AttemptMessage,
  AttemptFeedback,
} from "@/features/attempts/models/attempt";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";

export default function ReviewAttemptPage() {
  const params = useParams();
  const studentId = params.id as string;
  const attemptId = params.attemptId as string;

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [messages, setMessages] = useState<AttemptMessage[]>([]);
  const [feedback, setFeedback] = useState<AttemptFeedback[]>([]);
  const [profFeedback, setProfFeedback] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const resp = await fetch(
          `/api/admin/attempts?attemptId=${encodeURIComponent(attemptId)}`,
          {
            headers: { Accept: "application/json" },
          }
        );
        if (!resp.ok) {
          console.error(
            "Failed to load attempt via admin API",
            await resp.text()
          );
          setLoading(false);
          return;
        }
        const json = await resp.json();
        const { attempt, messages: msgs, feedback: fb } = json;
        if (attempt) {
          setAttempt(attempt);
          setMessages(Array.isArray(msgs) ? msgs : []);
          setFeedback(Array.isArray(fb) ? fb : []);
          setProfFeedback(
            attempt.professor_feedback || attempt.professorFeedback || ""
          );
        }
      } catch (err) {
        console.error("Error loading attempt via admin API", err);
      }
      setLoading(false);
    }
    load();
  }, [attemptId]);

  const handleSaveFeedback = async () => {
    setSaving(true);
    await updateProfessorFeedback(attemptId, profFeedback);
    setSaving(false);
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (!attempt) return <div className="p-8">Attempt not found</div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Review Attempt</h1>
        <Button variant="outline" asChild>
          <Link href={`/professor/students/${studentId}`}>Back to Student</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chat History */}
        <Card className="h-[600px] flex flex-col">
          <CardHeader>
            <CardTitle>Conversation History</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-3 rounded-lg ${
                  msg.role === "user" ? "bg-blue-50 ml-8" : "bg-gray-50 mr-8"
                }`}
              >
                <p className="text-xs font-semibold mb-1">
                  {msg.role === "user" ? "Student" : "AI"}
                </p>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* AI Feedback */}
          <Card>
            <CardHeader>
              <CardTitle>AI Feedback</CardTitle>
            </CardHeader>
            <CardContent>
              {attempt.overallFeedback ? (
                <div className="prose text-sm">{attempt.overallFeedback}</div>
              ) : (
                <p className="text-muted-foreground">
                  No overall feedback generated.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Professor Feedback */}
          <Card>
            <CardHeader>
              <CardTitle>Professor Feedback</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={profFeedback}
                onChange={(e) => setProfFeedback(e.target.value)}
                placeholder="Enter your feedback here..."
                rows={6}
              />
              <Button onClick={handleSaveFeedback} disabled={saving}>
                {saving ? "Saving..." : "Save Feedback"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
