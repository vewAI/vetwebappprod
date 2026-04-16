"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { professorService } from "../services/professorService";
import { useAuth } from "@/features/auth/services/authService";

type Props = {
  studentId: string;
};

export default function StudentFeedback({ studentId }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const load = async () => {
    setLoadingMessages(true);
    try {
      const data = await professorService.getFeedbackForStudent(studentId);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load feedback", err);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (studentId) void load();
  }, [studentId]);

  const send = async () => {
    if (!message.trim() || !user) return;
    setLoading(true);
    try {
      await professorService.postFeedback(user.id, studentId, message.trim());
      setMessage("");
      await load();
    } catch (err) {
      console.error("Failed to send feedback", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 max-h-64 overflow-auto">
        {loadingMessages && items.length === 0 ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading...
          </div>
        ) : items.length === 0 ? (
          <div className="text-muted-foreground">No feedback yet.</div>
        ) : (
          items.map((fb) => (
            <div
              key={fb.id}
              className={`border rounded p-3 ${
                fb.sender_role === "student"
                  ? "bg-blue-900/30 ml-6"
                  : "bg-slate-900/60 mr-6"
              }`}
            >
              <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
                <span className="font-medium">
                  {fb.sender_role === "student" ? "Student" : "You"}
                </span>
                <span>{new Date(fb.created_at).toLocaleString()}</span>
              </div>
              <div className="text-sm whitespace-pre-wrap">{fb.message}</div>
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <input
          className="flex-1 rounded border px-3 py-2 bg-slate-800/50 text-sm"
          placeholder="Write feedback or a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              send();
            }
          }}
        />
        <Button onClick={send} disabled={loading || !message.trim()} size="sm">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Send"}
        </Button>
      </div>
    </div>
  );
}
