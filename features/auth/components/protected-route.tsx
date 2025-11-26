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
    // Skip protection for the login page
    if (pathname === "/login") {
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
      router.push("/");
    }
  }, [user, loading, profileLoading, router, pathname, isAdmin]);

  // If on login page and authenticated, redirect to home
  useEffect(() => {
    if (!loading && !profileLoading && user && pathname === "/login") {
      console.log("Already authenticated, redirecting to home");
      router.push("/");
    }
  }, [user, loading, profileLoading, router, pathname]);

  // Show loading screen while checking auth or profile
  if (loading || profileLoading) {
    return <LoadingScreen />;
  }

  // If path is within the admin area, ensure user is admin
  if (pathname.startsWith("/admin")) {
    if (!loading && user && isAdmin) {
      return <>{children}</>;
    }
    // either still loading or not allowed
    return <LoadingScreen />;
  }

  // If on login page or user is authenticated, render children
  if (pathname === "/login" || user) {
    return <>{children}</>;
  }

  // Otherwise render loading screen while redirecting
  return <LoadingScreen />;
}
