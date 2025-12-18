import React from "react";

export interface DebugToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function DebugToggle({ enabled, onToggle }: DebugToggleProps) {
  return (
    <div className="flex items-center gap-2 mt-4">
      <label className="font-medium">Debug Mode</label>
      <button
        className={`px-3 py-1 rounded border ${enabled ? "bg-green-200 border-green-500" : "bg-gray-100 border-gray-300"}`}
        onClick={() => onToggle(!enabled)}
        type="button"
      >
        {enabled ? "On" : "Off"}
      </button>
      <span className="text-xs text-muted-foreground">Show/hide backstage notifications</span>
    </div>
  );
}
