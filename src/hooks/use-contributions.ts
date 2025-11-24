"use client";

import { useEffect, useMemo, useState } from "react";

export type ContributionRow = {
  id: string;
  employeeId?: string;
  employeeName: string;
  employeeCode: string;
  avatarUrl?: string | null;
  eeContribution: number;
  updatedAt?: string;
};

const MOCK_CONTRIBUTIONS: ContributionRow[] = [
  {
    id: "c1",
    employeeId: "e1",
    employeeName: "Alex Carter",
    employeeCode: "EMP-001",
    avatarUrl: null,
    eeContribution: 1200,
    updatedAt: "2024-06-04",
  },
  {
    id: "c2",
    employeeId: "e2",
    employeeName: "Jamie Lee",
    employeeCode: "EMP-014",
    avatarUrl: null,
    eeContribution: 980,
    updatedAt: "2024-06-02",
  },
  {
    id: "c3",
    employeeId: "e3",
    employeeName: "Morgan Silva",
    employeeCode: "EMP-027",
    avatarUrl: null,
    eeContribution: 1500,
    updatedAt: "2024-05-30",
  },
];

export function useContributionsState() {
  const [contributions, setContributions] =
    useState<ContributionRow[]>(MOCK_CONTRIBUTIONS);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");

  useEffect(() => {
    // Placeholder fetch until backend is wired
    setLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      setContributions(MOCK_CONTRIBUTIONS);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const filteredContributions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return contributions;

    return contributions.filter((row) =>
      `${row.employeeName} ${row.employeeCode}`.toLowerCase().includes(term)
    );
  }, [contributions, searchTerm]);

  const refreshContributions = async () => {
    setLoading(true);
    setError(null);
    try {
      // TODO: replace with real fetch when contributions API is ready
      setContributions(MOCK_CONTRIBUTIONS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  return {
    contributions,
    filteredContributions,
    loading,
    error,
    searchTerm,
    setSearchTerm,
    refreshContributions,
  };
}

export type ContributionsState = ReturnType<typeof useContributionsState>;
