import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(
  request: Request,
  context: { params: { id?: string } } | { params: Promise<{ id?: string }> }
) {
  // Resolve params (Turbopack may pass a Promise)
  const resolvedParams = await Promise.resolve(
    (context as any)?.params ?? { id: undefined }
  );
  const url = new URL(request.url);
  const segments = url.pathname.split("/").filter(Boolean);
  const idFromPath = segments[segments.length - 2];
  const id = resolvedParams?.id ?? idFromPath;

  try {
    const { isArchived = true } = await request.json().catch(() => ({}));

    if (!id) {
      return NextResponse.json(
        { error: "Employee ID is required" },
        { status: 400 }
      );
    }

    const existing = await db.employee.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: `Employee with ID ${id} not found` },
        { status: 404 }
      );
    }

    const employee = await db.employee.update({
      where: { id },
      data: { isArchived: Boolean(isArchived), updatedAt: new Date() },
    });

    return NextResponse.json({ success: true, employee });
  } catch (error) {
    console.error(`Failed to archive employee ${id}:`, error);
    const message =
      error instanceof Error ? error.message : "Failed to update employee archive status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
