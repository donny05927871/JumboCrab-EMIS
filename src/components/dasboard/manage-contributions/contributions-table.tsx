"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ContributionRow } from "@/hooks/use-contributions";
import { cn } from "@/lib/utils";

type ContributionsTableProps = {
  rows: ContributionRow[];
  loading?: boolean;
};

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function ContributionsTable({ rows, loading }: ContributionsTableProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card/70 p-6 text-sm text-muted-foreground">
        Loading contributions...
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card/70 p-6 text-sm text-muted-foreground">
        No contributions found.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card/70 shadow-sm overflow-hidden">
      <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-3 text-sm font-medium text-muted-foreground border-b border-border/70">
        <div className="col-span-6">Employee</div>
        <div className="col-span-3">EE Contribution</div>
        <div className="col-span-3 text-right">Last Updated</div>
      </div>
      <div className="divide-y divide-border/70">
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-1 gap-3 px-4 py-4 text-sm items-start md:grid-cols-12 md:items-center"
          >
            <div className="md:col-span-6 flex items-center gap-3">
              <Avatar className="h-10 w-10">
                {row.avatarUrl ? (
                  <AvatarImage src={row.avatarUrl} alt={row.employeeName} />
                ) : (
                  <AvatarFallback>
                    {row.employeeName
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="min-w-0">
                <div className="font-medium text-foreground">
                  {row.employeeName}
                </div>
                <div className="text-xs text-muted-foreground">
                  {row.employeeCode}
                </div>
              </div>
            </div>

            <div className="md:col-span-3">
              <p className="text-xs text-muted-foreground md:hidden">
                EE Contribution
              </p>
              <p className="text-base font-semibold">
                {formatAmount(row.eeContribution)}
              </p>
            </div>

            <div className={cn("md:col-span-3 text-muted-foreground", "md:text-right")}>
              <p className="text-xs text-muted-foreground md:hidden">
                Last Updated
              </p>
              <p>{row.updatedAt || "—"}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
