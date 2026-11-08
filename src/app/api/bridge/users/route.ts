import { connection, NextResponse } from "next/server";
import { verifyBridgeRequest } from "@sezsec/bridge";
import { db } from "@sezsec/db";

export async function GET(request: Request) {
  await connection();
  const auth = verifyBridgeRequest(request);
  if (!auth.ok) return auth.response;

  const users = await db.user.findMany({
    orderBy: { username: "asc" },
    include: {
      moduleAccess: { select: { moduleId: true } },
    },
  });

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      password: u.password,
      name: u.name,
      email: u.email,
      mobile: u.mobile,
      its: u.its,
      role: u.role,
      moduleIds: u.moduleAccess.map((m) => m.moduleId),
    })),
  });
}
