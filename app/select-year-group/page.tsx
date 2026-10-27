"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/services/authService";
import { getAccessToken } from "@/lib/auth-headers";
import { formatAcademicYearEnd, type YearGroup } from "@/features/year-groups/models/yearGroup";

export default function SelectYearGroupPage() {
  const router = useRouter();
  const { role, yearGroupId, institutionId, refreshProfile, profileLoading, loading } = useAuth();
  const [yearGroups, setYearGroups] = useState<YearGroup[]>([]);
  const [academicYearEnd, setAcademicYearEnd] = useState<{ month: number; day: number } | null>(null);
  const [apiInstitutionId, setApiInstitutionId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const linkedInstitutionId = institutionId || apiInstitutionId;

  useEffect(() => {
    if (loading || profileLoading) return;
    if (role !== "student") {
      router.replace("/dashboard");
    }
  }, [loading, profileLoading, role, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingGroups(true);
      setError(null);
      try {
        const token = await getAccessToken();
        const res = await axios.get<{
          yearGroups: YearGroup[];
          academicYearEnd?: { month: number; day: number } | null;
          institutionId?: string | null;
        }>("/api/year-groups", { headers: { Authorization: `Bearer ${token}` } });
        if (cancelled) return;
        setYearGroups(res.data.yearGroups ?? []);
        setAcademicYearEnd(res.data.academicYearEnd ?? null);
        setApiInstitutionId(res.data.institutionId ?? null);
      } catch (err: unknown) {
        if (cancelled) return;
        const errorObj = err as { response?: { data?: { error?: string } }; message?: string };
        setError(errorObj.response?.data?.error || errorObj.message || "Failed to load year groups");
      } finally {
        if (!cancelled) setLoadingGroups(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = await getAccessToken();
      await axios.post(
        "/api/profile/year-group",
        { yearGroupId: selectedId },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      await refreshProfile();
      router.push("/student");
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } }; message?: string };
      setError(errorObj.response?.data?.error || errorObj.message || "Failed to save year group");
    } finally {
      setSubmitting(false);
    }
  };

  const endLabel = academicYearEnd
    ? formatAcademicYearEnd(academicYearEnd.month, academicYearEnd.day)
    : formatAcademicYearEnd(7, 31);

  return (
    <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 pb-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-xl font-semibold text-primary">Select your year group</CardTitle>
        </CardHeader>
        <CardContent>
          {loading || profileLoading || loadingGroups ? (
            <p className="text-sm text-muted-foreground">Loading year groups...</p>
          ) : error && !linkedInstitutionId ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : !linkedInstitutionId ? (
            <p className="text-sm text-muted-foreground">
              Your account is not linked to an institution. Ask an administrator to assign one before you can select a
              year group.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-muted-foreground">This academic year ends on {endLabel}.</p>
              {yearGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No year groups are available yet. Ask an administrator to create them for your institution.
                </p>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="year-group">Year group</Label>
                  <select
                    id="year-group"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                    required
                    disabled={Boolean(yearGroupId)}
                  >
                    <option value="">— Select year group —</option>
                    {yearGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={submitting || !selectedId || Boolean(yearGroupId)}>
                {submitting ? "Saving..." : "Continue"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
