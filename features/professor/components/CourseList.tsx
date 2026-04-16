"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Archive, ArchiveRestore } from "lucide-react";
import { useAuth } from "@/features/auth/services/authService";
import { EditCourseDialog } from "./EditCourseDialog";
import axios from "axios";

type CourseItem = {
  id: string;
  name: string;
  description: string;
  studentCount: number;
  created_at: string;
  archived?: boolean;
};

type Props = {
  refreshKey?: number;
};

export function CourseList({ refreshKey }: Props) {
  const { session } = useAuth();
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const resp = await axios.get("/api/professor/courses", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      setCourses(resp.data);
    } catch (err) {
      console.error("Failed to load courses", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.access_token) fetchCourses();
  }, [session?.access_token, refreshKey]);

  const handleDelete = async (courseId: string) => {
    if (!confirm("Delete this course? Students will not be removed, only the course grouping.")) return;
    try {
      await axios.delete(`/api/professor/courses/${courseId}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      fetchCourses();
    } catch (err) {
      console.error("Failed to delete course:", err);
      alert("Failed to delete course.");
    }
  };

  const handleArchive = async (courseId: string, archive: boolean) => {
    try {
      await axios.patch(`/api/professor/courses/${courseId}`, { archived: archive }, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      fetchCourses();
    } catch (err) {
      console.error("Failed to update course:", err);
      alert("Failed to update course.");
    }
  };

  if (loading) return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-8 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const filtered = courses.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      c.name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q);
    const matchesArchive = showArchived ? true : !c.archived;
    return matchesSearch && matchesArchive;
  });

  if (courses.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No courses yet. Create your first course to organize students into groups.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search courses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {courses.some((c) => c.archived) && (
          <Button
            variant={showArchived ? "default" : "outline"}
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? "Hide Archived" : "Show Archived"}
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          {searchQuery ? "No courses match your search." : "No active courses."}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Card key={c.id} className={`hover:shadow-md transition-shadow ${c.archived ? "opacity-60" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm truncate">{c.name}</h3>
                    {c.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {c.description}
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {c.studentCount} student{c.studentCount !== 1 ? "s" : ""}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Link href={`/professor/courses/${c.id}`} className="flex-1">
                    <Button size="sm" variant="outline" className="w-full">
                      View Dashboard
                    </Button>
                  </Link>
                  <EditCourseDialog
                    courseId={c.id}
                    currentName={c.name}
                    currentDescription={c.description}
                    onUpdated={fetchCourses}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleArchive(c.id, !c.archived)}
                    title={c.archived ? "Restore course" : "Archive course"}
                  >
                    {c.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => handleDelete(c.id)}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default CourseList;
