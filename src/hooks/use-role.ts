// src/hooks/use-role.ts
"use client";

import { useState, useEffect } from "react";

export function useRole() {
  const [role, setRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const response = await fetch("/api/auth/role");
        if (response.ok) {
          const { role } = await response.json();
          setRole(role);
        }
      } catch (error) {
        console.error("Failed to fetch role:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRole();
  }, []);

  return { role, isLoading };
}
