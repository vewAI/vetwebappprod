"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Auth Service
import { useAuth } from "@/features/auth/services/authService";
import { supabase } from "@/lib/supabase";

type AuthMethod = "password" | "otp";

export function LoginForm() {
  const router = useRouter();
  const { user, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [authMethod, setAuthMethod] = useState<AuthMethod>("password");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  // Redirect if user is already logged in
  useEffect(() => {
    if (user) {
      router.push("/");
    }
  }, [user, router]);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }

    try {
      setLoading(true);
      await signIn(email, password);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error.message || "Failed to sign in");
      console.error("Login error:", error);
    } finally {
      setLoading(false);
      setPassword("");
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email) {
      setError("Please enter your email");
      return;
    }

    try {
      setLoading(true);
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email,
      });

      if (otpError) {
        setError(otpError.message || "Failed to send OTP");
        return;
      }

      setOtpSent(true);
      setSuccess("OTP sent to your email. Check your inbox.");
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error.message || "Failed to send OTP");
      console.error("OTP send error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email || !otp) {
      setError("Please enter email and OTP");
      return;
    }

    try {
      setLoading(true);
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email,
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
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error.message || "Failed to verify OTP");
      console.error("OTP verify error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      {/* Login Card */}
      <Card className="mx-auto w-full shadow-2xl backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in-50 motion-safe:slide-in-from-bottom-4">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">Sign in</CardTitle>
          <CardDescription>Choose your preferred authentication method</CardDescription>
        </CardHeader>

        <CardContent className="pt-0 pb-4">
          <Tabs value={authMethod} onValueChange={(value) => setAuthMethod(value as AuthMethod)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="password">Password</TabsTrigger>
              <TabsTrigger value="otp">OTP</TabsTrigger>
            </TabsList>

            {/* Error and Success messages */}
            {error && <div className="mt-4 bg-destructive/15 text-destructive text-sm p-3 rounded-md">{error}</div>}
            {success && <div className="mt-4 bg-green-500/15 text-green-700 text-sm p-3 rounded-md dark:text-green-400">{success}</div>}

            {/* Password Tab */}
            <TabsContent value="password" className="space-y-4 mt-6">
              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password-email">Email</Label>
                  <Input
                    id="password-email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <Button className="w-full" type="submit" disabled={loading}>
                  {loading ? "Signing in..." : "Sign in with Password"}
                </Button>
              </form>
            </TabsContent>

            {/* OTP Tab */}
            <TabsContent value="otp" className="space-y-4 mt-6">
              <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp-email">Email</Label>
                  <Input
                    id="otp-email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading || otpSent}
                  />
                </div>

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

                <Button className="w-full" type="submit" disabled={loading}>
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
          </Tabs>
        </CardContent>
      </Card>
      <div className="text-center text-sm text-white mt-4">Alpha version - Test accounts only</div>
    </div>
  );
}
