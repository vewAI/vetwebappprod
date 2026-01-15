"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/services/authService";
import { Loader2, ArrowRight } from "lucide-react";

/**
 * Personas Management Page (Simplified)
 * 
 * Persona configuration has been consolidated into the Case Viewer.
 * Each persona (Owner, Nurse) can now be fully configured within
 * the case editing interface, including:
 * - Avatar image
 * - Display name
 * - Gender
 * - Voice settings
 * - Behavior prompt (personality customization)
 * 
 * This page provides a redirect to the case-viewer.
 */
export default function PersonasPage() {
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (authLoading) return;
    
    if (!session) {
      router.push("/admin");
      return;
    }

    // Auto-redirect after countdown
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push("/case-viewer");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [authLoading, session, router]);

  if (authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background text-foreground p-8">
      <div className="max-w-lg text-center space-y-6">
        <h1 className="text-2xl font-bold">Personas Management Has Moved</h1>
        
        <div className="space-y-4 text-muted-foreground">
          <p>
            Persona configuration is now integrated directly into the <strong>Case Viewer</strong>.
          </p>
          <p>
            When editing a case, you can configure each persona&apos;s avatar, name, gender, voice, 
            and behavior prompt all in one place.
          </p>
        </div>

        <div className="pt-4 space-y-3">
          <Button 
            onClick={() => router.push("/case-viewer")}
            className="w-full"
          >
            Go to Case Viewer <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          
          <p className="text-sm text-muted-foreground">
            Redirecting automatically in {countdown} seconds...
          </p>
        </div>

        <div className="pt-6 border-t">
          <Button 
            variant="outline" 
            onClick={() => router.push("/admin")}
          >
            Back to Admin Panel
          </Button>
        </div>
      </div>
    </main>
  );
}
