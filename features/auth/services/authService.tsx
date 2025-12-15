"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  ReactNode,
} from "react";
import { User, Session } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Define the shape of our auth context
type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: string | null;
  isAdmin: boolean;
  profileLoading: boolean;
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
  signIn: async () => {},
  signOut: async () => {},
});

// AuthProvider component that wraps the app and makes auth object available to any child component that calls useAuth()
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const lastUserIdRef = useRef<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const getInitialSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Error getting session:", error.message);
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
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
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
            router.push("/");
          } else if (event === "SIGNED_OUT") {
            router.push("/login");
          }
        }
      }
    );

    // Clean up the listener when the component unmounts
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router]);

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
          console.debug("Profile fetch failed:", res.status, txt);
          setRole(null);
          setProfileLoading(false);
          return;
        }

        const json = await res.json();
        const profile = json?.profile ?? null;
        setRole(profile?.role ?? null);
        setProfileLoading(false);
        lastUserIdRef.current = currentUserId;
      } catch (err) {
        console.error(
          "Unexpected error fetching profile via /api/profile:",
          err
        );
        setRole(null);
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
