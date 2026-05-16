"use server";

import { CashAdvanceRequestStatus, Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  buildCashAdvanceRequestSelect,
  canCreateEmployeeRequests,
  canReviewRequests,
  getEmployeeForSession,
  hasCashAdvanceApprovalColumns,
  serializeCashAdvanceRequest,
} from "./requests-shared";
import type { CashAdvanceRequestRow } from "./types";

const isMissingColumnError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  /column .* does not exist/i.test(error.message);

export async function listCashAdvanceRequests(input?: {
  statuses?: CashAdvanceRequestStatus[] | null;
  employeeId?: string | null;
  limit?: number | null;
}): Promise<{
  success: boolean;
  data?: CashAdvanceRequestRow[];
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

    const where: Prisma.CashAdvanceRequestWhereInput = {};

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
        error: "You are not allowed to view cash advance requests.",
      };
    }

    if (Array.isArray(input?.statuses) && input.statuses.length > 0) {
      where.status = { in: input.statuses };
    }

    const includeApprovalColumns = await hasCashAdvanceApprovalColumns();
    let rows;

    try {
      rows = await db.cashAdvanceRequest.findMany({
        where,
        orderBy: [
          { status: "asc" },
          { submittedAt: "desc" },
          { createdAt: "desc" },
        ],
        take: limit,
        select: buildCashAdvanceRequestSelect(includeApprovalColumns),
      });
    } catch (error) {
      if (!isMissingColumnError(error)) {
        throw error;
      }

      rows = await db.cashAdvanceRequest.findMany({
        where,
        orderBy: [
          { status: "asc" },
          { submittedAt: "desc" },
          { createdAt: "desc" },
        ],
        take: limit,
        select: buildCashAdvanceRequestSelect(false, false),
      });
    }

    return {
      success: true,
      data: rows.map((row) =>
        serializeCashAdvanceRequest({
          ...row,
          approvedAmount: "approvedAmount" in row ? row.approvedAmount : null,
          approvedDeductionMode:
            "approvedDeductionMode" in row ? row.approvedDeductionMode : null,
          approvedRepaymentPerPayroll:
            "approvedRepaymentPerPayroll" in row
              ? row.approvedRepaymentPerPayroll
              : null,
          approvedEffectiveFrom:
            "approvedEffectiveFrom" in row ? row.approvedEffectiveFrom : null,
          deductionAssignment:
            "deductionAssignment" in row ? row.deductionAssignment : null,
        }),
      ),
    };
  } catch (error) {
    console.error("Error listing cash advance requests:", error);
    return { success: false, error: "Failed to load cash advance requests." };
  }
}
