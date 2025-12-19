"use client";

import React, { useEffect, useState } from "react";
import { Clock, Lock, FastForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CaseTimepoint } from "../models/caseTimepoint";
import axios from "axios";
import { useAuth } from "@/features/auth/services/authService";
import { cn } from "@/lib/utils";

type CaseTimelineProps = {
  caseId: string;
  elapsedSeconds: number; // Total time spent in simulation (in seconds)
  className?: string;
  onFastForward?: (targetSeconds: number) => void;
};

export function CaseTimeline({ caseId, elapsedSeconds, className, onFastForward }: CaseTimelineProps) {
  const { session } = useAuth();
  const [timepoints, setTimepoints] = useState<CaseTimepoint[]>([]);
  const [loading, setLoading] = useState(false);
  const isAdmin = session?.user?.user_metadata?.role === "admin" || session?.user?.user_metadata?.role === "professor";

  // Contextual help for Time Progression
  const timeProgressionHelp = (
    <div className="mb-4 p-4 rounded-lg bg-slate-800/80 text-slate-100 text-sm shadow">
      <strong>Time Progression Feature Explanation</strong>
      <ul className="list-disc ml-6 mt-2">
        <li>Each case is divided into timepoints (stages or checkpoints).</li>
        <li>As the user progresses, the app updates the context to reflect the new timepoint (e.g., new symptoms, lab results, or events).</li>
        <li>The AI and UI update to show only relevant information for the current timepoint.</li>
        <li>Advancing time triggers new prompts, system messages, and sometimes new actions or decisions.</li>
        <li>This allows simulation of real clinical progression, decision-making, and evolving patient status.</li>
      </ul>
      <div className="mt-2">
        <strong>How Fake Time Works in Conversation Flow</strong>
        <ul className="list-disc ml-6 mt-2">
          <li>"Fake time" means the simulation advances through key clinical moments, not real clock time.</li>
          <li>Each timepoint represents a new stage in the case, such as exam, diagnosis, or treatment.</li>
          <li>When you advance time, the conversation and available actions update to match the new stage.</li>
        </ul>
      </div>
      <div className="mt-2">
        <strong>Student Experience</strong>
        <ul className="list-disc ml-6 mt-2">
          <li>Students interact with the case as if it unfolds in real time, making decisions at each stage.</li>
          <li>They receive feedback, new information, and prompts as the case progresses.</li>
          <li>This approach helps students practice clinical reasoning and adapt to evolving scenarios.</li>
        </ul>
      </div>
    </div>
  );

  useEffect(() => {
    if (caseId) {
      fetchTimepoints();
    }
  }, [caseId]);

  const fetchTimepoints = async () => {
    setLoading(true);
    try {
      const token = session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`/api/cases/${caseId}/timepoints`, { headers });
      setTimepoints(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch timepoints", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;
  if (timepoints.length === 0) return null;

  // Calculate status for each timepoint
  const timelineItems = [
    {
      id: "start",
      label: "Day 1",
      summary: "Initial Presentation",
      isUnlocked: true,
      available_after_hours: 0,
    },
    ...timepoints.map(tp => {
      const requiredSeconds = (tp.available_after_hours || 0) * 3600;
      const isUnlocked = elapsedSeconds >= requiredSeconds;
      return (
        <div className={cn("w-full", className)}>
          {timeProgressionHelp}
          {/* ...existing code... */}
        </div>
      );
  ];

  return (
    <div className={cn("bg-card border rounded-lg p-4", className)}>
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
        <Clock className="h-4 w-4" />
        Timeline
      </h3>
      <div className="relative border-l-2 border-muted ml-2 space-y-6 pl-4 py-1">
        {timelineItems.map((item) => (
          <div key={item.id} className="relative">
            <div className={cn(
              "absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2",
              item.isUnlocked ? "bg-primary border-primary" : "bg-muted border-muted-foreground"
            )} />
            
            <div className={cn("transition-opacity", item.isUnlocked ? "opacity-100" : "opacity-50")}>
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{item.label}</span>
                {!item.isUnlocked && <Lock className="h-3 w-3 text-muted-foreground" />}
                {!item.isUnlocked && onFastForward && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 px-2 ml-auto text-xs" 
                    title="Advance to this timepoint"
                    onClick={() => onFastForward((item.available_after_hours || 0) * 3600)}
                  >
                    <FastForward className="h-3 w-3 mr-1" />
                    Advance
                  </Button>
                )}
              </div>
              {item.summary && (
                <p className="text-xs text-muted-foreground mt-1">{item.summary}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
