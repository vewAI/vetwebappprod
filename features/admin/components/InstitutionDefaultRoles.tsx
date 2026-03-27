"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAccessToken } from "@/lib/auth-headers";
import { GripVertical, Info, Pencil, Plus } from "lucide-react";

export type DefaultRole = "student" | "professor" | "admin";

export type DefaultRoleRow = {
  id: number;
  regex: string;
  role: string;
  institution_id: string;
  priority: number;
  description?: string | null;
  created_at: string;
};

type InstitutionDefaultRolesProps = {
  institutionId: string;
  userRole?: string;
  onSaved?: () => void;
  onSuccess?: (message: string) => void;
};

export function InstitutionDefaultRoles({ institutionId, userRole, onSaved, onSuccess }: InstitutionDefaultRolesProps) {
  const [roles, setRoles] = useState<DefaultRoleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<DefaultRoleRow | null>(null);
  const [formRegex, setFormRegex] = useState("");
  const [formRole, setFormRole] = useState<DefaultRole>("student");
  const [formPriority, setFormPriority] = useState(0);
  const [formDescription, setFormDescription] = useState("");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [localSuccess, setLocalSuccess] = useState<string | null>(null);

  const isAdmin = userRole === "admin";

  const showFeedback = (msg: string) => {
    setLocalSuccess(msg);
    onSuccess?.(msg);
    window.setTimeout(() => setLocalSuccess(null), 4000);
  };

  useEffect(() => {
    const fetchRoles = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await getAccessToken();
        const headers = { Authorization: `Bearer ${token}` };
        const res = await axios.get<{ roles: DefaultRoleRow[] }>(`/api/admin/institution-default-roles?institutionId=${institutionId}`, { headers });
        setRoles(res.data.roles ?? []);
      } catch (err: unknown) {
        const errObj = err as { response?: { data?: { error?: string } }; message?: string };
        setError(errObj.response?.data?.error || errObj.message || "Failed to load default roles");
      } finally {
        setLoading(false);
      }
    };
    fetchRoles();
  }, [institutionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = formRegex.trim();
    if (!trimmed) return;
    try {
      new RegExp(trimmed);
    } catch {
      setError("Invalid regex pattern");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const headers = { Authorization: `Bearer ${token}` };
      const descriptionVal = formDescription.trim() || null;

      if (editingRule) {
        const res = await axios.put<{ role: DefaultRoleRow }>(
          "/api/admin/institution-default-roles",
          {
            id: editingRule.id,
            regex: trimmed,
            role: formRole,
            priority: formPriority,
            description: descriptionVal,
          },
          { headers },
        );
        setRoles((prev) =>
          prev.map((r) => (r.id === editingRule.id ? res.data.role : r)).sort((a, b) => a.priority - b.priority),
        );
        onSaved?.();
        showFeedback("Rule updated.");
      } else {
        const res = await axios.post<{ role: DefaultRoleRow }>(
          "/api/admin/institution-default-roles",
          {
            institutionId,
            regex: trimmed,
            role: formRole,
            priority: formPriority,
            description: descriptionVal,
          },
          { headers },
        );
        setRoles((prev) => [...prev, res.data.role].sort((a, b) => a.priority - b.priority));
        onSaved?.();
        showFeedback("Rule created.");
      }
      closeDialog();
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { error?: string } }; message?: string };
      setError(errObj.response?.data?.error || errObj.message || (editingRule ? "Failed to update rule" : "Failed to add rule"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (id: number, regex: string) => {
    if (
      !window.confirm(
        `Remove this default role rule? Users whose email matches "${regex}" will no longer be auto-assigned a role based on this rule.`,
      )
    )
      return;
    setSubmitting(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const headers = { Authorization: `Bearer ${token}` };
      await axios.delete(`/api/admin/institution-default-roles?id=${id}`, { headers });
      setRoles((prev) => prev.filter((r) => r.id !== id));
      onSaved?.();
      showFeedback("Rule removed.");
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { error?: string } }; message?: string };
      setError(errObj.response?.data?.error || errObj.message || "Failed to remove default role");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const fromIndex = draggedIndex;
    setDraggedIndex(null);
    if (fromIndex === null || fromIndex === dropIndex) return;
    const newRoles = [...roles];
    const [removed] = newRoles.splice(fromIndex, 1);
    newRoles.splice(dropIndex, 0, removed);
    setRoles(newRoles);
    const updates = newRoles.map((r, i) => ({ id: r.id, priority: i }));
    setSubmitting(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const headers = { Authorization: `Bearer ${token}` };
      await axios.patch("/api/admin/institution-default-roles", { updates }, { headers });
      setRoles((prev) => prev.map((r, i) => ({ ...r, priority: i })));
      onSaved?.();
      showFeedback("Order updated.");
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { error?: string } }; message?: string };
      setError(errObj.response?.data?.error || errObj.message || "Failed to update order");
      const token = await getAccessToken();
      const res = await axios.get<{ roles: DefaultRoleRow[] }>(`/api/admin/institution-default-roles?institutionId=${institutionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRoles(res.data.roles ?? []);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const openAddDialog = () => {
    setEditingRule(null);
    setFormRegex("");
    setFormRole("student");
    setFormPriority(roles.length);
    setFormDescription("");
    setError(null);
    setDialogOpen(true);
  };

  const openEditDialog = (rule: DefaultRoleRow) => {
    setEditingRule(rule);
    setFormRegex(rule.regex);
    setFormRole(rule.role as DefaultRole);
    setFormPriority(rule.priority);
    setFormDescription(rule.description ?? "");
    setError(null);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingRule(null);
    setFormRegex("");
    setFormRole("student");
    setFormPriority(roles.length);
    setFormDescription("");
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 rounded-lg border bg-muted/50 p-4">
        <Info className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong>Default role rules</strong> assign a role to new users based on their email address. When someone registers with an email that
            matches a rule&apos;s regex, they are automatically assigned that role.
          </p>
          <p>
            These rules take <strong>priority over domain default roles</strong>. If an email matches both a domain (e.g.{" "}
            <code className="rounded bg-muted px-1">@vet.edu</code>) and a regex rule, the regex rule wins. Rules at the top of the list are evaluated
            first. If no rule matches, the domain&apos;s default role (if any) is used.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Rules are evaluated top to bottom. Drag to reorder.</p>
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openAddDialog} className="gap-1">
                <Plus className="h-4 w-4" />
                Add rule
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingRule ? "Edit rule" : "Add default role rule"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="default-role-regex" className="mb-2">
                    Regex
                  </Label>
                  <Input
                    id="default-role-regex"
                    placeholder="e.g. .*@vet\.edu$"
                    value={formRegex}
                    onChange={(e) => setFormRegex(e.target.value)}
                    disabled={submitting}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    JavaScript regex to match email addresses (e.g. .*@vet.edu$ for @vet.edu)
                  </p>
                </div>
                <div>
                  <Label htmlFor="default-role-description" className="mb-2">
                    Description
                  </Label>
                  <Input
                    id="default-role-description"
                    placeholder="e.g. Vet school faculty"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <Label htmlFor="default-role-select" className="mb-2">
                    Role
                  </Label>
                  <Select value={formRole} onValueChange={(v) => setFormRole(v as DefaultRole)} disabled={submitting}>
                    <SelectTrigger id="default-role-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="professor">Professor</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="default-role-priority" className="mb-2">
                    Priority
                  </Label>
                  <Input
                    id="default-role-priority"
                    type="number"
                    min={0}
                    value={formPriority}
                    onChange={(e) => setFormPriority(parseInt(e.target.value, 10) || 0)}
                    disabled={submitting}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Lower numbers = higher priority (evaluated first)</p>
                </div>
                {error && <div className="rounded-md bg-destructive/15 p-2 text-sm text-destructive">{error}</div>}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={closeDialog}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting || !formRegex.trim()}>
                    {submitting ? "Saving..." : editingRule ? "Update" : "Add"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {localSuccess && (
        <div className="rounded-md bg-green-600/15 text-green-700 dark:text-green-400 p-3 text-sm">
          {localSuccess}
        </div>
      )}
      {error && !dialogOpen && <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : roles.length === 0 ? (
        <p className="text-sm text-muted-foreground">No default role rules configured.</p>
      ) : (
        <ul className="rounded-md border divide-y">
          {roles.map((r, index) => (
            <li
              key={r.id}
              draggable={isAdmin}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-3 px-3 py-2 hover:bg-muted/50 ${isAdmin ? "cursor-grab active:cursor-grabbing" : ""} ${draggedIndex === index ? "opacity-50" : ""}`}
            >
              {isAdmin && <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-sm break-all">{r.regex}</code>
                  <span className="text-muted-foreground text-sm capitalize">→ {r.role}</span>
                </div>
                {r.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate" title={r.description}>
                    {r.description}
                  </p>
                )}
              </div>
              <span className="text-xs text-muted-foreground shrink-0">Priority: {r.priority}</span>
              {isAdmin && (
                <div className="flex items-center gap-1 shrink-0">
                  <Button type="button" variant="ghost" size="sm" onClick={() => openEditDialog(r)} disabled={submitting} aria-label="Edit rule">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => handleRemove(r.id, r.regex)} disabled={submitting}>
                    Remove
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
