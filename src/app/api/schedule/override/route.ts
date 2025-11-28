import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { startOfZonedDay } from "@/lib/timezone";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const employeeId =
      typeof body?.employeeId === "string" && body.employeeId.trim() ? body.employeeId.trim() : "";
    const workDateRaw = body?.workDate;
    const shiftId = typeof body?.shiftId === "number" ? body.shiftId : null;
    const source =
      typeof body?.source === "string" && body.source.trim() ? body.source.trim() : "MANUAL";

    if (!employeeId) {
      return NextResponse.json(
        { success: false, error: "employeeId is required" },
        { status: 400 }
      );
    }

    const workDateInput = workDateRaw ? new Date(workDateRaw) : new Date();
    if (Number.isNaN(workDateInput.getTime())) {
      return NextResponse.json(
        { success: false, error: "workDate is invalid" },
        { status: 400 }
      );
    }
    const workDate = startOfZonedDay(workDateInput);

    const [employee, shift] = await Promise.all([
      db.employee.findUnique({ where: { employeeId }, select: { employeeId: true } }),
      shiftId ? db.shift.findUnique({ where: { id: shiftId }, select: { id: true } }) : Promise.resolve(null),
    ]);

    if (!employee) {
      return NextResponse.json({ success: false, error: "Employee not found" }, { status: 404 });
    }
    if (shiftId && !shift) {
      return NextResponse.json({ success: false, error: "Shift not found" }, { status: 404 });
    }

    const existing = await db.employeeShiftOverride.findFirst({
      where: { employeeId, workDate },
      select: { id: true },
    });

    const data = {
      employeeId,
      workDate,
      shiftId: shiftId ?? null,
      source,
    };

    const override = existing
      ? await db.employeeShiftOverride.update({ where: { id: existing.id }, data })
      : await db.employeeShiftOverride.create({ data });

    return NextResponse.json({ success: true, data: override });
  } catch (error) {
    console.error("Failed to save override", error);
    return NextResponse.json(
      { success: false, error: "Failed to save override" },
      { status: 500 }
    );
  }
}
