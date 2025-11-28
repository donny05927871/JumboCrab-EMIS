import { NextResponse } from "next/server";
import { recomputeAttendanceForDay } from "@/lib/attendance";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const employeeId =
      typeof body?.employeeId === "string" && body.employeeId.trim() ? body.employeeId.trim() : "";
    const workDateRaw = body?.workDate;

    if (!employeeId) {
      return NextResponse.json(
        { success: false, error: "employeeId is required" },
        { status: 400 }
      );
    }

    const workDate = workDateRaw ? new Date(workDateRaw) : new Date();
    if (Number.isNaN(workDate.getTime())) {
      return NextResponse.json(
        { success: false, error: "workDate is invalid" },
        { status: 400 }
      );
    }

    const result = await recomputeAttendanceForDay(employeeId, workDate);

    return NextResponse.json({ success: true, data: result.attendance });
  } catch (error) {
    console.error("Failed to recompute attendance", error);
    return NextResponse.json(
      { success: false, error: "Failed to recompute attendance" },
      { status: 500 }
    );
  }
}
