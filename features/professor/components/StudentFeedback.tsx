"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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

  const load = async () => {
    try {
      const data = await professorService.getFeedbackForStudent(studentId);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load feedback", err);
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
        {items.length === 0 ? (
          <div className="text-muted-foreground">No feedback yet.</div>
        ) : (
          items.map((fb) => (
            <div key={fb.id} className="border rounded p-3 bg-slate-900/60">
              <div className="text-xs text-muted-foreground">{new Date(fb.created_at).toLocaleString()}</div>
              <div className="mt-1">{fb.message}</div>
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <input
          className="flex-1 rounded border px-3 py-2 bg-slate-800/50"
          placeholder="Write feedback or a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <Button onClick={send} disabled={loading || !message.trim()}>
          Send
        </Button>
      </div>
    </div>
  );
}
