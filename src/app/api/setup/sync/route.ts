import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@sezsec/auth";
import { db } from "@sezsec/db";
import {
  syncInitialPortalDataIfEmpty,
  syncPortalDataFromInventory,
} from "@sezsec/migration";

export async function POST() {
  try {
    const userCount = await db.user.count();
    if (userCount === 0) {
      const res = await syncInitialPortalDataIfEmpty();
      return NextResponse.json({ ok: true, ...res });
    }

    const session = await getCurrentSessionUser();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only Administrators can trigger an Inventory App sync." },
        { status: 403 }
      );
    }

    const res = await syncPortalDataFromInventory({
      actor: { id: session.id, name: session.name || session.username },
    });
    return NextResponse.json(res);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to sync from Inventory App (sezinv).",
      },
      { status: 500 }
    );
  }
}
