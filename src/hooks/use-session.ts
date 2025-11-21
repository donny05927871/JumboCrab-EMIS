"use client";

import { useEffect, useState, useMemo } from "react";
import { Session } from "@/types/session";
import { fetchSession } from "@/actions/session-action";
import { User } from "@/lib/validations/users";

interface RawSession {
  id?: string;
  username?: string;
  email?: string;
  role?: string;
  employee?: any;
  isLoggedIn: boolean;
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const result = await fetchSession();

        if (!result.success || !result.session) {
          throw new Error(result.error || "Failed to load session");
        }

        const rawSession = result.session as unknown as RawSession;

        const userData: User = {
          id: rawSession.id || "",
          username: rawSession.username || "",
          email: rawSession.email || "",
          role: rawSession.role as any,
          isDisabled: false,
        };

        const sessionData: Session = {
          user: {
            ...userData,
            employee: rawSession.employee || null,
          },
          expires: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
        };

        setSession(sessionData);
      } catch (err) {
        console.error("Session error:", err);
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, []);

  // Memoize the returned object to prevent unnecessary re-renders
  return useMemo(
    () => ({
      session,
      loading,
      error,
      // Helper getters
      get user() {
        return session?.user;
      },
      get employee() {
        return session?.user?.employee;
      },
      get isAdmin() {
        return session?.user?.role === "admin";
      },
    }),
    [session, loading, error]
  );
}
