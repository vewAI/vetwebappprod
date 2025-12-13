import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "@/features/auth/services/authService";
import type { CaseTimepoint } from "../models/caseTimepoint";

export function useCaseTimepoints(caseId: string) {
  const { session } = useAuth();
  const [timepoints, setTimepoints] = useState<CaseTimepoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!caseId) return;

    const fetchTimepoints = async () => {
      setLoading(true);
      try {
        const token = session?.access_token;
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get(`/api/cases/${caseId}/timepoints`, { headers });
        setTimepoints(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Failed to fetch timepoints", err);
        setError("Failed to load timepoints");
      } finally {
        setLoading(false);
      }
    };

    fetchTimepoints();
  }, [caseId, session]);

  return { timepoints, loading, error };
}
