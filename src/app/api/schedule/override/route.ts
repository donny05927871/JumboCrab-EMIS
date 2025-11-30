import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { endOfZonedDay, startOfZonedDay, zonedNow } from "@/lib/timezone";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");

    const startInput = startParam ? new Date(startParam) : zonedNow();
    const endInput = endParam ? new Date(endParam) : null;

    if (Number.isNaN(startInput.getTime())) {
      return NextResponse.json(
        { success: false, error: "Invalid start date" },
        { status: 400 }
      );
    }
    if (endInput && Number.isNaN(endInput.getTime())) {
      return NextResponse.json(
        { success: false, error: "Invalid end date" },
        { status: 400 }
      );
    }

    const start = startOfZonedDay(startInput);
    const end =
      endInput != null
        ? endOfZonedDay(endInput)
        : endOfZonedDay(new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000));

    const overrides = await db.employeeShiftOverride.findMany({
      where: {
        workDate: {
          gte: start,
          lt: end,
        },
      },
      orderBy: { workDate: "asc" },
      include: {
        employee: {
          select: {
            employeeId: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
            position: { select: { name: true } },
          },
        },
        shift: true,
      },
    });

    return NextResponse.json({ success: true, data: overrides });
  } catch (error) {
    console.error("Failed to list overrides", error);
    return NextResponse.json(
      { success: false, error: "Failed to load overrides" },
      { status: 500 }
    );
  }
}

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

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { success: false, error: "id is required" },
        { status: 400 }
      );
    }
    const existing = await db.employeeShiftOverride.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Override not found" }, { status: 404 });
    }
    await db.employeeShiftOverride.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete override", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete override" },
      { status: 500 }
    );
  }
}
