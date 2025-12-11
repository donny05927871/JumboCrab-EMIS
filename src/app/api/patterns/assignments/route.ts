import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const assignments = await db.employeePatternAssignment.findMany({
      orderBy: [{ employeeId: "asc" }, { effectiveDate: "desc" }],
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
        pattern: {
          include: {
            sunShift: true,
            monShift: true,
            tueShift: true,
            wedShift: true,
            thuShift: true,
            friShift: true,
            satShift: true,
          },
        },
      },
    });

    const latestByEmployee = new Set<string>();
    const withLatest = assignments.map((a) => {
      const isLatest = !latestByEmployee.has(a.employeeId);
      if (isLatest) latestByEmployee.add(a.employeeId);
      return { ...a, isLatest };
    });

    return NextResponse.json({
      success: true,
      data: withLatest,
    });
  } catch (error) {
    console.error("Failed to fetch pattern assignments", error);
    return NextResponse.json({ success: false, error: "Failed to load assignments" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
    }
    await db.employeePatternAssignment.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete pattern assignment", error);
    return NextResponse.json({ success: false, error: "Failed to delete assignment" }, { status: 500 });
  }
}
