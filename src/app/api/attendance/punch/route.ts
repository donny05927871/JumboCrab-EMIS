import { NextResponse } from "next/server";
import { PUNCH_TYPE } from "@prisma/client";
import { createPunchAndMaybeRecompute } from "@/lib/attendance";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const employeeId =
      typeof body?.employeeId === "string" && body.employeeId.trim() ? body.employeeId.trim() : "";
    const punchType = typeof body?.punchType === "string" ? body.punchType : "";
    const punchTimeRaw = body?.punchTime;
    const source = typeof body?.source === "string" ? body.source : null;
    const recompute = Boolean(body?.recompute);

    if (!employeeId) {
      return NextResponse.json(
        { success: false, error: "employeeId is required" },
        { status: 400 }
      );
    }

    if (!Object.values(PUNCH_TYPE).includes(punchType as PUNCH_TYPE)) {
      return NextResponse.json(
        { success: false, error: "punchType is invalid" },
        { status: 400 }
      );
    }

    const punchTime = punchTimeRaw ? new Date(punchTimeRaw) : new Date();
    if (Number.isNaN(punchTime.getTime())) {
      return NextResponse.json(
        { success: false, error: "punchTime is invalid" },
        { status: 400 }
      );
    }

    const { punch, attendance } = await createPunchAndMaybeRecompute({
      employeeId,
      punchType: punchType as PUNCH_TYPE,
      punchTime,
      source,
      recompute,
    });

    return NextResponse.json({ success: true, punch, attendance });
  } catch (error) {
    console.error("Failed to record punch", error);
    return NextResponse.json(
      { success: false, error: "Failed to record punch" },
      { status: 500 }
    );
  }
}
