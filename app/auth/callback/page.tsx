"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/**
 * Auth callback page for magic link sign-in.
 * Supabase redirects here with tokens in the URL hash; the client parses them
 * and onAuthStateChange in AuthProvider handles session. This page controls
 * the post-login redirect: magic link users without a passkey go to /setup-passkey.
 * We use ?flow=magiclink (query param) because the hash is cleared by Supabase before we can read it.
 */

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const runRedirect = async (session: { access_token: string }) => {
      const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
      const isMagicLink = searchParams.get("flow") === "magiclink";
      if (isMagicLink) {
        let lastError: Error | null = null;

        // Retry logic: token might not be immediately available
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const res = await fetch("/api/passkeys/check", {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            });

            if (!res.ok) {
              lastError = new Error(`API returned ${res.status}: ${await res.text()}`);
              if (attempt < 2) {
                await new Promise((resolve) => setTimeout(resolve, 500));
                continue;
              }
              console.error("[Auth Callback] Passkey check failed:", lastError);
              router.replace("/");
              return;
            }

            const json = (await res.json()) as { hasPasskey?: boolean };

            if (json.hasPasskey) {
              router.replace("/");
              return;
            }
            router.replace("/setup-passkey");
            return;
          } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            if (attempt < 2) {
              await new Promise((resolve) => setTimeout(resolve, 500));
              continue;
            }
            console.error("[Auth Callback] Error checking passkeys:", lastError);
            router.replace("/");
            return;
          }
        }
      }

      router.replace("/");
    };

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        await runRedirect(data.session);
        return;
      }

      // Session may not be ready yet (hash still being processed); listen for it
      const { data: sub } = supabase.auth.onAuthStateChange(async (event, sessionData) => {
        if (event === "SIGNED_IN" && sessionData) {
          sub.subscription.unsubscribe();
          await runRedirect(sessionData);
        }
      });
    };
    init();
  }, [router]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8">
      <p className="text-muted-foreground">Signing you in...</p>
    </div>
  );
}
