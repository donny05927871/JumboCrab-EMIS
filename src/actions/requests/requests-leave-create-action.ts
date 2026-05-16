"use server";

import { LeaveRequestStatus } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { startOfZonedDay } from "@/lib/timezone";
import { leaveRequestSchema } from "@/lib/validations/requests";
import {
  canCreateEmployeeRequests,
  DAY_MS,
  employeeRequestSelect,
  enumerateZonedDaysInclusive,
  getEmployeeForSession,
  revalidateRequestLayouts,
  reviewedBySelect,
  serializeLeaveRequest,
} from "./requests-shared";
import {
  getEmployeeLeaveCredits,
  toLeaveCreditType,
} from "./requests-leave-credit-shared";
import { notifyManagersOfRequest } from "./requests-notifications";
import type { LeaveRequestPayload, LeaveRequestRow } from "./types";

export async function createLeaveRequest(
  input: LeaveRequestPayload,
): Promise<{
  success: boolean;
  data?: LeaveRequestRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canCreateEmployeeRequests(session.role)) {
      return {
        success: false,
        error: "You are not allowed to create leave requests.",
      };
    }
    if (!session.userId) {
      return { success: false, error: "Employee session is invalid." };
    }

    const parsed = leaveRequestSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid leave request data.",
      };
    }

    const employee = await getEmployeeForSession(session.userId);
    if (!employee || employee.isArchived) {
      return { success: false, error: "Employee record not found." };
    }

    const startDate = startOfZonedDay(parsed.data.startDate!);
    const endDate = startOfZonedDay(parsed.data.endDate!);
    const leaveDates = enumerateZonedDaysInclusive(startDate, endDate);
    const leaveDays = leaveDates.length;
    const leaveCreditType = toLeaveCreditType(parsed.data.leaveType);

    if (leaveCreditType) {
      const credits = await getEmployeeLeaveCredits({
        employeeId: employee.employeeId,
        employeeStartDate: employee.startDate ?? new Date(),
        referenceDate: startDate,
      });
      const bucket =
        leaveCreditType === "SICK" ? credits.sick : credits.sil;

      if (bucket.balance <= 0) {
        return {
          success: false,
          error: `${parsed.data.leaveType} credits are already at zero.`,
        };
      }
      if (leaveDays > bucket.balance) {
        return {
          success: false,
          error: `Only ${bucket.balance} ${parsed.data.leaveType} credit${bucket.balance === 1 ? "" : "s"} remain.`,
        };
      }
    }

    if (parsed.data.leaveType === "SIL") {
      const minimumAllowed = new Date(startOfZonedDay(new Date()).getTime() + 14 * DAY_MS);
      const invalidDay = leaveDates.find((day) => day.getTime() < minimumAllowed.getTime());
      if (invalidDay) {
        return {
          success: false,
          error: "Service Incentive Leave must be requested at least 14 days in advance.",
        };
      }
    }

    const overlapping = await db.leaveRequest.findFirst({
      where: {
        employeeId: employee.employeeId,
        leaveType: { in: ["SICK", "SIL", "UNPAID"] },
        status: {
          in: [LeaveRequestStatus.PENDING_MANAGER, LeaveRequestStatus.APPROVED],
        },
        startDate: {
          lte: endDate,
        },
        endDate: {
          gte: startDate,
        },
      },
      select: { id: true },
    });

    if (overlapping) {
      return {
        success: false,
        error:
          "There is already a pending or approved leave request overlapping these dates.",
      };
    }

    const created = await db.leaveRequest.create({
      data: {
        employeeId: employee.employeeId,
        leaveType: parsed.data.leaveType,
        startDate,
        endDate,
        reason: parsed.data.reason ?? null,
        status: LeaveRequestStatus.PENDING_MANAGER,
      },
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

    revalidateRequestLayouts();
    await notifyManagersOfRequest({
      eventType: "LEAVE_REQUEST_SUBMITTED",
      title: "Leave request submitted",
      message: `${employee.firstName} ${employee.lastName} submitted a leave request.`,
      actorUserId: session.userId ?? null,
      entityType: "LeaveRequest",
      entityId: created.id,
    });
    return { success: true, data: serializeLeaveRequest(created) };
  } catch (error) {
    console.error("Error creating leave request:", error);
    return { success: false, error: "Failed to create leave request." };
  }
}
