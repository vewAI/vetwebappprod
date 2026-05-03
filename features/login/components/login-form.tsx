"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Key } from "lucide-react";

// Auth Service
import { useAuth } from "@/features/auth/services/authService";
import { supabase } from "@/lib/supabase";

const AUTH_METHODS = {
  password: true,
  otpCode: false,
  magicLink: true,
};

type AuthMethod = "password" | "otp" | "magiclink";

const ENABLED_METHODS = ([["password", "Password"] as const, ["otp", "OTP Code"] as const, ["magiclink", "Login Link"] as const] as const).filter(
  ([key]) => {
    if (key === "password") return AUTH_METHODS.password;
    if (key === "otp") return AUTH_METHODS.otpCode;
    if (key === "magiclink") return AUTH_METHODS.magicLink;
    return false;
  },
);

const DEFAULT_METHOD = (ENABLED_METHODS[0]?.[0] ?? "password") as AuthMethod;

export function LoginForm() {
  const router = useRouter();
  const { user, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [domains, setDomains] = useState<string[]>([]);
  const [domainsLoading, setDomainsLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [authMethod, setAuthMethod] = useState<AuthMethod>(DEFAULT_METHOD);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);

  // Fetch allowed domains
  useEffect(() => {
    fetch("/api/auth/domains")
      .then((res) => res.json())
      .then((data: { domains?: string[] }) => {
        setDomains(data.domains ?? []);
      })
      .catch(() => setDomains([]))
      .finally(() => setDomainsLoading(false));
  }, []);

  // Redirect if user is already logged in
  useEffect(() => {
    if (user) {
      router.push("/");
    }
  }, [user, router]);

  const getValidatedEmail = () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Please enter your email");
      return null;
    }

    const emailMatch = trimmedEmail.match(/^([^@\s]+)@([^@\s]+)$/);
    if (!emailMatch) {
      setError("Please enter a valid email address");
      return null;
    }

    if (domainsLoading) {
      setError("Allowed domains are still loading. Please try again.");
      return null;
    }

    if (domains.length === 0) {
      setError("No domains configured. Contact your administrator.");
      return null;
    }

    const [, local, domain] = emailMatch;
    const normalizedDomain = domain.toLowerCase();
    const isAllowedDomain = domains.some((allowedDomain) => allowedDomain.toLowerCase() === normalizedDomain);

    if (!isAllowedDomain) {
      setError("The email address is not valid");
      return null;
    }

    return `${local}@${normalizedDomain}`;
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!password) {
      setError("Please enter email and password");
      return;
    }

    const validatedEmail = getValidatedEmail();
    if (!validatedEmail) return;

    try {
      setLoading(true);
      await signIn(validatedEmail, password);
    } catch (err: unknown) {
      const errObj = err instanceof Error ? err : new Error(String(err));
      setError(errObj.message || "Failed to sign in");
      console.error("Login error:", err);
    } finally {
      setLoading(false);
      setPassword("");
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const validatedEmail = getValidatedEmail();
    if (!validatedEmail) return;

    try {
      setLoading(true);
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: validatedEmail,
        options: {},
      });

      if (otpError) {
        setError(otpError.message || "Failed to send OTP");
        return;
      }

      setOtpSent(true);
      setSuccess("OTP sent to your email. Check your inbox.");
    } catch (err: unknown) {
      const errObj = err instanceof Error ? err : new Error(String(err));
      setError(errObj.message || "Failed to send OTP");
      console.error("OTP send error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!otp) {
      setError("Please enter email and OTP");
      return;
    }

    const validatedEmail = getValidatedEmail();
    if (!validatedEmail) return;

    try {
      setLoading(true);
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: validatedEmail,
        token: otp,
        type: "email",
      });

      if (verifyError) {
        setError(verifyError.message || "Failed to verify OTP");
        return;
      }

      setSuccess("OTP verified successfully! Redirecting...");
      setTimeout(() => {
        router.push("/");
      }, 1000);
    } catch (err: unknown) {
      const errObj = err instanceof Error ? err : new Error(String(err));
      setError(errObj.message || "Failed to verify OTP");
      console.error("OTP verify error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setPasskeyError(null);
    setPasskeyLoading(true);

    try {
      const challengeRes = await fetch("/api/passkeys/auth/challenge", {
        method: "POST",
      });
      if (!challengeRes.ok) {
        const err = await challengeRes.json().catch(() => ({}));
        throw new Error((err as { error?: string })?.error ?? "Failed to start passkey sign-in");
      }
      const options = await challengeRes.json();
      const credential = await startAuthentication({ optionsJSON: options });

      const verifyRes = await fetch("/api/passkeys/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credential),
      });
      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}));
        throw new Error((err as { error?: string })?.error ?? "Failed to verify passkey");
      }

      const { token_hash, type } = (await verifyRes.json()) as {
        token_hash?: string;
        type?: string;
      };
      if (!token_hash || type !== "email") {
        throw new Error("Invalid session response");
      }

      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash,
        type: "email",
      });
      if (verifyError) throw verifyError;

      router.push("/");
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === "NotAllowedError") return;
        setPasskeyError(err.message);
      } else {
        setPasskeyError("Something went wrong");
      }
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const validatedEmail = getValidatedEmail();
    if (!validatedEmail) return;

    try {
      setLoading(true);
      const { error: magicError } = await supabase.auth.signInWithOtp({
        email: validatedEmail,
        options: {
          emailRedirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback?flow=magiclink`,
        },
      });

      if (magicError) {
        setError(magicError.message || "Failed to send login link");
        return;
      }

      setMagicLinkSent(true);
    } catch (err: unknown) {
      const errObj = err instanceof Error ? err : new Error(String(err));
      setError(errObj.message || "Failed to send login link");
      console.error("Login link send error:", err);
    } finally {
      setLoading(false);
    }
  };

  const renderEmailInput = (id: string, disabled?: boolean) => (
    <div className="space-y-2">
      <Label htmlFor={id}>Email</Label>
      <Input
        id={id}
        type="email"
        placeholder="you@yourdomain.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={disabled}
      />
    </div>
  );

  const noDomainsConfigured = !domainsLoading && domains.length === 0;
  const formDisabled = domainsLoading || noDomainsConfigured;

  return (
    <div className="w-full max-w-md">
      <Card className="mx-auto w-full shadow-2xl backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in-50 motion-safe:slide-in-from-bottom-4">
        <CardContent className="">
          {noDomainsConfigured && (
            <div className="mb-4 rounded-md bg-amber-500/15 p-3 text-sm text-amber-700 dark:text-amber-400">
              No domains configured. Contact your administrator.
            </div>
          )}

          <Tabs value={authMethod} onValueChange={(v) => setAuthMethod(v as AuthMethod)}>
            {ENABLED_METHODS.length > 1 && (
              <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${ENABLED_METHODS.length}, 1fr)` }}>
                {ENABLED_METHODS.map(([val, label]) => (
                  <TabsTrigger key={val} value={val}>
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            )}

            {error && <div className="mt-4 rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>}
            {success && <div className="mt-4 rounded-md bg-green-500/15 p-3 text-sm text-green-700 dark:text-green-400 text-center">{success}</div>}

            {AUTH_METHODS.password && (
              <TabsContent value="password" className="mt-6 space-y-4">
                <form onSubmit={handlePasswordLogin} className="space-y-4">
                  {renderEmailInput("password-email", loading)}
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading || formDisabled}
                    />
                  </div>
                  <Button className="w-full bg-primary text-white hover:bg-primary/90" type="submit" disabled={loading || formDisabled}>
                    {loading ? "Signing in..." : "Sign in with Password"}
                  </Button>
                </form>
              </TabsContent>
            )}

            {AUTH_METHODS.otpCode && (
              <TabsContent value="otp" className="mt-6 space-y-4">
                <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp} className="space-y-4">
                  {renderEmailInput("otp-email", loading || otpSent)}
                  {otpSent && (
                    <div className="space-y-2">
                      <Label htmlFor="otp-code">Verification Code</Label>
                      <Input
                        id="otp-code"
                        type="text"
                        placeholder="000000"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        required
                        disabled={loading}
                        maxLength={6}
                      />
                    </div>
                  )}
                  <Button className="w-full" type="submit" disabled={loading || formDisabled}>
                    {otpSent ? (loading ? "Verifying..." : "Verify OTP") : loading ? "Sending OTP..." : "Send OTP"}
                  </Button>
                  {otpSent && (
                    <Button
                      className="w-full"
                      variant="outline"
                      type="button"
                      onClick={() => {
                        setOtpSent(false);
                        setOtp("");
                        setSuccess(null);
                      }}
                      disabled={loading}
                    >
                      Back
                    </Button>
                  )}
                </form>
              </TabsContent>
            )}

            {AUTH_METHODS.magicLink && (
              <TabsContent value="magiclink" className="mt-6 space-y-4">
                {magicLinkSent ? (
                  <div className="space-y-4 text-center">
                    <div className="rounded-md bg-green-500/15 p-4 text-sm text-green-700 dark:text-green-400">
                      <p className="font-medium">Check your email!</p>
                      <p className="my-2  ">
                        A login link has been sent to <b>{email}</b>.
                      </p>
                      <p>Click the link in the email to sign in.</p>
                    </div>
                    <Button
                      className="w-full bg-primary text-white hover:bg-primary/90"
                      type="button"
                      onClick={() => {
                        setMagicLinkSent(false);
                      }}
                      disabled={loading}
                    >
                      Send Another Link
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSendMagicLink} className="space-y-4">
                    {renderEmailInput("magiclink-email", loading)}
                    <Button className="w-full bg-primary text-white hover:bg-primary/90" type="submit" disabled={loading || formDisabled}>
                      {loading ? "Sending login link..." : "Email a Login Link"}
                    </Button>
                  </form>
                )}
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>

      <Card className="mx-auto w-full shadow-2xl backdrop-blur-sm mt-4 border-accent/50 bg-gradient-to-br from-accent/5 to-accent/10">
        <CardContent className="">
          {passkeyError && <div className="mb-4 rounded-md bg-destructive/15 p-3 text-sm text-destructive">{passkeyError}</div>}
          <Button className="w-full bg-primary text-white hover:bg-primary/90 gap-2" onClick={handlePasskeyLogin} disabled={passkeyLoading}>
            <Key size={18} />
            {passkeyLoading ? "Signing in..." : "Sign in with Passkey"}
          </Button>
        </CardContent>
      </Card>

      <div className="mt-4 text-center text-sm text-white">Alpha version - Test accounts only</div>
    </div>
  );
}
