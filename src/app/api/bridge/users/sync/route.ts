import { NextResponse } from "next/server";
import { syncInboundBridgeUser, verifyBridgeRequest } from "@sezsec/bridge";

export async function POST(request: Request) {
  const auth = verifyBridgeRequest(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    if (!body?.action || !body?.userId) {
      return NextResponse.json(
        { error: "Missing action or userId in sync payload." },
        { status: 400 }
      );
    }

    const res = await syncInboundBridgeUser(body);
    return NextResponse.json(res);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "User sync failed." },
      { status: 500 }
    );
  }
}
