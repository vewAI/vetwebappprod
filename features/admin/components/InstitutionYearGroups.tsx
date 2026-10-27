"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAccessToken } from "@/lib/auth-headers";
import type { YearGroup } from "@/features/year-groups/models/yearGroup";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/features/navigation/components/table";

type InstitutionYearGroupsProps = {
  institutionId: string;
  userRole?: string;
  onSaved?: () => void;
  onSuccess?: (message: string) => void;
};

export function InstitutionYearGroups({
  institutionId,
  userRole,
  onSaved,
  onSuccess,
}: InstitutionYearGroupsProps) {
  const [yearGroups, setYearGroups] = useState<YearGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isAdmin = userRole === "admin";

  const fetchGroups = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await axios.get<{ yearGroups: YearGroup[] }>(
        `/api/admin/year-groups?institutionId=${encodeURIComponent(institutionId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setYearGroups(res.data.yearGroups ?? []);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } }; message?: string };
      setError(errorObj.response?.data?.error || errorObj.message || "Failed to load year groups");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [institutionId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = await getAccessToken();
      await axios.post(
        "/api/admin/year-groups",
        { institutionId, name: trimmed },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setName("");
      await fetchGroups();
      onSaved?.();
      onSuccess?.("Year group created.");
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } }; message?: string };
      setError(errorObj.response?.data?.error || errorObj.message || "Failed to create year group");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, groupName: string) => {
    if (!confirm(`Delete ${groupName}? Students in this year group will become unassigned.`)) return;
    setError(null);
    try {
      const token = await getAccessToken();
      await axios.delete(`/api/admin/year-groups?id=${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchGroups();
      onSaved?.();
      onSuccess?.("Year group deleted. Assigned students are now unassigned.");
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } }; message?: string };
      setError(errorObj.response?.data?.error || errorObj.message || "Failed to delete year group");
    }
  };

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}

      {isAdmin && (
        <form onSubmit={handleCreate} className="flex max-w-md items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label htmlFor="year-group-name">Name</Label>
            <Input
              id="year-group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Year 1"
              required
            />
          </div>
          <Button type="submit" disabled={submitting || !name.trim()}>
            {submitting ? "Adding..." : "Add"}
          </Button>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        <Table>
          <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
            <TableRow>
              <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                Name
              </TableCell>
              {isAdmin && (
                <TableCell isHeader className="px-5 py-3 text-end text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                  Actions
                </TableCell>
              )}
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
            {loading ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 2 : 1} className="px-5 py-6 text-center text-theme-sm text-gray-500">
                  Loading year groups...
                </TableCell>
              </TableRow>
            ) : yearGroups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 2 : 1} className="px-5 py-6 text-center text-theme-sm text-gray-500">
                  No year groups yet.
                </TableCell>
              </TableRow>
            ) : (
              yearGroups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell className="px-5 py-3 text-start text-theme-sm font-medium text-gray-800 dark:text-white/90">
                    {group.name}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="px-5 py-3 text-end">
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(group.id, group.name)}>
                        Delete
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
