"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ContributionsProvider, useContributions } from "@/components/dasboard/manage-contributions/contributions-provider";
import { ContributionsTable } from "@/components/dasboard/manage-contributions/contributions-table";

function ContributionsContent() {
  const router = useRouter();
  const {
    filteredContributions,
    searchTerm,
    setSearchTerm,
    loading,
    error,
  } = useContributions();

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-12 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contributions</h1>
          <p className="text-muted-foreground text-sm">
            Manage contribution records
          </p>
        </div>
        <Button
          onClick={() => router.push("/admin/contributions/create")}
          className="w-full sm:w-auto"
        >
          Add New Contribution
        </Button>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card/70 shadow-sm p-4 sm:p-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            Search by employee name or code
          </div>
          <Input
            placeholder="Search employees..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-72"
          />
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <ContributionsTable rows={filteredContributions} loading={loading} />
      </div>
    </div>
  );
}

export default function AdminContributionsPage() {
  return (
    <ContributionsProvider>
      <ContributionsContent />
    </ContributionsProvider>
  );
}
