"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/features/auth/services/authService";
import axios from "axios";
import { CourseDashboard } from "@/features/professor/components/CourseDashboard";

type CourseInfo = {
  id: string;
  name: string;
  description: string;
};

export default function CourseDashboardPage() {
  const params = useParams();
  const courseId = params.courseId as string;
  const { session } = useAuth();
  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.access_token || !courseId) return;
    (async () => {
      try {
        const resp = await axios.get(`/api/professor/courses/${courseId}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        setCourse(resp.data);
      } catch {
        setCourse({ id: courseId, name: "Course", description: "" });
      } finally {
        setLoading(false);
      }
    })();
  }, [courseId, session?.access_token]);

  if (loading) return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-9 w-32" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-4 space-y-2">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-6 w-3/4" />
          </Card>
        ))}
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/professor">
          <Button variant="ghost" size="sm">
            ← Back to Dashboard
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{course?.name ?? "Course Dashboard"}</h1>
          {course?.description && (
            <p className="text-sm text-muted-foreground mt-1">{course.description}</p>
          )}
        </div>
      </div>

      <CourseDashboard courseId={courseId} />
    </div>
  );
}
