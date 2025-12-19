"use client";

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getAttemptsByUserId } from '@/features/attempts/services/attemptService';
import { supabase } from '@/lib/supabase';
import { Attempt } from '@/features/attempts/models/attempt';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import StudentFeedback from '@/features/professor/components/StudentFeedback';
import AssignCaseDialog from '@/features/professor/components/AssignCaseDialog';
import { professorService } from '@/features/professor/services/professorService';

export default function StudentDetailsPage() {
  const params = useParams();
  const studentId = params.id as string;
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [assignedCases, setAssignedCases] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        // Fetch student profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', studentId)
          .single();
        
        setStudent(profile);

        // Fetch attempts
        const data = await getAttemptsByUserId(studentId);
        setAttempts(data);
        // fetch assigned cases
        try {
          const assigned = await professorService.getAssignedCasesForStudent(studentId);
          setAssignedCases(Array.isArray(assigned) ? assigned : []);
        } catch (e: any) {
          // Treat failures as empty assigned-cases list to avoid noisy console errors
          setAssignedCases([]);
          // Only log if there's meaningful information
          if (e && (e.message || (Object.keys(e).length > 0))) {
            console.warn('failed to load assigned cases', e);
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    if (studentId) {
      loadData();
    }
  }, [studentId]);

  if (loading) return <div className="p-8">Loading...</div>;
  if (!student) return <div className="p-8">Student not found</div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold">{student.full_name || student.email}</h1>
            <p className="text-muted-foreground">{student.email}</p>
        </div>
        <Button variant="outline" asChild>
            <Link href="/professor">Back to Dashboard</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attempts History</CardTitle>
        </CardHeader>
        <CardContent>
          {attempts.length === 0 ? (
            <p className="text-muted-foreground">No attempts yet.</p>
          ) : (
            <div className="space-y-4">
              {attempts.map((attempt) => (
                <div key={attempt.id} className="border p-4 rounded-lg flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold">{attempt.title}</h3>
                    <p className="text-sm text-gray-500">
                      {new Date(attempt.createdAt).toLocaleString()}
                    </p>
                    <div className="flex gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                            attempt.completionStatus === 'completed' ? 'bg-green-100 text-green-800' : 
                            attempt.completionStatus === 'abandoned' ? 'bg-red-100 text-red-800' : 
                            'bg-blue-100 text-blue-800'
                        }`}>
                            {attempt.completionStatus}
                        </span>
                        {attempt.professorFeedback && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                                Feedback Given
                            </span>
                        )}
                    </div>
                  </div>
                  <Button asChild>
                    <Link href={`/professor/students/${studentId}/attempts/${attempt.id}`}>
                        Review
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Assigned Cases</CardTitle>
          </CardHeader>
          <CardContent>
            {assignedCases.length === 0 ? (
              <p className="text-muted-foreground">No cases assigned.</p>
            ) : (
              <ul className="space-y-3">
                {assignedCases.map((ac: any) => (
                  <li key={ac.id} className="border p-3 rounded flex justify-between items-center">
                    <div>
                      <div className="font-semibold">{ac.case?.title}</div>
                      <div className="text-xs text-muted-foreground">{ac.case?.species} — {ac.case?.difficulty}</div>
                    </div>
                    <Button asChild size="sm">
                      <Link href={`/case/${ac.case_id}`}>Open</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Feedback & Messages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-3">
              <AssignCaseDialog studentId={studentId} onAssigned={async () => {
                  try {
                    const assigned = await professorService.getAssignedCasesForStudent(studentId);
                    setAssignedCases(Array.isArray(assigned) ? assigned : []);
                  } catch (e: any) {
                    setAssignedCases([]);
                    if (e && (e.message || (Object.keys(e).length > 0))) {
                      console.warn('failed to refresh assigned cases after assign', e);
                    }
                  }
                }} />
            </div>
            <StudentFeedback studentId={studentId} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
