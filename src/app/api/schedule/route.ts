import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDailySchedule } from "@/lib/schedule";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");
    const date = dateParam ? new Date(dateParam) : new Date();
    if (Number.isNaN(date.getTime())) {
      return NextResponse.json({ success: false, error: "Invalid date" }, { status: 400 });
    }

    const [schedule, patterns, shifts] = await Promise.all([
      getDailySchedule(date),
      db.weeklyPattern.findMany({
        orderBy: { name: "asc" },
        include: {
          sunShift: true,
          monShift: true,
          tueShift: true,
          wedShift: true,
          thuShift: true,
          friShift: true,
          satShift: true,
        },
      }),
      db.shift.findMany({ orderBy: { name: "asc" } }),
    ]);

    return NextResponse.json({ success: true, date: date.toISOString(), schedule, patterns, shifts });
  } catch (error) {
    console.error("Failed to fetch schedule", error);
    return NextResponse.json({ success: false, error: "Failed to load schedule" }, { status: 500 });
  }
}
