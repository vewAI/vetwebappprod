"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  bundleLabel,
  bundlesForTest,
  STANDARD_BUNDLE_DEFINITIONS,
  getDefaultBundledTests,
  type BundledTestsMap,
} from "../utils/bundledTests";
import { Plus, X, RotateCcw, Layers, Search } from "lucide-react";

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
  const [selectedLabKeys, setSelectedLabKeys] = useState<string[]>([]);

  const selectBundle = (key: string) => {
    setSelectedKey(key);
    setSelectedLabKeys([]);
  };

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

  const handleAddSelectedTests = () => {
    const selected = selectedLabKeys.filter((key) => availableLabKeys.includes(key) && !currentTests.includes(key));
    if (selected.length === 0) return;
    onChange({ ...activeBundles, [selectedKey]: [...currentTests, ...selected] });
    setSelectedLabKeys([]);
  };

  const handleCreateBundle = () => {
    const trimmed = newBundleName.trim();
    if (!trimmed) return;
    const newKey = trimmed.toLowerCase().replace(/[\s\-]+/g, "_");
    if (activeBundles[newKey]) {
      selectBundle(newKey);
      setNewBundleName("");
      setShowNewBundleInput(false);
      return;
    }
    onChange({
      ...activeBundles,
      [newKey]: [],
    });
    selectBundle(newKey);
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
      selectBundle(remaining[0]);
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
    selectBundle("haematology");
  };

  // Filter available lab keys that are not already in current bundle
  const unaddedLabKeys = availableLabKeys
    .filter((k) => !currentTests.includes(k))
    .filter((k) => !labSearch || k.toLowerCase().includes(labSearch.toLowerCase()))
    .sort((a, b) => a.localeCompare(b));

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
              onClick={() => selectBundle(key)}
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

        {/* Select tests already entered in the nurse's lab reference ranges. */}
        {availableLabKeys.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            <Label className="text-xs font-medium">Select tests from lab reference ranges</Label>
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Search tests to add..."
                  value={labSearch}
                  onChange={(e) => setLabSearch(e.target.value)}
                  className="h-7 pl-7 text-[11px]"
                />
              </div>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded border p-2">
                <div className="grid grid-cols-[16px_minmax(0,1fr)_minmax(0,1fr)] gap-2 px-1 text-[11px] font-medium text-muted-foreground">
                  <span /><span>Test</span><span>Already in</span>
                </div>
                {unaddedLabKeys.map((key) => (
                  <label key={key} className="grid cursor-pointer grid-cols-[16px_minmax(0,1fr)_minmax(0,1fr)] items-start gap-2 rounded px-1 py-0.5 text-xs hover:bg-muted/60">
                    <Checkbox
                      checked={selectedLabKeys.includes(key)}
                      onCheckedChange={(checked) => setSelectedLabKeys((selected) => checked === true
                        ? selected.includes(key) ? selected : [...selected, key]
                        : selected.filter((item) => item !== key))}
                    />
                    <span className="min-w-0 break-words">{key}</span>
                    <span className="min-w-0 break-words text-muted-foreground">{bundlesForTest(activeBundles, key).map(bundleLabel).join(", ") || "None"}</span>
                  </label>
                ))}
                {unaddedLabKeys.length === 0 && (
                  <span className="text-xs italic text-muted-foreground">
                    No matching unassigned tests.
                  </span>
                )}
              </div>
              <Button type="button" size="sm" onClick={handleAddSelectedTests} disabled={selectedLabKeys.length === 0}>
                <Plus className="mr-1 h-3 w-3" /> Add selected tests ({selectedLabKeys.length})
              </Button>
            </div>
          </div>
        )}

        <details className="border-t pt-2 text-xs">
          <summary className="cursor-pointer text-muted-foreground">Add a test that is not in the lab reference ranges</summary>
          <div className="mt-2 flex gap-2">
            <Input
              placeholder={`Test name for ${currentLabel}`}
              value={newTestInput}
              onChange={(e) => setNewTestInput(e.target.value)}
              className="h-8 flex-1 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddTest(newTestInput);
                }
              }}
            />
            <Button size="sm" type="button" onClick={() => handleAddTest(newTestInput)} disabled={!newTestInput.trim()} className="h-8 text-xs">
              <Plus className="mr-1 h-3 w-3" /> Add
            </Button>
          </div>
        </details>
      </div>
    </div>
  );
}
