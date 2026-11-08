"use server";

import { revalidatePath } from "next/cache";
import {
  pingJamateventsBridge,
  syncUserByIdToJamatevents,
  type BridgeConnectionHealth,
} from "@sezsec/bridge";
import { db } from "@sezsec/db";
import { recordActivity } from "@sezsec/logs";
import {
  savePortalRuntimeConfig,
  saveSmtpCredentials,
  sendSystemEmail,
} from "@sezsec/notifications";
import { hasUserPathAccess, requireServerSession } from "@sezsec/rbac/rbac.server";

async function assertSettingsAccess() {
  const session = await requireServerSession();
  const ok =
    session.role === "ADMIN" ||
    (await hasUserPathAccess(session, "/admin/settings"));
  if (!ok) {
    throw new Error("Administrator access required for system settings.");
  }
  return session;
}

export async function saveSystemSettingsAction(input: {
  smtpEmail?: string;
  smtpPassword?: string;
  upiId?: string;
  upiPayeeName?: string;
  jamateventsInternalUrl?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const actor = await assertSettingsAccess();

    if (input.smtpEmail !== undefined) {
      await saveSmtpCredentials(input.smtpEmail, input.smtpPassword);
    }

    await savePortalRuntimeConfig({
      upiId: input.upiId,
      upiPayeeName: input.upiPayeeName,
      jamateventsInternalUrl: input.jamateventsInternalUrl,
    });

    await recordActivity({
      action: "SYSTEM_SETTINGS_UPDATED",
      summary: "Updated SEZ portal system, SMTP, UPI & internal bridge settings",
      userId: actor.id,
      userName: actor.name || actor.username,
    });

    revalidatePath("/admin/settings");
    revalidatePath("/fees");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to save settings.",
    };
  }
}

export async function sendTestSmtpEmailAction(
  recipientEmail: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertSettingsAccess();
    const clean = recipientEmail.trim().toLowerCase();
    if (!clean || !clean.includes("@")) {
      return { ok: false, error: "Enter a valid recipient email." };
    }
    const res = await sendSystemEmail({
      to: clean,
      subject: "SEZ Secunderabad — SMTP Configuration Test",
      title: "SMTP Dispatch Verified",
      bodyHtml: `<p style="margin:0;font-size:15px;line-height:1.6;color:#3D2E2A;">Alhamdulillah! Your SEZ Secunderabad Portal (Port 3334) SMTP configuration is active and delivering emails properly.</p>`,
    });
    return { ok: res.ok, error: res.error };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "SMTP test failed.",
    };
  }
}

export async function pingInternalBridgeAction(): Promise<BridgeConnectionHealth> {
  await assertSettingsAccess();
  return pingJamateventsBridge();
}

export async function pushAllUsersToJamateventsBridgeAction(): Promise<{
  ok: boolean;
  syncedCount: number;
  error?: string;
}> {
  try {
    const actor = await assertSettingsAccess();
    const health = await pingJamateventsBridge();
    if (!health.reachable) {
      return {
        ok: false,
        syncedCount: 0,
        error: `Jamaat Events bridge (${health.targetUrl}) is not reachable: ${health.error || "offline"}`,
      };
    }

    const users = await db.user.findMany({ select: { id: true } });
    for (const u of users) {
      await syncUserByIdToJamatevents(u.id);
    }

    await recordActivity({
      action: "BRIDGE_FULL_USER_SYNC",
      summary: `Pushed ${users.length} member accounts & module permissions over loopback to ${health.targetUrl}`,
      userId: actor.id,
      userName: actor.name || actor.username,
    });

    return { ok: true, syncedCount: users.length };
  } catch (err) {
    return {
      ok: false,
      syncedCount: 0,
      error: err instanceof Error ? err.message : "Bridge sync failed.",
    };
  }
}
