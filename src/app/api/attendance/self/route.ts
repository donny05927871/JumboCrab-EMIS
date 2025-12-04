import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { PUNCH_TYPE } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { createPunchAndMaybeRecompute, getExpectedShiftForDate } from "@/lib/attendance";

const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date: Date) => {
  const d = startOfDay(date);
  d.setDate(d.getDate() + 1);
  return d;
};

const isIpAllowed = (ip: string | null) => {
  const raw = process.env.ALLOWED_PUNCH_IPS;
  if (!raw) return true;
  const list = raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  if (!list.length) return true;
  return ip && list.includes(ip);
};

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");
    const day = dateParam ? new Date(dateParam) : new Date();
    if (Number.isNaN(day.getTime())) {
      return NextResponse.json({ success: false, error: "Invalid date" }, { status: 400 });
    }
    const dayStart = startOfDay(day);
    const dayEnd = endOfDay(day);

    const employee = await db.employee.findUnique({
      where: { userId: session.userId },
      select: {
        employeeId: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        department: { select: { name: true } },
        position: { select: { name: true } },
      },
    });
    if (!employee) {
      return NextResponse.json({ success: false, error: "Employee not found for user" }, { status: 404 });
    }

    const expected = await getExpectedShiftForDate(employee.employeeId, dayStart);
    const punches = await db.punch.findMany({
      where: { employeeId: employee.employeeId, punchTime: { gte: dayStart, lt: dayEnd } },
      orderBy: { punchTime: "asc" },
    });

    // Breaks
    let breakCount = 0;
    let breakMinutes = 0;
    let breakStart: Date | null = null;
    punches.forEach((p) => {
      if (p.punchType === "BREAK_OUT" || p.punchType === "BREAK_IN") {
        if (!breakStart) {
          breakStart = p.punchTime;
        } else {
          breakCount += 1;
          breakMinutes += Math.max(0, Math.round((p.punchTime.getTime() - breakStart.getTime()) / 60000));
          breakStart = null;
        }
      }
    });

    const lastPunch = punches[punches.length - 1] ?? null;

    return NextResponse.json({
      success: true,
      data: {
        employee,
        expected: {
          start: expected.scheduledStartMinutes,
          end: expected.scheduledEndMinutes,
          shiftName: expected.shift?.name ?? null,
          source: expected.source,
        },
        punches,
        lastPunch,
        breakCount,
        breakMinutes,
      },
    });
  } catch (error) {
    console.error("Failed to fetch self attendance status", error);
    return NextResponse.json(
      { success: false, error: "Failed to load attendance status" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const hdr = await headers();
    const clientIp =
      hdr.get("x-forwarded-for")?.split(",")[0].trim() ||
      hdr.get("x-real-ip") ||
      null;
    if (!isIpAllowed(clientIp)) {
      return NextResponse.json({ success: false, error: "Punching not allowed from this device" }, { status: 403 });
    }

    const body = await req.json();
    const punchType = typeof body?.punchType === "string" ? body.punchType : "";
    if (!Object.values(PUNCH_TYPE).includes(punchType as PUNCH_TYPE)) {
      return NextResponse.json({ success: false, error: "Invalid punchType" }, { status: 400 });
    }

    const employee = await db.employee.findUnique({
      where: { userId: session.userId },
      select: { employeeId: true },
    });
    if (!employee) {
      return NextResponse.json({ success: false, error: "Employee not found for user" }, { status: 404 });
    }

    const punch = await createPunchAndMaybeRecompute({
      employeeId: employee.employeeId,
      punchType: punchType as PUNCH_TYPE,
      punchTime: new Date(),
      source: "WEB_SELF",
      recompute: true,
    });

    return NextResponse.json({ success: true, data: punch });
  } catch (error) {
    console.error("Failed to record self punch", error);
    return NextResponse.json({ success: false, error: "Failed to record punch" }, { status: 500 });
  }
}
