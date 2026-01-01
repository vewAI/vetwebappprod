"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/features/auth/services/authService";

type Config = {
  defaultProvider: string;
  featureOverrides?: Record<string, string | null>;
};

export default function LLMProviderManager({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { isAdmin } = useAuth();
  const [config, setConfig] = useState<Config>({ defaultProvider: "openai", featureOverrides: { embeddings: null } });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !isAdmin) return;
    fetch("/api/admin/llm-provider")
      .then((r) => r.json())
      .then((data) => setConfig(data))
      .catch((e) => setErr(String(e)));
  }, [open, isAdmin]);

  if (!isAdmin) return null;

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      const resp = await fetch("/api/admin/llm-provider", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config) });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Save failed");
      onOpenChange(false);
    } catch (e) {
      setErr(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>LLM Provider Manager</DialogTitle>
          <DialogDescription>Choose default provider and per-feature overrides.</DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium">Default Provider</label>
            <select className="mt-1 block w-full" value={config.defaultProvider} onChange={(e) => setConfig((c) => ({ ...c, defaultProvider: e.target.value }))}>
              <option value="openai">OpenAI</option>
              <option value="gemini">Google Gemini</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Embeddings Provider Override</label>
            <select className="mt-1 block w-full" value={config.featureOverrides?.embeddings ?? ""} onChange={(e) => setConfig((c) => ({ ...c, featureOverrides: { ...(c.featureOverrides || {}), embeddings: e.target.value || null } }))}>
              <option value="">(use default)</option>
              <option value="openai">OpenAI</option>
              <option value="gemini">Google Gemini</option>
            </select>
          </div>
          {err ? <div className="text-sm text-red-600">{err}</div> : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
