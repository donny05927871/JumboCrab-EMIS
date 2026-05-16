"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listCashAdvanceRequests,
  listDayOffRequests,
  listLeaveRequests,
  listScheduleChangeRequests,
  listScheduleSwapRequests,
  reviewCashAdvanceRequest,
  reviewDayOffRequest,
  reviewLeaveRequest,
  reviewScheduleChangeRequest,
  reviewScheduleSwapRequest,
  type CashAdvanceRequestRow,
  type DayOffRequestRow,
  type LeaveRequestRow,
  type ScheduleChangeRequestRow,
  type ScheduleSwapRequestRow,
} from "@/actions/requests/requests-action";
import {
  formatDate,
  formatDateRange,
  formatMoney,
  leaveTypeLabel,
  linkedDeductionStatusLabel,
  requestStatusClass,
  requestStatusLabel,
  requestTypeLabel,
} from "@/features/manage-requests/request-ui-helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ModuleLoadingState } from "@/components/loading/loading-states";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast-provider";

type ManagerRequestRow =
  | ({ requestType: "CASH_ADVANCE" } & CashAdvanceRequestRow)
  | ({ requestType: "LEAVE" } & LeaveRequestRow)
  | ({ requestType: "DAY_OFF" } & DayOffRequestRow)
  | ({ requestType: "SCHEDULE_CHANGE" } & ScheduleChangeRequestRow)
  | ({ requestType: "SCHEDULE_SWAP" } & ScheduleSwapRequestRow);

