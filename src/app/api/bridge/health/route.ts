import { connection, NextResponse } from "next/server";
import { verifyBridgeRequest } from "@sezsec/bridge";
import { db } from "@sezsec/db";

export async function GET(request: Request) {
  await connection();
  const auth = verifyBridgeRequest(request);
  if (!auth.ok) return auth.response;

  const [usersCount, modulesCount, floorsCount] = await Promise.all([
    db.user.count(),
    db.module.count(),
    db.floorConfig.count(),
  ]);

  return NextResponse.json({
    ok: true,
    service: "sezsecnew",
    port: 3334,
    usersCount,
    modulesCount,
    floorsCount,
    timestamp: new Date().toISOString(),
  });
}
