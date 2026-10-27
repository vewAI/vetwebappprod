"use client";

import React, { useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getAccessToken } from "@/lib/auth-headers";
import { InstitutionDomainsPanel } from "@/features/admin/components/InstitutionDomainsPanel";
import { InstitutionDefaultRoles } from "@/features/admin/components/InstitutionDefaultRoles";
import { InstitutionYearGroups } from "@/features/admin/components/InstitutionYearGroups";
import { formatAcademicYearEnd } from "@/features/year-groups/models/yearGroup";
import { SortHeader } from "@/features/navigation/components/sort-header";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/features/navigation/components/table";
import { useTableSort } from "@/features/navigation/hooks/useTableSort";
import { ChevronLeft } from "lucide-react";

export type Institution = {
  id: string;
  name: string;
  created_at: string;
  academic_year_end_month?: number;
  academic_year_end_day?: number;
};

const MONTH_OPTIONS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

type InstitutionSortKey = "name" | "created";

type InstitutionManagementProps = {
  institutions: Institution[];
  onRefresh: () => Promise<void>;
  userRole?: string;
  loading?: boolean;
  onViewChange?: (view: "list" | "detail") => void;
};

export function CreateInstitutionDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<void>;
}) {
  const [instName, setInstName] = useState("");
  const [instSubmitting, setInstSubmitting] = useState(false);

  const handleInstSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setInstSubmitting(true);
      const token = await getAccessToken();
      await axios.post(
        "/api/admin/institutions",
        { name: instName },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      onOpenChange(false);
      setInstName("");
      await onCreated();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      alert(error.response?.data?.error || error.message || "Failed to create institution");
    } finally {
      setInstSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) setInstName("");
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Institution</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleInstSubmit} className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={instName} onChange={(e) => setInstName(e.target.value)} required />
          </div>
          <Button type="submit" disabled={instSubmitting} className="w-full">
            {instSubmitting ? "Creating..." : "Create"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function InstitutionManagement({
  institutions,
  onRefresh,
  userRole,
  loading = false,
  onViewChange,
}: InstitutionManagementProps) {
  const [view, setView] = useState<"list" | "detail">("list");
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null);
  const [editName, setEditName] = useState("");
  const [yearEndMonth, setYearEndMonth] = useState(7);
  const [yearEndDay, setYearEndDay] = useState(31);
  const [nameSubmitting, setNameSubmitting] = useState(false);
  const [yearEndSubmitting, setYearEndSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isAdmin = userRole === "admin";

  const { sort, toggle, sorted } = useTableSort<Institution, InstitutionSortKey>(
    institutions,
    (institution, key) => {
      if (key === "name") return institution.name;
      return new Date(institution.created_at).getTime();
    },
    { key: "name", dir: "asc" },
  );

  const handleManageInstitution = (inst: Institution) => {
    setSelectedInstitution(inst);
    setEditName(inst.name);
    setYearEndMonth(inst.academic_year_end_month ?? 7);
    setYearEndDay(inst.academic_year_end_day ?? 31);
    setView("detail");
    onViewChange?.("detail");
  };

  const handleBack = () => {
    setSelectedInstitution(null);
    setView("list");
    onViewChange?.("list");
  };

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    window.setTimeout(() => setSuccessMessage(null), 4000);
  };

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstitution || editName.trim() === selectedInstitution.name) return;
    setNameSubmitting(true);
    setSuccessMessage(null);
    try {
      const token = await getAccessToken();
      const headers = { Authorization: `Bearer ${token}` };
      await axios.patch("/api/admin/institutions", { id: selectedInstitution.id, name: editName.trim() }, { headers });
      setSelectedInstitution((prev) => (prev ? { ...prev, name: editName.trim() } : null));
      await onRefresh();
      showSuccess("Institution name updated successfully.");
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      alert(error.response?.data?.error || error.message || "Failed to update institution name");
    } finally {
      setNameSubmitting(false);
    }
  };

  const handleYearEndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstitution) return;
    setYearEndSubmitting(true);
    setSuccessMessage(null);
    try {
      const token = await getAccessToken();
      const headers = { Authorization: `Bearer ${token}` };
      await axios.patch(
        "/api/admin/institutions",
        {
          id: selectedInstitution.id,
          academic_year_end_month: yearEndMonth,
          academic_year_end_day: yearEndDay,
        },
        { headers },
      );
      setSelectedInstitution((prev) =>
        prev ? { ...prev, academic_year_end_month: yearEndMonth, academic_year_end_day: yearEndDay } : null,
      );
      await onRefresh();
      showSuccess("Academic year end updated.");
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      alert(error.response?.data?.error || error.message || "Failed to update academic year end");
    } finally {
      setYearEndSubmitting(false);
    }
  };

  if (view === "detail" && selectedInstitution) {
    return (
      <div className="space-y-6">
        <div>
          <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1 -ml-2">
            <ChevronLeft className="h-4 w-4" />
            Back to institutions
          </Button>
        </div>

        {successMessage && (
          <div className="fixed top-6 right-6 z-50 rounded-md bg-green-600 px-4 py-2 text-sm text-white shadow-lg animate-in fade-in slide-in-from-top-2">
            {successMessage}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Institution name</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleNameSubmit} className="flex gap-2 items-end max-w-md">
              <div className="flex-1 space-y-1">
                <Label htmlFor="inst-name">Name</Label>
                <Input
                  id="inst-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={!isAdmin}
                />
              </div>
              {isAdmin && (
                <Button type="submit" disabled={nameSubmitting || editName.trim() === selectedInstitution.name}>
                  {nameSubmitting ? "Saving..." : "Save"}
                </Button>
              )}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Academic year end</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleYearEndSubmit} className="flex max-w-md flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="year-end-day">Day</Label>
                <Input
                  id="year-end-day"
                  type="number"
                  min={1}
                  max={31}
                  value={yearEndDay}
                  onChange={(e) => setYearEndDay(Number(e.target.value))}
                  disabled={!isAdmin}
                  className="w-24"
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label htmlFor="year-end-month">Month</Label>
                <select
                  id="year-end-month"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={yearEndMonth}
                  onChange={(e) => setYearEndMonth(Number(e.target.value))}
                  disabled={!isAdmin}
                >
                  {MONTH_OPTIONS.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </div>
              {isAdmin && (
                <Button
                  type="submit"
                  disabled={
                    yearEndSubmitting ||
                    (yearEndMonth === (selectedInstitution.academic_year_end_month ?? 7) &&
                      yearEndDay === (selectedInstitution.academic_year_end_day ?? 31))
                  }
                >
                  {yearEndSubmitting ? "Saving..." : "Save"}
                </Button>
              )}
            </form>
            <p className="mt-2 text-sm text-muted-foreground">
              Defaults to 31 July. Student year assignments are cleared overnight on{" "}
              {formatAcademicYearEnd(yearEndMonth, yearEndDay)}.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Year groups</CardTitle>
          </CardHeader>
          <CardContent>
            <InstitutionYearGroups
              institutionId={selectedInstitution.id}
              userRole={userRole}
              onSaved={onRefresh}
              onSuccess={showSuccess}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Domains</CardTitle>
          </CardHeader>
          <CardContent>
            <InstitutionDomainsPanel
              institutionId={selectedInstitution.id}
              onSaved={onRefresh}
              onSuccess={showSuccess}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Default roles</CardTitle>
          </CardHeader>
          <CardContent>
            <InstitutionDefaultRoles
              institutionId={selectedInstitution.id}
              userRole={userRole}
              onSaved={onRefresh}
              onSuccess={showSuccess}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
      <div className="max-w-full overflow-x-auto">
        <div className="min-w-[720px]">
          <Table>
            <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
              <TableRow>
                <SortHeader label="Name" column="name" sort={sort} onSort={toggle} />
                <SortHeader label="Created" column="created" sort={sort} onSort={toggle} />
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
                  <TableCell
                    colSpan={isAdmin ? 3 : 2}
                    className="px-5 py-8 text-center text-theme-sm text-gray-500 dark:text-gray-400"
                  >
                    Loading institutions...
                  </TableCell>
                </TableRow>
              ) : sorted.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={isAdmin ? 3 : 2}
                    className="px-5 py-8 text-center text-theme-sm text-gray-500 dark:text-gray-400"
                  >
                    No institutions found.
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((inst) => (
                  <TableRow key={inst.id} className="hover:bg-brand-50 dark:hover:bg-white/[0.03]">
                    <TableCell className="px-5 py-4 text-start text-theme-sm font-medium text-gray-800 sm:px-6 dark:text-white/90">
                      {inst.name}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-start text-theme-sm text-gray-500 dark:text-gray-400">
                      {new Date(inst.created_at).toLocaleDateString()}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="px-4 py-3 text-end text-theme-sm text-gray-500 dark:text-gray-400">
                        <Button variant="outline" size="sm" onClick={() => handleManageInstitution(inst)}>
                          Manage Institution
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
    </div>
  );
}
