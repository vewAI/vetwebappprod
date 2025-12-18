import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/features/auth/services/authService';
import { professorService } from '../services/professorService';
import { ProfessorCase, ProfessorStudent } from '../models/types';

export function useProfessor() {
  const { user, role } = useAuth();
  const [cases, setCases] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isProfessor = role === 'professor' || role === 'admin'; // Admins can act as professors usually

  const fetchCases = useCallback(async () => {
    if (!user || !isProfessor) return;
    try {
      setLoading(true);
      const data = await professorService.getProfessorCases(user.id);
      setCases(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, isProfessor]);

  const fetchStudents = useCallback(async () => {
    if (!user || !isProfessor) return;
    try {
      setLoading(true);
      const data = await professorService.getProfessorStudents(user.id);
      setStudents(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, isProfessor]);

  useEffect(() => {
    if (isProfessor) {
      fetchCases();
      fetchStudents();
    }
  }, [isProfessor, fetchCases, fetchStudents]);

  return {
    cases,
    students,
    loading,
    error,
    isProfessor,
    refreshCases: fetchCases,
    refreshStudents: fetchStudents,
    assignCase: async (caseId: string) => {
        if (!user) return;
        await professorService.assignCaseToProfessor(user.id, caseId);
        await fetchCases();
    },
    removeCase: async (caseId: string) => {
        if (!user) return;
        await professorService.removeCaseFromProfessor(user.id, caseId);
        await fetchCases();
    },
    createStudent: async (data: { email: string; password: string; fullName: string; institutionId?: string }) => {
        if (!user) return;
        await professorService.createStudent(user.id, data);
        await fetchStudents();
    }
  };
}
