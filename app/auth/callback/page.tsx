"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/**
 * Auth callback page for magic link sign-in.
 * Supabase redirects here with tokens in the URL hash; the client parses them
 * and onAuthStateChange in AuthProvider handles redirect to /.
 */
export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace("/");
      }
    };
    init();
  }, [router]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8">
      <p className="text-muted-foreground">Signing you in...</p>
    </div>
  );
}
