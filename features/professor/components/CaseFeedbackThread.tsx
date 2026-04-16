"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, MessageSquare } from "lucide-react";
import { useAuth } from "@/features/auth/services/authService";

type FeedbackMessage = {
  id: string;
  professor_id: string;
  student_id: string;
  message: string;
  sender_role: string;
  case_id: string | null;
  created_at: string;
};

type Props = {
  professorId: string;
  studentId: string;
  caseId: string;
  caseTitle?: string;
};

export function CaseFeedbackThread({ professorId, studentId, caseId, caseTitle }: Props) {
  const { session } = useAuth();
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const loadMessages = async () => {
    try {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

      const resp = await fetch(
        `/api/professor-feedback?studentId=${encodeURIComponent(studentId)}&caseId=${encodeURIComponent(caseId)}`,
        { headers }
      );
      if (resp.ok) {
        const json = await resp.json();
        setMessages(Array.isArray(json.feedback) ? json.feedback : []);
      }
    } catch (err) {
      console.warn("Failed to load case feedback:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [studentId, caseId, session?.access_token]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    setSending(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

      const resp = await fetch("/api/professor-feedback", {
        method: "POST",
        headers,
        body: JSON.stringify({
          professorId,
          studentId,
          message: newMessage.trim(),
          caseId,
          senderRole: "professor",
        }),
      });
      if (resp.ok) {
        setNewMessage("");
        await loadMessages();
      } else {
        console.error("Failed to send case feedback:", await resp.text());
      }
    } catch (err) {
      console.error("Error sending case feedback:", err);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading feedback...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {messages.length === 0 ? (
        <p className="text-xs text-muted-foreground">No feedback yet for this case.</p>
      ) : (
        <div className="max-h-48 overflow-auto space-y-2">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-2 rounded-md border text-sm ${
                msg.sender_role === "student"
                  ? "bg-blue-50 border-blue-200 ml-6"
                  : "bg-background mr-6"
              }`}
            >
              <div className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-1.5">
                <span className="font-medium">
                  {msg.sender_role === "student" ? "Student" : "You"}
                </span>
                <span>{new Date(msg.created_at).toLocaleString()}</span>
              </div>
              <div className="whitespace-pre-wrap text-xs">{msg.message}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <textarea
          className="flex-1 rounded-md border px-2 py-1.5 text-xs resize-none bg-background"
          placeholder="Write case-specific feedback..."
          rows={2}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button size="sm" onClick={handleSend} disabled={sending || !newMessage.trim()} className="self-end">
          {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageSquare className="h-3 w-3" />}
        </Button>
      </div>
    </div>
  );
}

export default CaseFeedbackThread;
