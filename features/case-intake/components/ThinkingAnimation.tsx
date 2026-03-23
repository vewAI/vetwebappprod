"use client";

import React from "react";

export default function ThinkingAnimation({ small = false }: { small?: boolean }) {
  if (small) {
    return (
      <div className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: "0s" }} />
        <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: "0.12s" }} />
        <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: "0.24s" }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center pointer-events-none select-none">
      <div className="relative flex items-center gap-3">
        <div className="absolute -inset-6 rounded-full bg-gradient-to-r from-teal-300/30 via-transparent to-indigo-300/10 blur-2xl opacity-70 animate-pulse" />
        <div className="flex items-center gap-2 z-10">
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: "0s" }} />
            <span className="w-3 h-3 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: "0.12s" }} />
            <span className="w-3 h-3 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: "0.24s" }} />
          </div>
          <div className="text-sm text-slate-700 dark:text-slate-200 font-medium z-10">Thinking</div>
          <div className="text-sm text-slate-400 italic z-10">...magic happens</div>
        </div>
      </div>
    </div>
  );
}
