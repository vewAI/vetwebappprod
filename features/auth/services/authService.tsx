"use client";

import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { clearInvalidRefreshTokenState, isRefreshTokenAuthError } from "@/lib/supabase-auth-error-utils";

// Define the shape of our auth context
type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: string | null;
  isAdmin: boolean;
  profileLoading: boolean;
  forcePasswordChange: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

// Create the context with default values
const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  role: null,
  isAdmin: false,
  profileLoading: false,
  forcePasswordChange: false,
  signIn: async () => {},
  signOut: async () => {},
});

// AuthProvider component that wraps the app and makes auth object available to any child component that calls useAuth()
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [forcePasswordChange, setForcePasswordChange] = useState(false);
  const [profileLoading, setProfileLoading] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const lastUserIdRef = useRef<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const getInitialSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          const errObj: any = error ?? {};
          const looksLikeRefreshFailure = isRefreshTokenAuthError(errObj);

          // In production avoid noisy stack traces — still clear state and redirect.
          if (looksLikeRefreshFailure) {
            if (process.env.NODE_ENV !== "production") {
              console.warn("Clearing local auth state due to invalid refresh token", errObj);
            }

            await clearInvalidRefreshTokenState(supabase);

            // Redirect to login so the developer can sign in again
            try {
              router.push("/login");
            } catch (__) {}
          } else {
            // Non-refresh related auth errors are useful to log for debugging
            if (process.env.NODE_ENV !== "production") {
              console.error("Error getting session:", errObj);
            }
          }
        } else {
          setSession(data.session);
        }
      } catch (error) {
        console.error("Unexpected error during getSession:", error);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Set up a listener for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession);
      setLoading(false);

      // Only handle redirects during initial auth events or explicit sign-in/out actions
      if (!isInitialized) {
        setIsInitialized(true);
        // Initial auth check - redirect only if needed
        if (!newSession && event === "INITIAL_SESSION") {
          router.push("/login");
        }
      } else {
        // Handle explicit auth state changes
        if (event === "SIGNED_IN") {
          // Avoid forcing a redirect when the user is already on an authenticated page
          // such as /admin or /case-entry. Only redirect after explicit sign-in flows.
          if (pathname === "/login" || pathname === "/auth/callback") {
            router.push("/");
          }
        } else if (event === "SIGNED_OUT") {
          router.push("/login");
        }
      }
    });

    // Clean up the listener when the component unmounts
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router, pathname]);

  // Fetch profile (role) whenever session changes
  useEffect(() => {
    const fetchProfile = async () => {
      const currentUserId = session?.user?.id;
      const isSameUser = currentUserId && currentUserId === lastUserIdRef.current;

      // Only show loading state if user changed or we don't have a role yet
      if (!isSameUser || !role) {
        setProfileLoading(true);
      }

      // If we don't have a user id or an access token, skip fetching
      if (!currentUserId || !session?.access_token) {
        setRole(null);
        setProfileLoading(false);
        lastUserIdRef.current = null;
        return;
      }

      try {
        // Use server-side API to fetch profile (server will use service role key).
        const res = await fetch("/api/profile", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            Accept: "application/json",
          },
        });

        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          setRole(null);
          setProfileLoading(false);
          return;
        }

        const json = await res.json();
        const profile = json?.profile ?? null;
        setRole(profile?.role ?? null);
        setForcePasswordChange(profile?.force_password_change ?? false);

        if (profile?.force_password_change) {
          router.push("/change-password");
        }

        setProfileLoading(false);
        lastUserIdRef.current = currentUserId;
      } catch (err) {
        console.error("Unexpected error fetching profile via /api/profile:", err);
        // If the profile endpoint is temporarily unreachable (network error),
        // fall back to any role present in the session JWT metadata so that
        // users (e.g. professors) don't lose access unnecessarily.
        const fallbackRole = session?.user?.app_metadata?.role ?? session?.user?.user_metadata?.role ?? null;
        setRole(fallbackRole ?? null);
        setForcePasswordChange(false);
        setProfileLoading(false);
      }
    };

    // Call fetchProfile and guard against any unhandled promise rejection
    // (e.g. network failure "Failed to fetch") by attaching an explicit
    // catch handler. The function itself already handles expected errors,
    // but this ensures any unexpected rejection is logged and doesn't
    // surface as an uncaught TypeError in the console.
    fetchProfile().catch((err) => {
      console.error("fetchProfile unexpected rejection:", err);
      setRole(null);
      setProfileLoading(false);
    });
  }, [session]);

  // Sign in function that can be called from any component using useAuth()
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("Error signing in:", error);
      throw error;
    }
  };

  // Sign out function that can be called from any component using useAuth()
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Error signing out:", error);
      throw error;
    }

    // Manually redirect to login page after successful logout
    router.push("/login");
  };

  // Provide the auth context value to children
  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session,
        loading,
        role,
        isAdmin: role === "admin",
        profileLoading,
        forcePasswordChange,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Hook that can be used to access the auth context in any component
export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
