"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/features/auth/services/authService";
import { getAttemptsByCase } from "@/features/attempts/services/attemptService";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Clock, Play } from "lucide-react";
import { fetchCaseById } from "@/features/case-selection/services/caseService";
import type { Case } from "@/features/case-selection/models/case";
import type { Attempt } from "@/features/attempts/models/attempt";
import { GuidedTour } from "@/components/ui/guided-tour";
import { HelpTip } from "@/components/ui/help-tip";

export default function CaseInstructionsPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [attempts, setAttempts] = useState<Attempt[]>([]);

  const [caseData, setCaseData] = useState<Case | null>(null);

  const tourSteps = [
    { element: '#case-title', popover: { title: 'Case Details', description: 'Review the case title, estimated time, and overview before starting.' } },
    { element: '#start-button', popover: { title: 'Start Case', description: 'Click here to begin the simulation. A new attempt will be created.' } },
    { element: '#past-attempts', popover: { title: 'Past Attempts', description: 'View your previous attempts and their status here.' } },
  ];

  useEffect(() => {
    async function loadCase() {
      const result = await fetchCaseById(id);
      setCaseData(result);
    }
    loadCase();
  }, [id]);

  useEffect(() => {
    const loadAttempts = async () => {
      if (!user) return;

      setIsLoading(true);
      try {
        const caseAttempts = await getAttemptsByCase(id);
        setAttempts(caseAttempts);
      } catch (error) {
        console.error("Error loading attempts:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAttempts();
  }, [id, user]);

  const handleStartCase = () => {
    setIsStarting(true);
    // Navigate directly to the case page
    // The case page will create a new attempt if needed
    router.push(`/${id}`);
  };

  if (!caseData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-lg mb-4">Case not found</p>
          <Link href="/">
            <Button variant="outline">Back to Case Selection</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Case Selection
        </Link>
        <GuidedTour steps={tourSteps} tourId="case-instructions" />
      </div>

      <div className="grid gap-8 md:grid-cols-[2fr_1fr]">
        <div>
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <h1 id="case-title" className="text-3xl font-bold tracking-tight text-primary md:text-4xl">
                {caseData.title}
              </h1>
              <HelpTip content="This is the specific case you are about to undertake." />
            </div>

            <div className="flex items-center text-sm text-muted-foreground mb-4">
              <Clock className="mr-1 h-4 w-4" />
              <span>Estimated time: {caseData.estimatedTime} minutes</span>
            </div>

            <div className="prose max-w-none">
              <h2 className="text-xl font-semibold mb-2">Case Overview</h2>
              <p>{caseData.description}</p>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="rounded-md border p-3">
                  <h3 className="text-sm font-medium">Species</h3>
                  <p className="mt-1">{caseData.species}</p>
                </div>
                <div className="rounded-md border p-3">
                  <h3 className="text-sm font-medium">Category</h3>
                  <p className="mt-1">{caseData.category}</p>
                </div>
                <div className="rounded-md border p-3">
                  <h3 className="text-sm font-medium">Difficulty</h3>
                  <p className="mt-1">{caseData.difficulty}</p>
                </div>
              </div>

              <h2 className="text-xl font-semibold mt-6 mb-2">Instructions</h2>
              <p>
                In this OSCE case, you will interact with a simulated client and
                patient. Work through the case by taking a history, performing a
                physical examination, and recommending diagnostic tests as
                appropriate.
              </p>
              <ul>
                <li>Proceed through each stage of the case in order</li>
                <li>You can save your progress at any time</li>
                <li>
                  Once completed, you will receive feedback on your performance
                </li>
              </ul>
            </div>

            <div id="start-button" className="mt-8 flex items-center gap-2">
              <Button
                onClick={handleStartCase}
                disabled={isStarting}
                className="w-full sm:w-auto text-lg py-6 px-8"
              >
                {isStarting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-5 w-5" />
                    Start Case
                  </>
                )}
              </Button>
              <HelpTip content="Clicking this will launch the simulation environment." />
            </div>
          </div>
        </div>

        <div id="past-attempts">
          <div className="bg-muted p-6 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Your Past Attempts</h2>
              <HelpTip content="A history of your previous sessions with this case." />
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
                <span>Loading attempts...</span>
              </div>
            ) : attempts.length > 0 ? (
              <div className="space-y-4">
                {attempts.map((attempt) => (
                  <div
                    key={attempt.id}
                    className="bg-background rounded-md p-4 shadow-sm"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-medium">{attempt.title}</h3>
                      <div
                        className={`text-xs px-2 py-1 rounded-full ${
                          attempt.completionStatus === "completed"
                            ? "bg-green-100 text-green-800"
                            : attempt.completionStatus === "in_progress"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {attempt.completionStatus === "completed"
                          ? "Completed"
                          : attempt.completionStatus === "in_progress"
                          ? "In Progress"
                          : "Abandoned"}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>
                            {new Date(attempt.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <Link href={`/attempts/${attempt.id}`}>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                        >
                          View
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-4 text-muted-foreground">
                You haven&apos;t attempted this case yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
