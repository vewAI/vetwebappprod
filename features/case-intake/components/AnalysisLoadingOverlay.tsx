"use client";

import React, { useState, useEffect, useMemo } from "react";

/* ──────────────────────────────────────────────
   Pipeline phases shown to the professor
   ────────────────────────────────────────────── */
const PIPELINE_PHASES = [
  {
    id: "extract",
    icon: "📄",
    title: "Extracting Clinical Data",
    description:
      "Reading your source text and pulling out species, signalment, vitals, exam findings, lab values, and clinical history — preserving every detail you included.",
  },
  {
    id: "structure",
    icon: "🧩",
    title: "Structuring the Simulation",
    description:
      "Mapping your clinical data into the simulation framework: owner persona, nurse persona, lab technician persona, feedback rubrics, and stage-by-stage prompts.",
  },
  {
    id: "generate",
    icon: "✨",
    title: "Generating Missing Pieces",
    description:
      "Creating AI behaviour instructions, evaluation rubrics, and persona dialogue that are specific to YOUR case — not generic templates.",
  },
  {
    id: "verify",
    icon: "🔍",
    title: "Running Clinical Completeness Audit",
    description:
      "Checking every domain a student might explore: history, exam, diagnostics, imaging, differentials, treatment, communication. Flagging gaps for your review.",
  },
];

/* ──────────────────────────────────────────────
   Process explanation cards
   ────────────────────────────────────────────── */
const PROCESS_CARDS = [
  {
    icon: "🩺",
    title: "You're the Clinician",
    body: "Your clinical expertise drives the case. Every detail you provided — breed notes, management nuances, unusual findings — is preserved exactly as you wrote it.",
  },
  {
    icon: "🤖",
    title: "AI is the Translator",
    body: "The AI converts your raw case into a structured simulation with personas, rubrics, and stage prompts. It adds the 'plumbing' — you keep full control of the medicine.",
  },
  {
    icon: "💬",
    title: "You'll Review Everything",
    body: "Next, a verification guide will walk through each field with you. You approve, edit, or skip every suggestion. Nothing goes into the case without your sign-off.",
  },
];

/* ──────────────────────────────────────────────
   What the AI is actually doing (prompt summary)
   ────────────────────────────────────────────── */
const PROMPT_SUMMARY = `The AI is reading your source text and extracting all clinical data (species, vitals, findings, labs) into structured fields. Simultaneously, it generates:

• Owner persona — personality, concerns, communication style based on the case context
• Nurse & lab personas — behaviour rules for revealing findings only when asked
• Feedback rubrics — case-specific criteria for scoring each stage of the student's performance
• Stage prompts — instructions that guide each AI character through the simulation flow

Every detail you included is treated as sacred — nothing is removed or simplified.`;

/* ──────────────────────────────────────────────
   Component
   ────────────────────────────────────────────── */
type Props = {
  countdown: number;
  isVerifying: boolean;
};

export function AnalysisLoadingOverlay({ countdown, isVerifying }: Props) {
  const [activePhase, setActivePhase] = useState(0);
  const [showPrompt, setShowPrompt] = useState(false);
  const [visibleCards, setVisibleCards] = useState(0);

  // Cycle through pipeline phases every 6 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setActivePhase((prev) => {
        // If verifying, snap to last phase
        if (isVerifying) return PIPELINE_PHASES.length - 1;
        return (prev + 1) % PIPELINE_PHASES.length;
      });
    }, 6000);
    return () => clearInterval(interval);
  }, [isVerifying]);

  // Reveal cards progressively
  useEffect(() => {
    if (visibleCards >= PROCESS_CARDS.length) return;
    const timer = setTimeout(
      () => {
        setVisibleCards((prev) => prev + 1);
      },
      2000 + visibleCards * 1500,
    );
    return () => clearTimeout(timer);
  }, [visibleCards]);

  // Snap to verify phase when verification starts
  useEffect(() => {
    if (isVerifying) setActivePhase(PIPELINE_PHASES.length - 1);
  }, [isVerifying]);

  const progressPercent = useMemo(() => {
    return Math.max(2, Math.min(100, ((120 - countdown) / 120) * 100));
  }, [countdown]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full my-8 overflow-hidden">
        {/* ── Gradient Header ── */}
        <div className="bg-gradient-to-r from-teal-600 via-emerald-600 to-cyan-600 px-8 py-6 text-white relative overflow-hidden">
          {/* Animated shimmer */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
              animation: "shimmer 2.5s infinite",
            }}
          />
          <h2 className="text-2xl font-bold relative z-10">{isVerifying ? "Running Clinical Verification..." : "Building Your Simulation"}</h2>
          <p className="text-teal-100 text-sm mt-1 relative z-10">Translating your clinical expertise into a structured teaching experience</p>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* ── Progress Bar ── */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{isVerifying ? "Verifying completeness..." : "Processing case data..."}</span>
              <span className="tabular-nums font-medium">{countdown}s</span>
            </div>
            <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* ── Pipeline Phases ── */}
          <div className="space-y-3">
            {PIPELINE_PHASES.map((phase, idx) => {
              const isActive = idx === activePhase;
              const isDone = idx < activePhase;
              return (
                <div
                  key={phase.id}
                  className={`flex items-start gap-3 rounded-lg border px-4 py-3 transition-all duration-500 ${
                    isActive
                      ? "border-teal-300 bg-teal-50/80 dark:bg-teal-950/30 dark:border-teal-700 shadow-sm"
                      : isDone
                        ? "border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800 opacity-75"
                        : "border-gray-100 dark:border-gray-800 opacity-40"
                  }`}
                >
                  <span className="text-xl mt-0.5 shrink-0">{isDone ? "✅" : phase.icon}</span>
                  <div className="min-w-0">
                    <p className={`font-semibold text-sm ${isActive ? "text-teal-800 dark:text-teal-200" : ""}`}>
                      {phase.title}
                      {isActive && (
                        <span className="inline-flex ml-2">
                          <span className="animate-pulse text-teal-500">●</span>
                        </span>
                      )}
                    </p>
                    {isActive && (
                      <p className="text-xs text-muted-foreground mt-0.5 animate-in fade-in slide-in-from-top-1 duration-300">{phase.description}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Process Explanation Cards ── */}
          <div className="space-y-3 pt-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">What Happens Next</h3>
            <div className="grid gap-3">
              {PROCESS_CARDS.map((card, idx) => (
                <div
                  key={card.title}
                  className={`flex items-start gap-3 rounded-lg border border-gray-100 dark:border-gray-800 px-4 py-3 transition-all duration-700 ${
                    idx < visibleCards ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
                  }`}
                  style={{ transitionDelay: `${idx * 100}ms` }}
                >
                  <span className="text-lg shrink-0">{card.icon}</span>
                  <div>
                    <p className="font-medium text-sm">{card.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{card.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Under the Hood Toggle ── */}
          <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={() => setShowPrompt(!showPrompt)}
              className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="inline-block transition-transform duration-200" style={{ transform: showPrompt ? "rotate(90deg)" : "rotate(0deg)" }}>
                ▶
              </span>
              Under the Hood — What the AI is Doing
            </button>
            {showPrompt && (
              <div className="mt-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 p-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">{PROMPT_SUMMARY}</pre>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* shimmer animation keyframes */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
