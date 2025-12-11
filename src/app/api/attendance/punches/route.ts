import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { startOfZonedDay, endOfZonedDay } from "@/lib/timezone";
import { recomputeAttendanceForDay } from "@/lib/attendance";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    if (!start) {
      return NextResponse.json({ success: false, error: "start (yyyy-mm-dd) is required" }, { status: 400 });
    }
    // Normalize to the TZ day to match attendance view
    const parsed = new Date(`${start}T00:00:00`);
    const dayStart = startOfZonedDay(parsed);
    const dayEnd = endOfZonedDay(parsed);

    const punches = await db.punch.findMany({
      where: { punchTime: { gte: dayStart, lt: dayEnd } },
      orderBy: { punchTime: "asc" },
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
      },
    });

    return NextResponse.json({ success: true, data: punches });
  } catch (error) {
    console.error("Failed to fetch punches", error);
    return NextResponse.json({ success: false, error: "Failed to load punches" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const id = typeof body?.id === "string" ? body.id : "";
    const punchType = typeof body?.punchType === "string" ? body.punchType : "";
    const punchTimeRaw = typeof body?.punchTime === "string" ? body.punchTime : "";

    if (!id) {
      return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
    }

    const data: Record<string, any> = {};
    if (punchType) data.punchType = punchType;
    if (punchTimeRaw) {
      const parsed = new Date(punchTimeRaw);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ success: false, error: "Invalid punchTime" }, { status: 400 });
      }
      data.punchTime = parsed;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ success: false, error: "No fields to update" }, { status: 400 });
    }

    const updated = await db.punch.update({
      where: { id },
      data,
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
      },
    });

    // Recompute attendance for that day to reflect the edited punch
    if (updated.employeeId && updated.punchTime) {
      await recomputeAttendanceForDay(updated.employeeId, updated.punchTime);
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Failed to update punch", error);
    return NextResponse.json({ success: false, error: "Failed to update punch" }, { status: 500 });
  }
}
