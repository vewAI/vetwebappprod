"use client";

import { useAuth } from "@/features/auth/services/authService";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, ReactNode } from "react";
import { LoadingScreen } from "@/components/ui/loading-screen";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, isAdmin, profileLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Skip protection for public home, login and auth callback (callback needs to establish session)
    if (pathname === "/" || pathname === "/login" || pathname === "/auth/callback") {
      return;
    }

    // Wait until both session loading and profile loading are finished before making auth decisions
    if (loading || profileLoading) {
      return;
    }

    // If not loading and no user, redirect to login
    if (!user) {
      console.log("Not authenticated, redirecting to login");
      router.push("/login");
    }

    // If user is authenticated but not admin and trying to access any /admin path, redirect
    if (user && pathname.startsWith("/admin") && !isAdmin) {
      console.log("Authenticated but not admin, redirecting away from admin area");
      router.push("/dashboard");
    }
  }, [user, loading, profileLoading, router, pathname, isAdmin]);

  // If on login page and authenticated, redirect to dashboard
  useEffect(() => {
    if (!loading && !profileLoading && user && pathname === "/login") {
      console.log("Already authenticated, redirecting to dashboard");
      router.push("/dashboard");
    }
  }, [user, loading, profileLoading, router, pathname]);

  // Show loading screen while checking auth or profile (except on callback, which needs to run)
  const isCallback = pathname === "/auth/callback";
  if (!isCallback && pathname !== "/" && (loading || profileLoading)) {
    return <LoadingScreen />;
  }

  if (isCallback) {
    return <>{children}</>;
  }

  // If path is within the admin area, ensure user is admin
  if (pathname.startsWith("/admin")) {
    if (!loading && user && isAdmin) {
      return <>{children}</>;
    }
    // either still loading or not allowed
    return <LoadingScreen />;
  }

  // If on public home, login page, or user is authenticated, render children
  if (pathname === "/" || pathname === "/login" || user) {
    return <>{children}</>;
  }

  // Otherwise render loading screen while redirecting
  return <LoadingScreen />;
}
