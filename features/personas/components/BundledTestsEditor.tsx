"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  STANDARD_BUNDLE_DEFINITIONS,
  getDefaultBundledTests,
  type BundledTestsMap,
} from "../utils/bundledTests";
import { Plus, X, RotateCcw, Layers, Search, Sparkles } from "lucide-react";

export interface BundledTestsEditorProps {
  bundles: BundledTestsMap;
  onChange: (updated: BundledTestsMap) => void;
  availableLabKeys?: string[];
}

export function BundledTestsEditor({
  bundles,
  onChange,
  availableLabKeys = [],
}: BundledTestsEditorProps) {
  const activeBundles: BundledTestsMap =
    bundles && Object.keys(bundles).length > 0 ? bundles : getDefaultBundledTests();

  const bundleKeys = Object.keys(activeBundles);
  const [selectedKey, setSelectedKey] = useState<string>(bundleKeys[0] || "haematology");
  const [newTestInput, setNewTestInput] = useState("");
  const [newBundleName, setNewBundleName] = useState("");
  const [showNewBundleInput, setShowNewBundleInput] = useState(false);
  const [labSearch, setLabSearch] = useState("");

  const currentDef = STANDARD_BUNDLE_DEFINITIONS.find((d) => d.id === selectedKey);
  const currentLabel =
    currentDef?.label ??
    selectedKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const currentTests = activeBundles[selectedKey] ?? [];

  const handleRemoveTest = (testToRemove: string) => {
    const updatedTests = currentTests.filter((t) => t !== testToRemove);
    onChange({
      ...activeBundles,
      [selectedKey]: updatedTests,
    });
  };

  const handleAddTest = (testToAdd: string) => {
    const trimmed = testToAdd.trim();
    if (!trimmed || currentTests.includes(trimmed)) return;
    onChange({
      ...activeBundles,
      [selectedKey]: [...currentTests, trimmed],
    });
    setNewTestInput("");
  };

  const handleCreateBundle = () => {
    const trimmed = newBundleName.trim();
    if (!trimmed) return;
    const newKey = trimmed.toLowerCase().replace(/[\s\-]+/g, "_");
    if (activeBundles[newKey]) {
      setSelectedKey(newKey);
      setNewBundleName("");
      setShowNewBundleInput(false);
      return;
    }
    onChange({
      ...activeBundles,
      [newKey]: [],
    });
    setSelectedKey(newKey);
    setNewBundleName("");
    setShowNewBundleInput(false);
  };

  const handleDeleteBundle = (keyToDelete: string) => {
    if (!confirm(`Delete the bundle "${keyToDelete}"?`)) return;
    const updated = { ...activeBundles };
    delete updated[keyToDelete];
    onChange(updated);
    const remaining = Object.keys(updated);
    if (remaining.length > 0) {
      setSelectedKey(remaining[0]);
    }
  };

  const handleResetDefaults = () => {
    if (
      !confirm(
        "Reset all bundled tests to standard veterinary defaults (Haematology, Biochemistry, Coagulation, etc.)?"
      )
    ) {
      return;
    }
    const defaults = getDefaultBundledTests();
    onChange(defaults);
    setSelectedKey("haematology");
  };

  // Filter available lab keys that are not already in current bundle
  const unaddedLabKeys = availableLabKeys
    .filter((k) => !currentTests.includes(k))
    .filter((k) => !labSearch || k.toLowerCase().includes(labSearch.toLowerCase()))
    .slice(0, 10);

  return (
    <div className="space-y-3 border rounded-lg p-3 bg-muted/20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <Label className="text-sm font-semibold">Bundled Tests &amp; Profiles</Label>
          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
            {bundleKeys.length} panels
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResetDefaults}
            className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
          >
            <RotateCcw className="h-3 w-3" /> Reset Defaults
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowNewBundleInput(!showNewBundleInput)}
            className="h-7 text-xs gap-1"
          >
            <Plus className="h-3 w-3" /> Add Bundle
          </Button>
        </div>
      </div>

      {/* New bundle inline input */}
      {showNewBundleInput && (
        <div className="flex items-center gap-2 p-2 bg-background rounded-md border">
          <Input
            placeholder="Bundle name (e.g. Equine Sepsis Panel)"
            value={newBundleName}
            onChange={(e) => setNewBundleName(e.target.value)}
            className="h-8 text-xs flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreateBundle();
              }
            }}
          />
          <Button size="sm" type="button" onClick={handleCreateBundle} className="h-8 text-xs">
            Create
          </Button>
          <Button
            size="sm"
            variant="ghost"
            type="button"
            onClick={() => setShowNewBundleInput(false)}
            className="h-8 text-xs"
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Bundle Navigation Tabs */}
      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
        {bundleKeys.map((key) => {
          const def = STANDARD_BUNDLE_DEFINITIONS.find((d) => d.id === key);
          const label = def?.label ?? key.replace(/_/g, " ");
          const count = (activeBundles[key] ?? []).length;
          const isSelected = selectedKey === key;

          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedKey(key)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                isSelected
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-background border text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <span>{label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Bundle Detail */}
      <div className="bg-background rounded-md border p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
              {currentLabel}
            </h4>
            {currentDef?.description && (
              <p className="text-[11px] text-muted-foreground">{currentDef.description}</p>
            )}
          </div>
          {!currentDef && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteBundle(selectedKey)}
              className="h-6 text-xs text-destructive hover:bg-destructive/10"
            >
              Delete Bundle
            </Button>
          )}
        </div>

        {/* Test badges list */}
        <div className="flex flex-wrap gap-1.5 min-h-[40px] max-h-48 overflow-y-auto p-1 border rounded bg-muted/10">
          {currentTests.map((test) => (
            <Badge
              key={test}
              variant="secondary"
              className="text-xs py-0.5 px-2 gap-1 items-center font-normal"
            >
              <span>{test}</span>
              <button
                type="button"
                onClick={() => handleRemoveTest(test)}
                className="hover:text-destructive p-0.5"
                title="Remove parameter"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {currentTests.length === 0 && (
            <div className="text-xs text-muted-foreground italic p-2">
              No parameters in this bundle. Add some below.
            </div>
          )}
        </div>

        {/* Add parameter input */}
        <div className="flex gap-2">
          <Input
            placeholder={`Add test to ${currentLabel} (e.g. Fibrinogen)`}
            value={newTestInput}
            onChange={(e) => setNewTestInput(e.target.value)}
            className="h-8 text-xs flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddTest(newTestInput);
              }
            }}
          />
          <Button
            size="sm"
            type="button"
            onClick={() => handleAddTest(newTestInput)}
            disabled={!newTestInput.trim()}
            className="h-8 text-xs"
          >
            <Plus className="h-3 w-3 mr-1" /> Add
          </Button>
        </div>

        {/* Quick add from nurse's existing lab reference ranges */}
        {availableLabKeys.length > 0 && (
          <details className="text-xs pt-1">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-500" />
              Quick-add from nurse&apos;s reference ranges ({availableLabKeys.length} available)
            </summary>
            <div className="mt-2 space-y-2 pl-2">
              <div className="relative">
                <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Filter parameters..."
                  value={labSearch}
                  onChange={(e) => setLabSearch(e.target.value)}
                  className="h-7 pl-7 text-[11px]"
                />
              </div>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                {unaddedLabKeys.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => handleAddTest(k)}
                    className="text-[11px] bg-muted/60 hover:bg-primary hover:text-primary-foreground px-2 py-0.5 rounded border transition-colors truncate max-w-[200px]"
                    title={`Click to add ${k}`}
                  >
                    + {k}
                  </button>
                ))}
                {unaddedLabKeys.length === 0 && (
                  <span className="text-[11px] text-muted-foreground italic">
                    All matching reference ranges are already in this bundle.
                  </span>
                )}
              </div>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
