import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { PUNCH_TYPE, Roles } from "@prisma/client";
import crypto from "crypto";
import { db } from "@/lib/db";
import { createPunchAndMaybeRecompute, getExpectedShiftForDate } from "@/lib/attendance";
import { startOfZonedDay, endOfZonedDay, zonedNow } from "@/lib/timezone";

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

async function verifyPassword(password: string, hash: string, salt: string) {
  const derivedKey = (await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey as Buffer);
    });
  })) as Buffer;
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), derivedKey);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const queryRaw = searchParams.get("query");
    const dateParam = searchParams.get("date");
    if (queryRaw !== null) {
      const query = queryRaw.trim();
      const matches = await db.user.findMany({
        where: {
          ...(query
            ? { username: { contains: query, mode: "insensitive" } }
            : {}),
          isDisabled: false,
          employee: { isNot: null },
        },
        select: {
          username: true,
          role: true,
          employee: {
            select: {
              employeeId: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { username: "asc" },
        take: 10,
      });
      return NextResponse.json({ success: true, data: matches });
    }

    const username = searchParams.get("username")?.trim();
    if (!username) {
      return NextResponse.json({ success: false, error: "username is required" }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { username },
      select: {
        userId: true,
        username: true,
        role: true,
        isDisabled: true,
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

    if (!user || user.isDisabled || !user.employee) {
      return NextResponse.json({ success: false, error: "User not eligible" }, { status: 404 });
    }

    const dayInput = dateParam ? `${dateParam}T00:00:00+08:00` : null;
    const baseDate = dayInput ? new Date(dayInput) : zonedNow();
    const dayStart = startOfZonedDay(baseDate);
    const dayEnd = endOfZonedDay(baseDate);

    const expected = await getExpectedShiftForDate(user.employee.employeeId, dayStart);
    const punches = await db.punch.findMany({
      where: { employeeId: user.employee.employeeId, punchTime: { gte: dayStart, lt: dayEnd } },
      orderBy: { punchTime: "asc" },
    });
    const lastPunch = punches[punches.length - 1] ?? null;

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

    return NextResponse.json({
      success: true,
      data: {
        user: { username: user.username, role: user.role },
        employee: user.employee,
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
    console.error("Failed to load kiosk status", error);
    return NextResponse.json({ success: false, error: "Failed to load status" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const hdr = await headers();
    const clientIp =
      hdr.get("x-forwarded-for")?.split(",")[0].trim() ||
      hdr.get("x-real-ip") ||
      null;
    if (!isIpAllowed(clientIp)) {
      return NextResponse.json(
        { success: false, error: "Punching not allowed from this device" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const username = typeof body?.username === "string" ? body.username.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const punchType = typeof body?.punchType === "string" ? body.punchType : "";
    const dateParam = typeof body?.date === "string" ? body.date : null;

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: "username and password are required" },
        { status: 400 }
      );
    }
    if (!Object.values(PUNCH_TYPE).includes(punchType as PUNCH_TYPE)) {
      return NextResponse.json({ success: false, error: "Invalid punchType" }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { username },
      select: {
        userId: true,
        username: true,
        role: true,
        isDisabled: true,
        password: true,
        salt: true,
        employee: { select: { employeeId: true } },
      },
    });

    if (!user || user.isDisabled || !user.employee) {
      return NextResponse.json({ success: false, error: "User not eligible" }, { status: 404 });
    }

    const valid = await verifyPassword(password, user.password, user.salt);
    if (!valid) {
      return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
    }

    // Enforce sequence: CLOCK_IN -> BREAK_IN -> BREAK_OUT -> CLOCK_OUT
    const dayInput = dateParam ? `${dateParam}T00:00:00+08:00` : null;
    const baseDate = dayInput ? new Date(dayInput) : zonedNow();
    const dayStart = startOfZonedDay(baseDate);
    const dayEnd = endOfZonedDay(baseDate);
    const punchesToday = await db.punch.findMany({
      where: { employeeId: user.employee.employeeId, punchTime: { gte: dayStart, lt: dayEnd } },
      orderBy: { punchTime: "asc" },
    });
    const lastType = punchesToday[punchesToday.length - 1]?.punchType as PUNCH_TYPE | undefined;
    // Enforce sequence and block same-day re-entry after clock out
    const allowedNext: Record<PUNCH_TYPE | "NONE", PUNCH_TYPE> = {
      NONE: PUNCH_TYPE.CLOCK_IN,
      CLOCK_OUT: PUNCH_TYPE.CLOCK_OUT, // block further punches same day
      CLOCK_IN: PUNCH_TYPE.BREAK_IN,
      BREAK_IN: PUNCH_TYPE.BREAK_OUT,
      BREAK_OUT: PUNCH_TYPE.CLOCK_OUT,
    };
    const key = lastType ?? "NONE";
    const expectedNext = allowedNext[key as keyof typeof allowedNext];
    const lastPunchDate =
      punchesToday[punchesToday.length - 1]?.punchTime ?? null;
    const sameDay =
      lastPunchDate &&
      lastPunchDate >= dayStart &&
      lastPunchDate < dayEnd;

    // Disallow clock-in after scheduled end
    if (punchType === PUNCH_TYPE.CLOCK_IN) {
      const expected = await getExpectedShiftForDate(user.employee.employeeId, dayStart);
      if (expected.scheduledEndMinutes != null) {
        const now = zonedNow();
        const minutesSinceStart = Math.round((now.getTime() - dayStart.getTime()) / 60000);
        if (minutesSinceStart > expected.scheduledEndMinutes) {
          return NextResponse.json(
            { success: false, error: "Cannot clock in after shift end" },
            { status: 400 }
          );
        }
      }
    }

    if (lastType === PUNCH_TYPE.CLOCK_OUT && sameDay) {
      return NextResponse.json(
        { success: false, error: "Already clocked out today" },
        { status: 400 }
      );
    }

    if (expectedNext !== punchType) {
      return NextResponse.json(
        {
          success: false,
          error: `Next allowed punch is ${expectedNext.replace("_", " ").toLowerCase()}`,
        },
        { status: 400 }
      );
    }

    const punch = await createPunchAndMaybeRecompute({
      employeeId: user.employee.employeeId,
      punchType: punchType as PUNCH_TYPE,
      punchTime: zonedNow(),
      source: "KIOSK",
      recompute: true,
    });

    return NextResponse.json({ success: true, data: punch });
  } catch (error) {
    console.error("Failed to record kiosk punch", error);
    return NextResponse.json({ success: false, error: "Failed to record punch" }, { status: 500 });
  }
}
