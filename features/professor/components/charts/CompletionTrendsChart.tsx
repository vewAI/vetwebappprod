"use client";

import React, { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/services/authService";
import axios from "axios";

type TrendPoint = {
  period: string;
  completions: number;
  totalAttempts: number;
};

type Props = {
  courseId: string;
};

export function CompletionTrendsChart({ courseId }: Props) {
  const { session } = useAuth();
  const [data, setData] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.access_token) return;
    (async () => {
      try {
        const resp = await axios.get(
          `/api/professor/courses/${courseId}/completions-over-time`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        );
        setData(resp.data.trends);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, [courseId, session?.access_token]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No attempt data available yet for trends.
      </p>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis dataKey="period" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="completions"
            name="Completions"
            stroke="#14b8a6"
            strokeWidth={2}
            dot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="totalAttempts"
            name="Total Attempts"
            stroke="#94a3b8"
            strokeWidth={2}
            dot={{ r: 4 }}
            strokeDasharray="5 5"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default CompletionTrendsChart;
