"use server";

import { LeaveRequestStatus, Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  canCreateEmployeeRequests,
  canReviewRequests,
  employeeRequestSelect,
  getEmployeeForSession,
  reviewedBySelect,
  serializeLeaveRequest,
} from "./requests-shared";
import {
  ACTIVE_LEAVE_REQUEST_TYPES,
  getEmployeeLeaveCredits,
} from "./requests-leave-credit-shared";
import type { EmployeeLeaveBalanceSummary, LeaveRequestRow } from "./types";

export async function listLeaveRequests(input?: {
  statuses?: LeaveRequestStatus[] | null;
  employeeId?: string | null;
  limit?: number | null;
}): Promise<{
  success: boolean;
  data?: LeaveRequestRow[];
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn) {
      return { success: false, error: "Not authenticated." };
    }

    const limitRaw =
      typeof input?.limit === "number" && Number.isFinite(input.limit)
        ? Math.floor(input.limit)
        : 200;
    const limit = Math.max(1, Math.min(limitRaw, 500));
    const employeeId =
      typeof input?.employeeId === "string" && input.employeeId.trim()
        ? input.employeeId.trim()
        : null;

    const where: Prisma.LeaveRequestWhereInput = {};

    if (canCreateEmployeeRequests(session.role)) {
      if (!session.userId) {
        return { success: false, error: "Employee session is invalid." };
      }
      const employee = await getEmployeeForSession(session.userId);
      if (!employee || employee.isArchived) {
        return { success: false, error: "Employee record not found." };
      }
      where.employeeId = employee.employeeId;
    } else if (canReviewRequests(session.role)) {
      if (employeeId) {
        where.employeeId = employeeId;
      }
    } else {
      return {
        success: false,
        error: "You are not allowed to view leave requests.",
      };
    }

    if (Array.isArray(input?.statuses) && input.statuses.length > 0) {
      where.status = { in: input.statuses };
    }
    where.leaveType = { in: [...ACTIVE_LEAVE_REQUEST_TYPES] };

    const rows = await db.leaveRequest.findMany({
      where,
      orderBy: [
        { status: "asc" },
        { submittedAt: "desc" },
        { createdAt: "desc" },
      ],
      take: limit,
      include: {
        employee: { select: employeeRequestSelect },
        reviewedBy: { select: reviewedBySelect },
        attendances: {
          select: {
            workDate: true,
          },
        },
      },
    });

    return { success: true, data: rows.map(serializeLeaveRequest) };
  } catch (error) {
    console.error("Error listing leave requests:", error);
    return { success: false, error: "Failed to load leave requests." };
  }
}

export async function getEmployeeLeaveBalanceSummary(input?: {
  year?: number | null;
  employeeId?: string | null;
}): Promise<{
  success: boolean;
  data?: EmployeeLeaveBalanceSummary;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn) {
      return { success: false, error: "Not authenticated." };
    }

    const resolvedYear =
      typeof input?.year === "number" && Number.isInteger(input.year)
        ? input.year
        : new Date().getFullYear();
    const year = Math.max(2000, Math.min(resolvedYear, 2100));

    let employeeId: string | null = null;

    if (canCreateEmployeeRequests(session.role)) {
      if (!session.userId) {
        return { success: false, error: "Employee session is invalid." };
      }

      const employee = await getEmployeeForSession(session.userId);
      if (!employee || employee.isArchived) {
        return { success: false, error: "Employee record not found." };
      }
      employeeId = employee.employeeId;
    } else if (canReviewRequests(session.role)) {
      employeeId =
        typeof input?.employeeId === "string" && input.employeeId.trim()
          ? input.employeeId.trim()
          : null;
      if (!employeeId) {
        return { success: false, error: "Employee is required." };
      }
    } else {
      return {
        success: false,
        error: "You are not allowed to view leave balances.",
      };
    }

    const employee = await db.employee.findUnique({
      where: { employeeId },
      select: { employeeId: true, startDate: true, isArchived: true },
    });
    if (!employee || employee.isArchived) {
      return { success: false, error: "Employee record not found." };
    }

    const credits = await getEmployeeLeaveCredits({
      employeeId: employee.employeeId,
      employeeStartDate: employee.startDate,
      referenceDate: new Date(`${year}-12-31T00:00:00+08:00`),
    });

    return {
      success: true,
      data: {
        referenceDate: new Date(`${year}-12-31T00:00:00+08:00`).toISOString(),
        sick: {
          leaveType: credits.sick.leaveType,
          annualCredits: credits.sick.annualCredits,
          used: credits.sick.annualCredits - credits.sick.balance,
          remaining: credits.sick.balance,
          cycleStartDate: credits.sick.cycleStartDate.toISOString(),
          resetMonth: credits.sick.resetMonth,
          resetDay: credits.sick.resetDay,
        },
        sil: {
          leaveType: credits.sil.leaveType,
          annualCredits: credits.sil.annualCredits,
          used: credits.sil.annualCredits - credits.sil.balance,
          remaining: credits.sil.balance,
          cycleStartDate: credits.sil.cycleStartDate.toISOString(),
          resetMonth: credits.sil.resetMonth,
          resetDay: credits.sil.resetDay,
        },
        year,
        paidLeaveAllowance: credits.sil.annualCredits,
        paidLeaveUsed: credits.sil.annualCredits - credits.sil.balance,
        paidLeaveRemaining: credits.sil.balance,
        paidSickLeaveAllowance: credits.sick.annualCredits,
        paidSickLeaveUsed: credits.sick.annualCredits - credits.sick.balance,
        paidSickLeaveRemaining: credits.sick.balance,
      },
    };
  } catch (error) {
    console.error("Error loading leave balance summary:", error);
    return { success: false, error: "Failed to load leave balances." };
  }
}
