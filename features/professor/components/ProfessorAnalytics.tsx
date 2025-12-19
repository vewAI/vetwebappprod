"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { professorService } from '../services/professorService';
import { useAuth } from '@/features/auth/services/authService';
import { Loader2 } from 'lucide-react';

export function ProfessorAnalytics() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      if (!user) return;
      try {
        const data = await professorService.getClassStats(user.id);
        setStats(data);
      } catch (error) {
        console.error("Failed to load stats", error);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, [user]);

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
  }

  if (!stats) {
    return <div className="p-4 text-muted-foreground">No data available yet.</div>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 items-start">
      <Card className="p-2">
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-medium text-muted-foreground">Total Attempts</CardTitle>
        </CardHeader>
        <CardContent className="py-2 px-3">
          <div className="text-lg font-semibold">{stats.totalAttempts}</div>
        </CardContent>
      </Card>

      <Card className="p-2">
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-medium text-muted-foreground">Completion Rate</CardTitle>
        </CardHeader>
        <CardContent className="py-2 px-3">
          <div className="text-lg font-semibold">{stats.completionRate.toFixed(1)}%</div>
          <p className="text-xs text-muted-foreground">{stats.completedAttempts} completed</p>
        </CardContent>
      </Card>

      <Card className="p-2">
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-medium text-muted-foreground">Avg. Time Spent</CardTitle>
        </CardHeader>
        <CardContent className="py-2 px-3">
          <div className="text-lg font-semibold">{Math.round(stats.avgTime / 60)} min</div>
        </CardContent>
      </Card>

      {/* Fillers for compact layout on wide screens */}
      <div className="hidden md:block" />
      <div className="hidden md:block" />
      <div className="hidden md:block" />
    </div>
  );
}
