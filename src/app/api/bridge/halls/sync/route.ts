import { NextResponse } from "next/server";
import { syncInboundBridgeHalls, verifyBridgeRequest } from "@sezsec/bridge";

export async function POST(request: Request) {
  const auth = verifyBridgeRequest(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const halls = Array.isArray(body?.halls) ? body.halls : [];
    const res = await syncInboundBridgeHalls(halls);
    return NextResponse.json(res);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Hall sync failed." },
      { status: 500 }
    );
  }
}
