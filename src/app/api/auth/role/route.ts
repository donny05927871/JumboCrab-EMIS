import { getRole } from "@/lib/auth-utils";
import { NextResponse } from "next/server";

export async function GET() {
  const role = await getRole();
  return NextResponse.json({ role });
}
