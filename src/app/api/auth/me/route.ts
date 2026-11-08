import { connection, NextResponse } from "next/server";
import { getCurrentSessionUser } from "@sezsec/auth";

export async function GET() {
  await connection();
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({ user });
}
