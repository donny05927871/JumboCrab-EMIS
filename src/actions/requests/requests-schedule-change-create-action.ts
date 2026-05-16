"use server";

import {
  DayOffRequestStatus,
  ScheduleChangeRequestStatus,
  ScheduleSwapRequestStatus,
} from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getExpectedShiftForDate } from "@/lib/attendance";
import { startOfZonedDay } from "@/lib/timezone";
import { scheduleChangeRequestSchema } from "@/lib/validations/requests";
import {
  buildScheduleChangePreview,
  canCreateEmployeeRequests,
  employeeRequestSelect,
  enumerateZonedDaysInclusive,
  getEmployeeForSession,
  getScheduleSwapBlockingIssue,
  revalidateRequestLayouts,
  reviewedBySelect,
  serializeScheduleChangeRequest,
} from "./requests-shared";
import { notifyManagersOfRequest } from "./requests-notifications";
import type {
  ScheduleChangeRequestPayload,
  ScheduleChangeRequestRow,
} from "./types";

export async function createScheduleChangeRequest(
  input: ScheduleChangeRequestPayload,
): Promise<{
  success: boolean;
  data?: ScheduleChangeRequestRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canCreateEmployeeRequests(session.role)) {
      return {
        success: false,
        error: "You are not allowed to create schedule change requests.",
      };
    }
    if (!session.userId) {
      return { success: false, error: "Employee session is invalid." };
    }

    const parsed = scheduleChangeRequestSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error:
          parsed.error.issues[0]?.message || "Invalid schedule change data.",
      };
    }

    const employee = await getEmployeeForSession(session.userId);
    if (!employee || employee.isArchived) {
      return { success: false, error: "Employee record not found." };
    }

    const startDate = startOfZonedDay(parsed.data.startDate!);
    const endDate = startOfZonedDay(parsed.data.endDate!);
    const today = startOfZonedDay(new Date());
    if (startDate.getTime() < today.getTime()) {
      return {
        success: false,
        error: "Schedule changes can only be requested for today or future dates.",
      };
    }

    const previewResult = await buildScheduleChangePreview(
      employee.employeeId,
      parsed.data.requestedShiftId!,
      startDate,
      endDate,
    );

    if ("error" in previewResult) {
      return { success: false, error: previewResult.error };
    }
    const requestDates = enumerateZonedDaysInclusive(startDate, endDate);
    const firstExpected = await getExpectedShiftForDate(employee.employeeId, startDate);
    if (!firstExpected.shift || firstExpected.shift.isDayOff) {
      return {
        success: false,
        error: "The range must start on a scheduled workday.",
      };
    }
    for (const day of requestDates) {
      const expected = day.getTime() === startDate.getTime()
        ? firstExpected
        : await getExpectedShiftForDate(employee.employeeId, day);
      if (!expected.shift || expected.shift.isDayOff) {
        return {
          success: false,
          error: "Every day in the selected range must be a scheduled workday.",
        };
      }
    }

    const [blockingIssue, duplicate, dayOffConflict, swapConflict] =
      await Promise.all([
        getScheduleSwapBlockingIssue(
          employee.employeeId,
          startDate,
          previewResult.preview.employee.employeeName,
        ),
        db.scheduleChangeRequest.findFirst({
          where: {
            employeeId: employee.employeeId,
            OR: [
              {
                startDate: { lte: endDate },
                endDate: { gte: startDate },
              },
              {
                workDate: {
                  gte: startDate,
                  lte: endDate,
                },
              },
            ],
            status: {
              in: [
                ScheduleChangeRequestStatus.PENDING_MANAGER,
                ScheduleChangeRequestStatus.APPROVED,
              ],
            },
          },
          select: { id: true },
        }),
        db.dayOffRequest.findFirst({
          where: {
            employeeId: employee.employeeId,
            OR: [
              { targetWorkDate: { gte: startDate, lte: endDate } },
              { sourceOffDate: { gte: startDate, lte: endDate } },
              { workDate: { gte: startDate, lte: endDate } },
            ],
            status: {
              in: [DayOffRequestStatus.PENDING_MANAGER, DayOffRequestStatus.APPROVED],
            },
          },
          select: { id: true },
        }),
        db.scheduleSwapRequest.findFirst({
          where: {
            workDate: {
              gte: startDate,
              lte: endDate,
            },
            status: {
              in: [
                ScheduleSwapRequestStatus.PENDING_COWORKER,
                ScheduleSwapRequestStatus.PENDING_MANAGER,
                ScheduleSwapRequestStatus.APPROVED,
              ],
            },
            OR: [
              { requesterEmployeeId: employee.employeeId },
              { coworkerEmployeeId: employee.employeeId },
            ],
          },
          select: { id: true },
        }),
      ]);

    if (blockingIssue) {
      return { success: false, error: blockingIssue };
    }
    if (duplicate) {
      return {
        success: false,
        error:
          "There is already an active schedule change request for that date.",
      };
    }
    if (dayOffConflict) {
      return {
        success: false,
        error: "There is already an active day off request for that date.",
      };
    }
    if (swapConflict) {
      return {
        success: false,
        error:
          "There is already an active schedule swap request involving you on that date.",
      };
    }

    const created = await db.scheduleChangeRequest.create({
      data: {
        employeeId: employee.employeeId,
        workDate: startDate,
        startDate,
        endDate,
        currentShiftIdSnapshot: firstExpected.shift?.id ?? null,
        currentShiftCodeSnapshot: firstExpected.shift?.code ?? null,
        currentShiftNameSnapshot: firstExpected.shift?.name ?? null,
        currentStartMinutesSnapshot: firstExpected.scheduledStartMinutes,
        currentEndMinutesSnapshot: firstExpected.scheduledEndMinutes,
        currentSpansMidnightSnapshot:
          firstExpected.shift?.spansMidnight ?? false,
        requestedShiftId: previewResult.requestedShift.id,
        requestedShiftCodeSnapshot: previewResult.requestedShift.code,
        requestedShiftNameSnapshot: previewResult.requestedShift.name,
        requestedStartMinutesSnapshot: previewResult.requestedShift.startMinutes,
        requestedEndMinutesSnapshot: previewResult.requestedShift.endMinutes,
        requestedSpansMidnightSnapshot:
          previewResult.requestedShift.spansMidnight,
        reason: parsed.data.reason ?? null,
        status: ScheduleChangeRequestStatus.PENDING_MANAGER,
      },
      include: {
        employee: { select: employeeRequestSelect },
        reviewedBy: { select: reviewedBySelect },
      },
    });

    revalidateRequestLayouts();
    await notifyManagersOfRequest({
      eventType: "SCHEDULE_CHANGE_REQUEST_SUBMITTED",
      title: "Schedule change request submitted",
      message: `${employee.firstName} ${employee.lastName} submitted a schedule change request.`,
      actorUserId: session.userId ?? null,
      entityType: "ScheduleChangeRequest",
      entityId: created.id,
    });
    return { success: true, data: serializeScheduleChangeRequest(created) };
  } catch (error) {
    console.error("Error creating schedule change request:", error);
    return {
      success: false,
      error: "Failed to create schedule change request.",
    };
  }
}
