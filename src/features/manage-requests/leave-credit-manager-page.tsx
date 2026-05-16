"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listEmployeeLeaveCreditLedger,
  listLeaveCreditPolicies,
  listLeaveCreditResetRuns,
  runLeaveCreditReset,
  updateLeaveCreditPolicy,
  type EmployeeLeaveCreditLedgerRow,
  type LeaveCreditPolicyRow,
  type LeaveCreditResetRunRow,
} from "@/actions/requests/requests-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModuleLoadingState } from "@/components/loading/loading-states";
import { useToast } from "@/components/ui/toast-provider";
import { formatDate } from "./request-ui-helpers";

export default function LeaveCreditManagerPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [policies, setPolicies] = useState<LeaveCreditPolicyRow[]>([]);
  const [runs, setRuns] = useState<LeaveCreditResetRunRow[]>([]);
  const [ledger, setLedger] = useState<EmployeeLeaveCreditLedgerRow[]>([]);
  const [policyDrafts, setPolicyDrafts] = useState<
    Record<string, { resetMonth: string; resetDay: string; annualCredits: string }>
  >({});
  const [runningResetFor, setRunningResetFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [policyResult, runResult, ledgerResult] = await Promise.all([
        listLeaveCreditPolicies(),
        listLeaveCreditResetRuns(),
        listEmployeeLeaveCreditLedger({ limit: 100 }),
      ]);

      if (!policyResult.success) {
        throw new Error(policyResult.error || "Failed to load leave credit policies.");
      }
      if (!runResult.success) {
        throw new Error(runResult.error || "Failed to load leave credit reset history.");
      }
      if (!ledgerResult.success) {
        throw new Error(ledgerResult.error || "Failed to load leave credit ledger.");
      }

      setPolicies(policyResult.data ?? []);
      setRuns(runResult.data ?? []);
      setLedger(ledgerResult.data ?? []);
      setPolicyDrafts(
        Object.fromEntries(
          (policyResult.data ?? []).map((row) => [
            row.leaveType,
            {
              resetMonth: String(row.resetMonth),
              resetDay: String(row.resetDay),
              annualCredits: String(row.annualCredits),
            },
          ]),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leave credit module.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const savePolicy = async (leaveType: "SICK" | "SIL") => {
    try {
      const draft = policyDrafts[leaveType];
      const result = await updateLeaveCreditPolicy({
        leaveType,
        resetMonth: Number(draft?.resetMonth ?? 1),
        resetDay: Number(draft?.resetDay ?? 1),
        annualCredits: Number(draft?.annualCredits ?? 5),
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to save leave credit policy.");
      }
      toast.success("Policy saved", {
        description: `${leaveType} policy updated.`,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save leave credit policy.");
    }
  };

  const triggerReset = async (leaveType: "SICK" | "SIL") => {
    try {
      setRunningResetFor(leaveType);
      const result = await runLeaveCreditReset({ leaveType });
      if (!result.success) {
        throw new Error(result.error || "Failed to run leave credit reset.");
      }
      toast.success("Reset run completed", {
        description: `${leaveType} credits were reset for the current cycle.`,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run leave credit reset.");
    } finally {
      setRunningResetFor(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Leave Credit Settings</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <ModuleLoadingState
              title="Loading leave credits"
              description="Fetching credit policies, reset history, and ledger entries."
            />
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {policies.map((policy) => {
                const draft = policyDrafts[policy.leaveType];
                return (
                  <Card key={policy.id} className="border-border/70">
                    <CardContent className="space-y-4 p-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          {policy.leaveType}
                        </p>
                        <p className="mt-2 text-lg font-semibold">
                          {policy.annualCredits} credits
                        </p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="space-y-1">
                          <Label>Month</Label>
                          <Input
                            value={draft?.resetMonth ?? ""}
                            onChange={(event) =>
                              setPolicyDrafts((current) => ({
                                ...current,
                                [policy.leaveType]: {
                                  ...current[policy.leaveType],
                                  resetMonth: event.target.value,
                                },
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Day</Label>
                          <Input
                            value={draft?.resetDay ?? ""}
                            onChange={(event) =>
                              setPolicyDrafts((current) => ({
                                ...current,
                                [policy.leaveType]: {
                                  ...current[policy.leaveType],
                                  resetDay: event.target.value,
                                },
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Credits</Label>
                          <Input
                            value={draft?.annualCredits ?? ""}
                            onChange={(event) =>
                              setPolicyDrafts((current) => ({
                                ...current,
                                [policy.leaveType]: {
                                  ...current[policy.leaveType],
                                  annualCredits: event.target.value,
                                },
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => void savePolicy(policy.leaveType)}>
                          Save policy
                        </Button>
                        <Button
                          variant="outline"
                          disabled={runningResetFor === policy.leaveType}
                          onClick={() => void triggerReset(policy.leaveType)}
                        >
                          Run reset now
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reset History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reset runs yet.</p>
          ) : (
            runs.map((run) => (
              <div key={run.id} className="rounded-xl border border-border/70 p-4 text-sm">
                <p className="font-medium">
                  {run.leaveType} · {formatDate(run.effectiveDate)}
                </p>
                <p className="text-muted-foreground">
                  Cycle {formatDate(run.cycleStartDate)} to {formatDate(run.cycleEndDate)}
                </p>
                <p className="text-muted-foreground">
                  {run.employeeCount} employees · {run.annualCredits} credits · {run.runType}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Credit Ledger</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {ledger.length === 0 ? (
            <p className="text-sm text-muted-foreground">No leave credit ledger entries yet.</p>
          ) : (
            ledger.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-border/70 p-4 text-sm">
                <p className="font-medium">
                  {entry.employeeName} · {entry.leaveType} · {entry.entryType}
                </p>
                <p className="text-muted-foreground">
                  {formatDate(entry.effectiveDate)} · {entry.amount > 0 ? `+${entry.amount}` : entry.amount}
                </p>
                <p className="text-muted-foreground">
                  Balance {entry.balanceBefore} → {entry.balanceAfter}
                </p>
                {entry.notes ? (
                  <p className="text-muted-foreground">{entry.notes}</p>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
