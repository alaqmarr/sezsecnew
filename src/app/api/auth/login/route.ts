import { NextResponse } from "next/server";
import { authenticateMemberCredentials } from "@sezsec/auth";
import { db } from "@sezsec/db";
import { syncInitialPortalDataIfEmpty } from "@sezsec/migration";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      identifier?: string;
      username?: string;
      password?: string;
    };

    const identifier = (body.identifier || body.username || "").trim();
    const password = String(body.password || "");

    const userCount = await db.user.count();
    if (userCount === 0 && process.env.NEON_DATABASE_URL) {
      await syncInitialPortalDataIfEmpty().catch(() => null);
    }

    const res = await authenticateMemberCredentials(identifier, password);
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: 401 });
    }

    return NextResponse.json({ ok: true, user: res.user });
  } catch (err) {
    console.error("[api/auth/login] Error:", err);
    return NextResponse.json(
      { error: "Could not complete sign in. Please try again." },
      { status: 500 }
    );
  }
}