export default function ManagerRequestsPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ManagerRequestRow[]>([]);
  const [reviewingKey, setReviewingKey] = useState<string | null>(null);
  const [managerRemarks, setManagerRemarks] = useState<Record<string, string>>({});
  const [approvedAmounts, setApprovedAmounts] = useState<Record<string, string>>({});
  const [deductionModes, setDeductionModes] = useState<Record<string, "FULL_NEXT_PAYROLL" | "INSTALLMENTS">>({});
  const [approvedEffectiveDates, setApprovedEffectiveDates] = useState<Record<string, string>>({});
  const [approvedRepayments, setApprovedRepayments] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [cash, leave, dayOff, change, swap] = await Promise.all([
        listCashAdvanceRequests(),
        listLeaveRequests(),
        listDayOffRequests(),
        listScheduleChangeRequests(),
        listScheduleSwapRequests(),
      ]);

      if (!cash.success) throw new Error(cash.error || "Failed to load cash advances.");
      if (!leave.success) throw new Error(leave.error || "Failed to load leave requests.");
      if (!dayOff.success) throw new Error(dayOff.error || "Failed to load change day off requests.");
      if (!change.success) throw new Error(change.error || "Failed to load change shift requests.");
      if (!swap.success) throw new Error(swap.error || "Failed to load shift swaps.");

      setRows([
        ...(cash.data ?? []).map((row) => ({ ...row, requestType: "CASH_ADVANCE" as const })),
        ...(leave.data ?? []).map((row) => ({ ...row, requestType: "LEAVE" as const })),
        ...(dayOff.data ?? []).map((row) => ({ ...row, requestType: "DAY_OFF" as const })),
        ...(change.data ?? []).map((row) => ({ ...row, requestType: "SCHEDULE_CHANGE" as const })),
        ...(swap.data ?? []).map((row) => ({ ...row, requestType: "SCHEDULE_SWAP" as const })),
      ].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()));
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : "Failed to load requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingRows = useMemo(
    () =>
      rows.filter((row) =>
        row.requestType === "SCHEDULE_SWAP"
          ? row.status === "PENDING_MANAGER"
          : row.status === "PENDING_MANAGER",
      ),
    [rows],
  );

  const reviewedRows = useMemo(
    () => rows.filter((row) => row.status !== "PENDING_MANAGER"),
    [rows],
  );

  const reviewRow = async (
    row: ManagerRequestRow,
    decision: "APPROVED" | "REJECTED",
  ) => {
    try {
      setReviewingKey(`${row.requestType}:${row.id}:${decision}`);
      const common = {
        id: row.id,
        decision,
        managerRemarks: managerRemarks[row.id] ?? "",
      };
      const result =
        row.requestType === "CASH_ADVANCE"
          ? await reviewCashAdvanceRequest({
              ...common,
              approvedAmount: approvedAmounts[row.id] || String(row.amount),
              deductionMode:
                deductionModes[row.id] ??
                (row.approvedDeductionMode ?? "FULL_NEXT_PAYROLL"),
              approvedRepaymentPerPayroll:
                approvedRepayments[row.id] ||
                String(row.approvedRepaymentPerPayroll ?? row.amount),
              approvedEffectiveFrom:
                approvedEffectiveDates[row.id] ||
                new Date().toISOString().slice(0, 10),
            })
          : row.requestType === "LEAVE"
            ? await reviewLeaveRequest(common)
            : row.requestType === "DAY_OFF"
              ? await reviewDayOffRequest(common)
              : row.requestType === "SCHEDULE_CHANGE"
                ? await reviewScheduleChangeRequest(common)
                : await reviewScheduleSwapRequest(common);

      if (!result.success) {
        throw new Error(result.error || "Failed to review request.");
      }

      toast.success(
        decision === "APPROVED" ? "Request approved" : "Request rejected",
        {
          description: `${requestTypeLabel(row.requestType)} review saved.`,
        },
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to review request.");
    } finally {
      setReviewingKey(null);
    }
  };

  const renderRequestBody = (row: ManagerRequestRow) => {
    if (row.requestType === "LEAVE") {
      return (
        <div className="space-y-1 text-sm">
          <p className="font-medium">{leaveTypeLabel(row.leaveType)}</p>
          <p className="text-muted-foreground">
            {formatDateRange(row.startDate, row.endDate)} · {row.totalDays} day(s)
          </p>
          <p className="text-muted-foreground">
            Credit usage: {row.creditDaysUsed}
          </p>
        </div>
      );
    }

    if (row.requestType === "DAY_OFF") {
      return (
        <div className="space-y-1 text-sm">
          <p className="text-muted-foreground">
            Move OFF from {formatDate(row.sourceOffDate)} to {formatDate(row.targetWorkDate)}
          </p>
          <p className="text-muted-foreground">
            Source: {row.sourceShiftLabel} · Target: {row.targetShiftLabel}
          </p>
        </div>
      );
    }

    if (row.requestType === "SCHEDULE_CHANGE") {
      return (
        <div className="space-y-1 text-sm">
          <p className="text-muted-foreground">
            {formatDateRange(row.startDate, row.endDate)} · {row.totalDays} day(s)
          </p>
          <p className="text-muted-foreground">Requested shift: {row.requestedShiftLabel}</p>
        </div>
      );
    }

    if (row.requestType === "SCHEDULE_SWAP") {
      return (
        <div className="space-y-1 text-sm">
          <p className="text-muted-foreground">
            {formatDate(row.workDate)} · {row.requesterEmployeeName} ↔ {row.coworkerEmployeeName}
          </p>
          <p className="text-muted-foreground">
            {row.requesterEmployeeName}: {row.requesterShiftLabel}
          </p>
          <p className="text-muted-foreground">
            {row.coworkerEmployeeName}: {row.coworkerShiftLabel}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-2 text-sm">
        <p className="font-medium">{formatMoney(row.amount)}</p>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Approved amount
            </label>
            <Input
              value={approvedAmounts[row.id] ?? String(row.amount)}
              onChange={(event) =>
                setApprovedAmounts((current) => ({
                  ...current,
                  [row.id]: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Deduction mode
            </label>
            <Select
              value={
                deductionModes[row.id] ??
                (row.approvedDeductionMode ?? "FULL_NEXT_PAYROLL")
              }
              onValueChange={(value) =>
                setDeductionModes((current) => ({
                  ...current,
                  [row.id]: value as "FULL_NEXT_PAYROLL" | "INSTALLMENTS",
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FULL_NEXT_PAYROLL">Full next payroll</SelectItem>
                <SelectItem value="INSTALLMENTS">Installments</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Effective date
            </label>
            <Input
              type="date"
              value={approvedEffectiveDates[row.id] ?? new Date().toISOString().slice(0, 10)}
              onChange={(event) =>
                setApprovedEffectiveDates((current) => ({
                  ...current,
                  [row.id]: event.target.value,
                }))
              }
            />
          </div>
        </div>
        {(deductionModes[row.id] ?? row.approvedDeductionMode ?? "FULL_NEXT_PAYROLL") ===
        "INSTALLMENTS" ? (
          <div className="space-y-1 md:max-w-xs">
            <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Repayment per payroll
            </label>
            <Input
              value={approvedRepayments[row.id] ?? String(row.approvedRepaymentPerPayroll ?? row.amount)}
              onChange={(event) =>
                setApprovedRepayments((current) => ({
                  ...current,
                  [row.id]: event.target.value,
                }))
              }
            />
          </div>
        ) : null}
        {row.linkedDeductionStatus ? (
          <p className="text-muted-foreground">
            Linked deduction: {linkedDeductionStatusLabel(row.linkedDeductionStatus)}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Requests</CardTitle>
            <p className="text-sm text-muted-foreground">
              Simplified request review for leave, day-off transfers, shift changes,
              swap requests, and cash advance approvals.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/manager/requests/leave-credits">Leave Credits</Link>
          </Button>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending Review</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <ModuleLoadingState
              title="Loading manager requests"
              description="Fetching pending and reviewed employee requests."
            />
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : pendingRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending requests.</p>
          ) : (
            <div className="space-y-4">
              {pendingRows.map((row) => (
                <div key={`${row.requestType}:${row.id}`} className="rounded-xl border border-border/70 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{requestTypeLabel(row.requestType)}</p>
                        <Badge variant="outline" className={requestStatusClass(row.status)}>
                          {requestStatusLabel(row.status)}
                        </Badge>
                      </div>
                      {"employeeName" in row ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {row.employeeName} · {row.employeeCode}
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {row.requesterEmployeeName} · {row.requesterEmployeeCode}
                        </p>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Submitted {formatDate(row.submittedAt)}
                    </p>
                  </div>

                  <div className="mt-3">{renderRequestBody(row)}</div>

                  {row.reason ? (
                    <p className="mt-3 text-sm text-muted-foreground">{row.reason}</p>
                  ) : null}

                  <Textarea
                    className="mt-3"
                    rows={3}
                    placeholder="Manager remarks"
                    value={managerRemarks[row.id] ?? ""}
                    onChange={(event) =>
                      setManagerRemarks((current) => ({
                        ...current,
                        [row.id]: event.target.value,
                      }))
                    }
                  />

                  <div className="mt-3 flex gap-2">
                    <Button
                      disabled={reviewingKey === `${row.requestType}:${row.id}:APPROVED`}
                      onClick={() => void reviewRow(row, "APPROVED")}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      disabled={reviewingKey === `${row.requestType}:${row.id}:REJECTED`}
                      onClick={() => void reviewRow(row, "REJECTED")}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reviewed</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? null : reviewedRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reviewed requests yet.</p>
          ) : (
            <div className="space-y-4">
              {reviewedRows.map((row) => (
                <div key={`${row.requestType}:${row.id}`} className="rounded-xl border border-border/70 p-4">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{requestTypeLabel(row.requestType)}</p>
                    <Badge variant="outline" className={requestStatusClass(row.status)}>
                      {requestStatusLabel(row.status)}
                    </Badge>
                  </div>
                  {"employeeName" in row ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {row.employeeName} · {row.employeeCode}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {row.requesterEmployeeName} · {row.requesterEmployeeCode}
                    </p>
                  )}
                  <div className="mt-3">{renderRequestBody(row)}</div>
                  {row.managerRemarks ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Remarks: {row.managerRemarks}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
