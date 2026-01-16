"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { professorService } from "../services/professorService";
import { useAuth } from "@/features/auth/services/authService";
import { Loader2 } from "lucide-react";

export function ProfessorAnalytics() {
  const { user } = useAuth();
  const [stats, setStats] = useState<{
    totalAttempts: number;
    completionRate: number;
    completedAttempts: number;
    avgTime: number;
  }>({ totalAttempts: 0, completionRate: 0, completedAttempts: 0, avgTime: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      if (!user) return;
      try {
        const data = await professorService.getClassStats(user.id);
        if (data) setStats(data);
      } catch (error) {
        console.error("Failed to load stats", error);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, [user]);

  return (
    <>
      <Card className="min-h-36 p-2 h-full transition-all duration-300 ease-out hover:bg-muted/100 dark:hover:bg-muted/80 shadow-lg bg-muted/50 border border-transparent border-teal-500/30">
        <CardHeader className="pb-1 grow text-center px-3">
          <CardTitle className="text-sm font-medium text-muted-foreground text-teal-600">
            Total Attempts
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2 px-3">
          {loading ? (
            <Loader2 className="animate-spin" />
          ) : (
            <div className="text-lg font-semibold">{stats.totalAttempts}</div>
          )}
        </CardContent>
      </Card>

      <Card className="min-h-36 p-2 h-full transition-all duration-300 ease-out hover:bg-muted/100 dark:hover:bg-muted/80 shadow-lg bg-muted/50 border border-transparent border-teal-500/30">
        <CardHeader className="pb-1 grow text-center px-3">
          <CardTitle className="text-sm font-medium text-teal-600">
            Completion Rate
          </CardTitle>
        </CardHeader>

        <CardContent className="py-2 px-3">
          {loading ? (
            <Loader2 className="animate-spin" />
          ) : (
            <>
              <div className="text-lg font-semibold">
                {stats.completionRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.completedAttempts} completed
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="min-h-36 p-2 h-full transition-all duration-300 ease-out hover:bg-muted/100 dark:hover:bg-muted/80 shadow-lg bg-muted/50 border border-transparent border-teal-500/30">
        <CardHeader className="pb-1 grow text-center px-3">
          <CardTitle className="text-sm font-medium text-muted-foreground text-teal-600">
            Avg. Time Spent
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2 px-3">
          {loading ? (
            <Loader2 className="animate-spin" />
          ) : (
            <div className="text-lg font-semibold">
              {Math.round(stats.avgTime / 60)} min
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
