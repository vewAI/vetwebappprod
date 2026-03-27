"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Shield, Fingerprint, Zap } from "lucide-react";
import { startRegistration } from "@simplewebauthn/browser";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/services/authService";

const logoSrc =
  process.env.NEXT_PUBLIC_BRAND_LOGO_URL ||
  (process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/img/logo_transparent.png`
    : "/placeholder.svg");

export default function SetupPasskeyPage() {
  const router = useRouter();
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreatePasskey = async () => {
    if (!session?.access_token) {
      setError("Not signed in");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const challengeRes = await fetch("/api/passkeys/challenge", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      });
      if (!challengeRes.ok) {
        const err = await challengeRes.json().catch(() => ({}));
        throw new Error(err?.error ?? "Failed to start passkey setup");
      }

      const options = await challengeRes.json();
      const credential = await startRegistration(options);

      const verifyRes = await fetch("/api/passkeys/verify", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credential),
      });
      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}));
        throw new Error(err?.error ?? "Failed to verify passkey");
      }

      router.push("/");
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          return;
        }
        setError(err.message);
      } else {
        setError("Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    router.push("/");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-primary/70 to-primary/80 p-4">
      {/* Logo and Company Name */}
      <div className="mb-4 flex flex-row items-center gap-2 motion-safe:animate-in motion-safe:fade-in-50 motion-safe:slide-in-from-top-4">
        <div className="relative h-20 w-20">
          <Image src={logoSrc} alt="VewAI Logo" width={80} height={80} className="h-full w-full object-contain " priority />
        </div>
        <h2 className="text-4xl text-primary tracking-tight">
          Vew<span className="text-white font-bold">Ai</span>
        </h2>
      </div>

      {/* Centered card with benefits */}
      <div className="w-full max-w-md rounded-xl bg-white/95 p-8 shadow-2xl backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in-50 motion-safe:slide-in-from-bottom-4 dark:bg-gray-900/95">
        <h1 className="mb-2 text-center text-2xl font-bold text-foreground">Add a passkey for faster sign-in</h1>
        <p className="mb-6 text-center text-muted-foreground">
          Use Face ID, Touch ID, or your device&apos;s screen lock to sign in quickly and securely—no passwords needed.
        </p>

        <div className="mb-6 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/20 p-2">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">Faster sign-in</p>
              <p className="text-sm text-muted-foreground">One tap or glance—no typing passwords.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/20 p-2">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">More secure</p>
              <p className="text-sm text-muted-foreground">Passkeys are resistant to phishing and can&apos;t be stolen.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/20 p-2">
              <Fingerprint className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">Works on this device</p>
              <p className="text-sm text-muted-foreground">Uses Face ID, Touch ID, or Windows Hello.</p>
            </div>
          </div>
        </div>

        {error && <div className="mb-4 rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>}

        <div className="flex flex-col gap-3">
          <Button className="w-full text-white" onClick={handleCreatePasskey} disabled={loading}>
            {loading ? "Creating passkey…" : "Create passkey"}
          </Button>
          <Button variant="ghost" className="w-full text-muted-foreground hover:text-foreground" onClick={handleSkip} disabled={loading}>
            Skip for now
          </Button>
        </div>
      </div>
    </div>
  );
}
