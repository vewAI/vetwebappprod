"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Legacy attempt route redirected cleanly to the modern Gemini Live simulation.
 * Preserves case ID, attempt ID, and session ID query parameters.
 */
export default function CaseAttemptRedirect() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params?.id as string;

  useEffect(() => {
    if (!id) return;
    const query = searchParams?.toString();
    const target = `/live/${encodeURIComponent(id)}${query ? `?${query}` : ""}`;
    router.replace(target);
  }, [id, router, searchParams]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-3 bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Opening Live Simulation...</p>
    </div>
  );
}
