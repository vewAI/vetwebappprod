"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/features/auth/services/authService";
import { buildAuthHeaders } from "@/lib/auth-headers";

type Config = {
  defaultProvider: string;
  featureOverrides?: Record<string, string | null>;
  // Optional per-feature fallback order, comma-separated provider names
  fallbackLists?: Record<string, string[]>;
};

export default function LLMProviderManager({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { isAdmin } = useAuth();
  const [config, setConfig] = useState<Config>({ defaultProvider: "openai", featureOverrides: { embeddings: null }, fallbackLists: {} });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [activeLoading, setActiveLoading] = useState(false);
  const [activeInfo, setActiveInfo] = useState<any>(null);
  const [activeErr, setActiveErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !isAdmin) return;
    let mounted = true;
    (async () => {
      try {
        const headers = await buildAuthHeaders({ "Content-Type": "application/json" });
        const resp = await fetch("/api/admin/llm-provider", { headers });
        const data = await resp.json();
        if (!mounted) return;
        if (!resp.ok) {
          if (resp.status === 401 || resp.status === 403) {
            setErr("Unauthorized: sign in as an admin to manage LLM providers.");
          } else {
            setErr(data?.error || String(data));
          }
          return;
        }
        setConfig(data);
      } catch (e) {
        if (!mounted) return;
        setErr(String(e));
      }
    })();
    return () => { mounted = false; };
  }, [open, isAdmin]);

  if (!isAdmin) return null;

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      const headers = await buildAuthHeaders({ "Content-Type": "application/json" });
      const resp = await fetch("/api/admin/llm-provider", { method: "POST", headers, body: JSON.stringify(config) });
      const data = await resp.json();
      if (!resp.ok) {
        if (resp.status === 401 || resp.status === 403) {
          throw new Error("Unauthorized: sign in as an admin to save provider config.");
        }
        throw new Error(data?.error || "Save failed");
      }
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
            <select className="mt-1 block w-full p-2 border rounded bg-background text-foreground dark:bg-slate-800 dark:text-white" value={config.defaultProvider} onChange={(e) => setConfig((c) => ({ ...c, defaultProvider: e.target.value }))}>
              <option value="openai">OpenAI</option>
              <option value="gemini">Google Gemini</option>
              <option value="aistudio">AI Studio</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Embeddings Provider Override</label>
            <div className="flex gap-2">
              <select className="mt-1 block w-full p-2 border rounded bg-background text-foreground dark:bg-slate-800 dark:text-white" value={config.featureOverrides?.embeddings ?? ""} onChange={(e) => setConfig((c) => ({ ...c, featureOverrides: { ...(c.featureOverrides || {}), embeddings: e.target.value || null } }))}>
                <option value="">(use default)</option>
                <option value="openai">OpenAI</option>
                <option value="gemini">Google Gemini</option>
                <option value="aistudio">AI Studio</option>
              </select>
              <Button size="sm" onClick={async () => {
                setTesting(true);
                setTestResult(null);
                try {
                  const headers = await buildAuthHeaders({ 'Content-Type': 'application/json' });
                  const providerToTest = config.featureOverrides?.embeddings || config.defaultProvider || 'openai';
                  const resp = await fetch('/api/admin/llm-provider/test', { method: 'POST', headers, body: JSON.stringify({ feature: 'embeddings', provider: providerToTest }) });
                  const data = await resp.json();
                  if (!resp.ok) {
                    if (resp.status === 401 || resp.status === 403) throw new Error('Unauthorized: sign in as an admin to run tests.');
                    // Show richer error detail when available
                    const errMsg = data?.error || (data?.detail ? JSON.stringify(data.detail) : 'Test failed');
                    throw new Error(errMsg);
                  }
                  setTestResult(`OK — provider=${data.provider} model=${data.model ?? 'n/a'} latency=${data.latencyMs ?? 'n/a'}ms`);
                } catch (e: any) {
                  setTestResult(String(e?.message ?? e));
                } finally {
                  setTesting(false);
                }
              }}>{testing ? 'Testing…' : 'Test'}</Button>
            </div>
            {testResult ? <div className="text-xs mt-2">{testResult}</div> : null}
          </div>

          <div>
            <label className="block text-sm font-medium">Active Provider Debug</label>
            <div className="flex gap-2">
              <Button size="sm" onClick={async () => {
                setActiveLoading(true);
                setActiveErr(null);
                setActiveInfo(null);
                try {
                  const headers = await buildAuthHeaders({ 'Content-Type': 'application/json' });
                  const resp = await fetch('/api/admin/llm-provider/active', { headers });
                  const data = await resp.json();
                  if (!resp.ok) {
                    if (resp.status === 401 || resp.status === 403) throw new Error('Unauthorized: sign in as an admin.');
                    throw new Error(data?.error || 'Failed to fetch active config');
                  }
                  setActiveInfo(data);
                } catch (e: any) {
                  setActiveErr(String(e?.message ?? e));
                } finally {
                  setActiveLoading(false);
                }
              }}>{activeLoading ? 'Loading…' : 'Fetch Active Config'}</Button>
            </div>
            {activeErr ? <div className="text-xs mt-2 text-red-600">{activeErr}</div> : null}
            {activeInfo ? <pre className="text-xs mt-2 p-2 bg-slate-100 dark:bg-slate-800 rounded overflow-auto">{JSON.stringify(activeInfo, null, 2)}</pre> : null}
          </div>

          <div>
            <label className="block text-sm font-medium">Chat Provider Override</label>
            <select className="mt-1 block w-full p-2 border rounded bg-background text-foreground dark:bg-slate-800 dark:text-white" value={config.featureOverrides?.chat ?? ""} onChange={(e) => setConfig((c) => ({ ...c, featureOverrides: { ...(c.featureOverrides || {}), chat: e.target.value || null } }))}>
              <option value="">(use default)</option>
              <option value="openai">OpenAI</option>
              <option value="gemini">Google Gemini</option>
              <option value="aistudio">AI Studio</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium">TTS Provider Override</label>
            <select className="mt-1 block w-full p-2 border rounded bg-background text-foreground dark:bg-slate-800 dark:text-white" value={config.featureOverrides?.tts ?? ""} onChange={(e) => setConfig((c) => ({ ...c, featureOverrides: { ...(c.featureOverrides || {}), tts: e.target.value || null } }))}>
              <option value="">(use default)</option>
              <option value="openai">OpenAI</option>
              <option value="gemini">Google Gemini</option>
              <option value="aistudio">AI Studio</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium">Embeddings Provider (preset)</label>
            <select
              className="mt-1 block w-full p-2 border rounded bg-background text-foreground dark:bg-slate-800 dark:text-white"
              value={(config.fallbackLists?.embeddings || [config.defaultProvider || 'openai'])[0] ?? ''}
              onChange={(e) => setConfig((c) => ({ ...c, fallbackLists: { ...(c.fallbackLists || {}), embeddings: e.target.value ? [e.target.value] : [] } }))}
            >
              <option value="">(use default)</option>
              <option value="openai">OpenAI</option>
              <option value="gemini">Google Gemini</option>
              <option value="aistudio">AI Studio</option>
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
