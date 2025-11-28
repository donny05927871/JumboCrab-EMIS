import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const patterns = await db.weeklyPattern.findMany({
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
    });
    return NextResponse.json({ success: true, data: patterns });
  } catch (error) {
    console.error("Failed to list patterns", error);
    return NextResponse.json({ success: false, error: "Failed to load patterns" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";

    const shiftIds: Record<string, number | null> = {
      sunShiftId: typeof body?.sunShiftId === "number" ? body.sunShiftId : null,
      monShiftId: typeof body?.monShiftId === "number" ? body.monShiftId : null,
      tueShiftId: typeof body?.tueShiftId === "number" ? body.tueShiftId : null,
      wedShiftId: typeof body?.wedShiftId === "number" ? body.wedShiftId : null,
      thuShiftId: typeof body?.thuShiftId === "number" ? body.thuShiftId : null,
      friShiftId: typeof body?.friShiftId === "number" ? body.friShiftId : null,
      satShiftId: typeof body?.satShiftId === "number" ? body.satShiftId : null,
    };

    if (!code || !name) {
      return NextResponse.json(
        { success: false, error: "code and name are required" },
        { status: 400 }
      );
    }

    // Validate referenced shifts exist
    const ids = Object.values(shiftIds).filter((id): id is number => typeof id === "number");
    const uniqueIds = Array.from(new Set(ids));
    if (uniqueIds.length) {
      const count = await db.shift.count({ where: { id: { in: uniqueIds } } });
      if (count !== uniqueIds.length) {
        return NextResponse.json({ success: false, error: "One or more shifts not found" }, { status: 400 });
      }
    }

    const pattern = await db.weeklyPattern.create({
      data: {
        code,
        name,
        ...shiftIds,
      },
    });

    return NextResponse.json({ success: true, data: pattern });
  } catch (error) {
    console.error("Failed to create pattern", error);
    return NextResponse.json({ success: false, error: "Failed to create pattern" }, { status: 500 });
  }
}
