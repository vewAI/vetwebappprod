"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/services/authService";
import { getAccessToken } from "@/lib/auth-headers";
import {
  CreateInstitutionDialog,
  InstitutionManagement,
  type Institution,
} from "@/features/admin/components/InstitutionManagement";
import { Breadcrumb } from "@/features/navigation/components/breadcrumb";

export default function InstitutionManagementPage() {
  const { role: userRole } = useAuth();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [view, setView] = useState<"list" | "detail">("list");

  const fetchData = async (options?: { skipLoading?: boolean }) => {
    try {
      if (!options?.skipLoading) setLoading(true);
      const token = await getAccessToken();
      const headers = { Authorization: `Bearer ${token}` };
      const instRes = await axios.get<{ institutions: Institution[] }>("/api/admin/institutions", { headers });
      setInstitutions(instRes.data.institutions || []);
      setError(null);
    } catch (err: unknown) {
      const requestError = err as { response?: { data?: { error?: string } }; message?: string };
      setError(requestError.response?.data?.error || requestError.message || "Failed to load institutions");
    } finally {
      if (!options?.skipLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="container mx-auto px-4 pb-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Breadcrumb
          className="mb-0"
          items={[
            { label: "Home", href: "/dashboard" },
            { label: "Admin", href: "/admin" },
            { label: "Institution Management" },
          ]}
        />
        {userRole === "admin" && view === "list" && (
          <Button onClick={() => setIsCreateOpen(true)}>Create Institution</Button>
        )}
      </div>
      <CreateInstitutionDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={() => fetchData({ skipLoading: true })}
      />

      {view === "list" && (
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-primary md:text-4xl lg:text-5xl">Institution Management</h1>
          <p className="mt-4 text-xl text-muted-foreground">Create and manage institutions, domains, and default roles.</p>
        </header>
      )}

      {error && <div className="mb-6 rounded-md bg-destructive/10 p-4 text-destructive">{error}</div>}

      <InstitutionManagement
        institutions={institutions}
        onRefresh={() => fetchData({ skipLoading: true })}
        userRole={userRole ?? undefined}
        loading={loading}
        onViewChange={setView}
      />
    </div>
  );
}
