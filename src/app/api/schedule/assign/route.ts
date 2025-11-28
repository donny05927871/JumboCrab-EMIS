import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const employeeId =
      typeof body?.employeeId === "string" && body.employeeId.trim() ? body.employeeId.trim() : "";
    const patternId =
      typeof body?.patternId === "string" && body.patternId.trim() ? body.patternId.trim() : "";
    const effectiveDateRaw = body?.effectiveDate;

    if (!employeeId || !patternId) {
      return NextResponse.json(
        { success: false, error: "employeeId and patternId are required" },
        { status: 400 }
      );
    }

    const effectiveDate = effectiveDateRaw ? new Date(effectiveDateRaw) : new Date();
    if (Number.isNaN(effectiveDate.getTime())) {
      return NextResponse.json(
        { success: false, error: "effectiveDate is invalid" },
        { status: 400 }
      );
    }
    effectiveDate.setHours(0, 0, 0, 0);

    const [employee, pattern] = await Promise.all([
      db.employee.findUnique({ where: { employeeId }, select: { employeeId: true } }),
      db.weeklyPattern.findUnique({ where: { id: patternId }, select: { id: true } }),
    ]);

    if (!employee) {
      return NextResponse.json({ success: false, error: "Employee not found" }, { status: 404 });
    }
    if (!pattern) {
      return NextResponse.json({ success: false, error: "Pattern not found" }, { status: 404 });
    }

    const assignment = await db.employeePatternAssignment.create({
      data: {
        employeeId,
        patternId,
        effectiveDate,
      },
    });

    return NextResponse.json({ success: true, data: assignment });
  } catch (error) {
    console.error("Failed to assign pattern", error);
    return NextResponse.json({ success: false, error: "Failed to assign pattern" }, { status: 500 });
  }
}
