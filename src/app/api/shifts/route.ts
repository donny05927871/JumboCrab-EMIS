import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const parseTimeToMinutes = (value: string | null | undefined) => {
  if (!value) return null;
  const [h, m] = value.split(":").map((v) => Number(v));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
};

export async function GET() {
  try {
    const shifts = await db.shift.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json({ success: true, data: shifts });
  } catch (error) {
    console.error("Failed to list shifts", error);
    return NextResponse.json({ success: false, error: "Failed to load shifts" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const startMinutes = parseTimeToMinutes(body?.startTime);
    const endMinutes = parseTimeToMinutes(body?.endTime);
    const spansMidnight = Boolean(body?.spansMidnight);
    const breakMinutesUnpaid =
      typeof body?.breakMinutesUnpaid === "number" && body.breakMinutesUnpaid >= 0
        ? Math.floor(body.breakMinutesUnpaid)
        : 0;
    const paidHoursPerDay =
      typeof body?.paidHoursPerDay === "number" && body.paidHoursPerDay >= 0
        ? new Prisma.Decimal(body.paidHoursPerDay.toFixed(2))
        : null;
    const notes = typeof body?.notes === "string" ? body.notes.trim() : null;

    if (!code || !name) {
      return NextResponse.json(
        { success: false, error: "code and name are required" },
        { status: 400 }
      );
    }
    if (startMinutes == null || endMinutes == null) {
      return NextResponse.json(
        { success: false, error: "startTime and endTime must be HH:mm" },
        { status: 400 }
      );
    }
    if (!spansMidnight && endMinutes <= startMinutes) {
      return NextResponse.json(
        { success: false, error: "endTime must be after startTime unless spansMidnight is true" },
        { status: 400 }
      );
    }

    const shift = await db.shift.create({
      data: {
        code,
        name,
        startMinutes,
        endMinutes,
        spansMidnight,
        breakMinutesUnpaid,
        paidHoursPerDay: paidHoursPerDay ?? new Prisma.Decimal(0),
        notes,
      },
    });

    return NextResponse.json({ success: true, data: shift });
  } catch (error) {
    console.error("Failed to create shift", error);
    return NextResponse.json({ success: false, error: "Failed to create shift" }, { status: 500 });
  }
}
