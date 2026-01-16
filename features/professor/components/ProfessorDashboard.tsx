"use client";

import React from "react";
import { useProfessor } from "../hooks/useProfessor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CreateStudentDialog } from "./CreateStudentDialog";
import { ProfessorAnalytics } from "./ProfessorAnalytics";

export function ProfessorDashboard() {
  const { cases, students, loading, isProfessor, error } = useProfessor();

  if (!isProfessor) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
        <p>You must be a professor to view this page.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="p-8">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Professor Dashboard</h1>
        <div className="space-x-2">
          <CreateStudentDialog />
          <Button asChild variant="outline">
            <Link href="/case-entry">Create New Case</Link>
          </Button>
          <Button asChild>
            <Link href="/case-selection">Browse Cases to Assign</Link>
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 items-start mt-4">
            <ProfessorAnalytics />

            <Card className="min-h-36 p-2 h-full transition-all duration-300 ease-out hover:bg-muted/100 dark:hover:bg-muted/80 shadow-lg bg-muted/50 border border-transparent border-teal-500/30">
              <CardHeader className="pb-1 grow text-center px-3">
                <CardTitle className="text-sm font-medium text-muted-foreground text-teal-600">
                  Total Assigned Cases
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2 px-3">
                <div className="text-lg font-semibold">{cases.length}</div>
              </CardContent>
            </Card>
            <Card className=" min-h-36 p-2 h-full transition-all duration-300 ease-out hover:bg-muted/100 dark:hover:bg-muted/80 shadow-lg bg-muted/50 border border-transparent border-teal-500/30">
              <CardHeader className="pb-1 grow text-center px-3">
                <CardTitle className="text-sm font-medium text-muted-foreground text-teal-600">
                  Total Students
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2 px-3">
                <div className="text-lg font-semibold">{students.length}</div>
              </CardContent>
            </Card>
            <Card className="min-h-36 p-2 h-full transition-all duration-300 ease-out hover:bg-muted/100 dark:hover:bg-muted/80 shadow-lg bg-muted/50 border border-transparent border-teal-500/30">
              <CardHeader className="pb-1 grow text-center px-3">
                <CardTitle className="text-sm font-medium text-muted-foreground text-teal-600">
                  Pending Reviews
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2 px-3">
                <div className="text-lg font-semibold">
                  0
                  <span className="text-xs text-muted-foreground ps-2">
                    (Coming soon)
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* My Cases Section */}
        <Card>
          <CardHeader>
            <CardTitle>My Assigned Cases</CardTitle>
          </CardHeader>
          <CardContent>
            {cases.length === 0 ? (
              <p className="text-muted-foreground">No cases assigned yet.</p>
            ) : (
              <ul className="space-y-4">
                {cases.map((item) => (
                  <li
                    key={item.id}
                    className="border p-4 rounded-lg flex justify-between items-center"
                  >
                    <div>
                      <h3 className="font-semibold">
                        {item.case?.title || "Unknown Case"}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {item.case?.species} - {item.case?.difficulty}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/case/${item.case_id}`}>View</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* My Students Section */}
        <Card>
          <CardHeader>
            <CardTitle>My Students</CardTitle>
          </CardHeader>
          <CardContent>
            {students.length === 0 ? (
              <p className="text-muted-foreground">No students assigned yet.</p>
            ) : (
              <ul className="space-y-4">
                {students.map((item) => (
                  <li
                    key={item.id}
                    className="border p-4 rounded-lg flex items-center gap-4"
                  >
                    {item.student?.avatar_url && (
                      <img
                        src={item.student.avatar_url}
                        alt="Avatar"
                        className="w-10 h-10 rounded-full"
                      />
                    )}
                    <div>
                      <h3 className="font-semibold">
                        {item.student?.full_name || "Unknown Student"}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {item.student?.email}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="ml-auto"
                    >
                      <Link href={`/professor/students/${item.student_id}`}>
                        View Progress
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
