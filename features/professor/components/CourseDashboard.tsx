"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/services/authService";
import axios from "axios";
import type { CourseStats } from "../models/courseTypes";
import { CourseStatsCards } from "./charts/CourseStatsCards";
import { CompletionByCaseChart } from "./charts/CompletionByCaseChart";
import { CompletionTrendsChart } from "./charts/CompletionTrendsChart";
import { CourseStudentsTable } from "./CourseStudentsTable";
import { AddStudentsToCourseDialog } from "./AddStudentsToCourseDialog";
import { AssignCaseToCourseDialog } from "./AssignCaseToCourseDialog";
import { Download } from "lucide-react";
import { generateCSV, downloadCSV } from "../utils/csvExport";

type Props = {
  courseId: string;
};

export function CourseDashboard({ courseId }: Props) {
  const { session } = useAuth();
  const [stats, setStats] = useState<CourseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!session?.access_token) return;
    (async () => {
      setLoading(true);
      try {
        const resp = await axios.get(
          `/api/professor/courses/${courseId}/stats`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        );
        setStats(resp.data);
      } catch (err) {
        console.error("Failed to load course stats:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [courseId, session?.access_token, refreshKey]);

  const refresh = () => setRefreshKey((k) => k + 1);

  const exportStudentStats = () => {
    if (!stats) return;
    const csv = generateCSV(
      ["Student", "Email", "Completed", "Total Attempts", "Avg Time (min)", "Last Active"],
      stats.perStudent.map((s) => [
        s.fullName,
        s.email,
        String(s.completedAttempts),
        String(s.totalAttempts),
        s.avgTimeSeconds > 0 ? String(Math.round(s.avgTimeSeconds / 60)) : "—",
        s.lastActivityAt ? new Date(s.lastActivityAt).toLocaleDateString() : "Never",
      ])
    );
    downloadCSV("student-stats.csv", csv);
  };

  const exportCaseStats = () => {
    if (!stats) return;
    const csv = generateCSV(
      ["Case", "Students Completed", "Students Assigned", "Completion %"],
      stats.perCase.map((c) => [
        c.caseTitle,
        String(c.studentsCompleted),
        String(c.studentsAssigned),
        c.studentsAssigned > 0 ? String(Math.round((c.studentsCompleted / c.studentsAssigned) * 100)) : "0",
      ])
    );
    downloadCSV("case-stats.csv", csv);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-4 space-y-2">
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-6 w-3/4" />
            </Card>
          ))}
        </div>
        <Skeleton className="h-10 w-64" />
        <Card>
          <CardContent className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!stats) {
    return <p className="text-red-600">Failed to load course data.</p>;
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <CourseStatsCards
        totalStudents={stats.totalStudents}
        studentsWithCompleted={stats.studentsWithCompletedAttempt}
        completionRate={stats.completionRate}
        avgTimeSeconds={stats.avgTimeSeconds}
        totalAttempts={stats.totalAttempts}
        completedAttempts={stats.completedAttempts}
      />

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        <AddStudentsToCourseDialog courseId={courseId} onAdded={refresh} />
        <AssignCaseToCourseDialog courseId={courseId} onAssigned={refresh} />
        <Button size="sm" variant="outline" onClick={exportStudentStats}>
          <Download className="mr-1 h-4 w-4" /> Student Stats
        </Button>
        <Button size="sm" variant="outline" onClick={exportCaseStats}>
          <Download className="mr-1 h-4 w-4" /> Case Stats
        </Button>
      </div>

      {/* Tabbed content */}
      <Tabs defaultValue="students">
        <TabsList>
          <TabsTrigger value="students">
            Students
            {stats.perStudent.filter((s) => s.completedAttempts === 0).length > 0 && (
              <Badge variant="destructive" className="ml-2 text-[10px] px-1.5 py-0">
                {stats.perStudent.filter((s) => s.completedAttempts === 0).length} need support
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="cases">Cases</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Student Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <CourseStudentsTable students={stats.perStudent} courseId={courseId} onStudentsChanged={refresh} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cases" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Case Completion</CardTitle>
            </CardHeader>
            <CardContent>
              <CompletionByCaseChart data={stats.perCase} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Completion Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <CompletionTrendsChart courseId={courseId} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default CourseDashboard;
