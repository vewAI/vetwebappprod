"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Info } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAccessToken } from "@/lib/auth-headers";

type DefaultRole = "student" | "professor" | "admin";

type DomainRow = { id: string; domain: string; default_role: string | null };

/** Valid domain: labels of alphanumeric/hyphens, separated by dots, TLD 2+ chars (e.g. example.edu, sub.example.co.uk) */
const DOMAIN_REGEX = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;

function isValidDomain(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 && DOMAIN_REGEX.test(trimmed);
}

type InstitutionDomainsPanelProps = {
  institutionId: string;
  onSaved?: () => void;
  onSuccess?: (message: string) => void;
};

export function InstitutionDomainsPanel({ institutionId, onSaved, onSuccess }: InstitutionDomainsPanelProps) {
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [newDefaultRole, setNewDefaultRole] = useState<DefaultRole | "__none__">("__none__");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDomains([]);
    setNewDomain("");
    setNewDefaultRole("__none__");
    setError(null);
    const fetchDomains = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await getAccessToken();
        const headers = { Authorization: `Bearer ${token}` };
        const res = await axios.get<{ domains: DomainRow[] }>(`/api/admin/institution-domains?institutionId=${institutionId}`, { headers });
        setDomains(res.data.domains ?? []);
      } catch (err: unknown) {
        const errObj = err as { response?: { data?: { error?: string } }; message?: string };
        setError(errObj.response?.data?.error || errObj.message || "Failed to load domains");
      } finally {
        setLoading(false);
      }
    };
    fetchDomains();
  }, [institutionId]);

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newDomain.trim();
    if (!trimmed) return;
    if (!isValidDomain(trimmed)) {
      setError("Please enter a valid domain (e.g. example.edu)");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const headers = { Authorization: `Bearer ${token}` };
      const normalized = trimmed.toLowerCase();
      const res = await axios.post<{ domain: DomainRow }>(
        "/api/admin/institution-domains",
        {
          institutionId,
          domain: normalized,
          defaultRole: newDefaultRole === "__none__" ? null : newDefaultRole,
        },
        { headers },
      );
      setDomains((prev) => [...prev, res.data.domain]);
      setNewDomain("");
      setNewDefaultRole("__none__");
      onSaved?.();
      onSuccess?.("Domain added successfully.");
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { error?: string } }; message?: string };
      setError(errObj.response?.data?.error || errObj.message || "Failed to add domain");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveDomain = async (id: string, domain: string) => {
    if (
      !window.confirm(
        `Remove domain "${domain}"? Nobody will be able to register or log in using an email address from this domain.`
      )
    )
      return;
    setSubmitting(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const headers = { Authorization: `Bearer ${token}` };
      await axios.delete(`/api/admin/institution-domains?id=${id}`, { headers });
      setDomains((prev) => prev.filter((d) => d.id !== id));
      onSaved?.();
      onSuccess?.("Domain removed successfully.");
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { error?: string } }; message?: string };
      setError(errObj.response?.data?.error || errObj.message || "Failed to remove domain");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 rounded-lg border bg-muted/50 p-4">
        <Info className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
        <p className="text-sm text-muted-foreground">
          These domains authorize users to log in and create accounts for this institution. Only email addresses
          ending with one of the domains below will be accepted at login.
        </p>
      </div>

      {error && <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>}

      <form onSubmit={handleAddDomain} className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[140px] space-y-1">
            <Label className="mb-2" htmlFor="new-domain">
              New domain
            </Label>
            <Input
              id="new-domain"
              type="text"
              placeholder="example.edu"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="w-[140px] ">
            <Label className="mb-2" htmlFor="new-default-role">
              Default role
            </Label>
            <Select value={newDefaultRole} onValueChange={(v) => setNewDefaultRole(v as DefaultRole | "__none__")} disabled={submitting}>
              <SelectTrigger id="new-default-role" className="h-9">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="professor">Professor</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={submitting || !newDomain.trim()}>
            Add
          </Button>
        </div>
      </form>

      <div>
        <Label className="text-sm">Current domains</Label>
        {loading ? (
          <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
        ) : domains.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No domains configured.</p>
        ) : (
          <ul className="mt-2 max-h-48 overflow-auto rounded-md border">
            {domains.map((d) => (
              <li key={d.id} className="flex items-center justify-between border-b px-3 py-2 last:border-b-0">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm">{d.domain}</span>
                  {d.default_role && <span className="text-xs text-muted-foreground capitalize">Default role: {d.default_role}</span>}
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveDomain(d.id, d.domain)} disabled={submitting}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
