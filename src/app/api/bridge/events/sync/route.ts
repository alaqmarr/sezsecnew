import { NextResponse } from "next/server";
import {
  syncInboundBridgeEventSnapshot,
  verifyBridgeRequest,
} from "@sezsec/bridge";

export async function POST(request: Request) {
  const auth = verifyBridgeRequest(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    if (!body?.action || !body?.eventId) {
      return NextResponse.json(
        { error: "Missing action or eventId in event sync payload." },
        { status: 400 }
      );
    }

    const res = await syncInboundBridgeEventSnapshot(body);
    return NextResponse.json(res);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Event sync failed." },
      { status: 500 }
    );
  }
}
