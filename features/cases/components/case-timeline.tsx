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
      return {
        ...tp,
        isUnlocked,
      };
    })
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
