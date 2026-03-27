"use client";

import React, { useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getAccessToken } from "@/lib/auth-headers";
import { InstitutionDomainsPanel } from "@/features/admin/components/InstitutionDomainsPanel";
import { InstitutionDefaultRoles } from "@/features/admin/components/InstitutionDefaultRoles";
import { ChevronLeft } from "lucide-react";

export type Institution = {
  id: string;
  name: string;
  created_at: string;
};

type InstitutionManagementProps = {
  institutions: Institution[];
  onRefresh: () => Promise<void>;
  userRole?: string;
};

export function InstitutionManagement({ institutions, onRefresh, userRole }: InstitutionManagementProps) {
  const [view, setView] = useState<"list" | "detail">("list");
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null);
  const [editName, setEditName] = useState("");
  const [nameSubmitting, setNameSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [isInstDialogOpen, setIsInstDialogOpen] = useState(false);
  const [instName, setInstName] = useState("");
  const [instSubmitting, setInstSubmitting] = useState(false);

  const isAdmin = userRole === "admin";

  const handleManageInstitution = (inst: Institution) => {
    setSelectedInstitution(inst);
    setEditName(inst.name);
    setView("detail");
  };

  const handleBack = () => {
    setSelectedInstitution(null);
    setView("list");
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

  const handleInstSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setInstSubmitting(true);
      const token = await getAccessToken();
      await axios.post("/api/admin/institutions", { name: instName }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setIsInstDialogOpen(false);
      setInstName("");
      await onRefresh();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      alert(error.response?.data?.error || error.message || "Failed to create institution");
    } finally {
      setInstSubmitting(false);
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Institutions</CardTitle>
        {isAdmin && (
          <Dialog open={isInstDialogOpen} onOpenChange={setIsInstDialogOpen}>
            <DialogTrigger asChild>
              <Button>Create Institution</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Institution</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleInstSubmit} className="space-y-4">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={instName}
                    onChange={(e) => setInstName(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" disabled={instSubmitting} className="w-full">
                  {instSubmitting ? "Creating..." : "Create"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">Created</th>
                {isAdmin && <th className="p-3 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {institutions.map((inst) => (
                <tr key={inst.id} className="border-t hover:bg-muted/50">
                  <td className="p-3 font-medium">{inst.name}</td>
                  <td className="p-3">{new Date(inst.created_at).toLocaleDateString()}</td>
                  {isAdmin && (
                    <td className="p-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => handleManageInstitution(inst)}>
                        Manage Institution
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
              {institutions.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 3 : 2} className="p-8 text-center text-muted-foreground">
                    No institutions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
