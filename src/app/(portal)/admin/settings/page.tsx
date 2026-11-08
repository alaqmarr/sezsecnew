import { connection } from "next/server";
import { pingJamateventsBridge } from "@sezsec/bridge";
import { db, getDatabaseHealth } from "@sezsec/db";
import {
  getPortalRuntimeConfig,
  getResolvedSmtpCredentials,
} from "@sezsec/notifications";
import { requireServerPathAccess } from "@sezsec/rbac/rbac.server";
import { PageHeader } from "@sezsec/ui";
import { SettingsAdminClient } from "./settings-admin-client";

export default async function SystemSettingsAdminPage() {
  await connection();
  const actor = await requireServerPathAccess("/admin/settings");

  const [runtimeConfig, smtpInfo, bridgeHealth, dbHealth, recentLogs] =
    await Promise.all([
      getPortalRuntimeConfig(),
      getResolvedSmtpCredentials(),
      pingJamateventsBridge(),
      getDatabaseHealth(),
      db.activityLog.findMany({
        orderBy: { timestamp: "desc" },
        take: 15,
      }),
    ]);

  const serializedLogs = recentLogs.map((l) => ({
    id: l.id,
    action: l.action,
    summary: l.summary,
    userName: l.userName,
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <div className="w-full space-y-6">
      <PageHeader
        eyebrow="Infrastructure & Security"
        title="System Settings, Loopback Bridge & SMTP"
        subtitle="Manage internal server-to-server communication (127.0.0.1:3333 <-> 127.0.0.1:3334), encrypted Gmail SMTP, UPI QR settings, and SQLite WAL backups."
      />

      <SettingsAdminClient
        initialRuntime={runtimeConfig}
        initialSmtp={{
          smtpEmail: smtpInfo.smtpEmail,
          configured: smtpInfo.configured,
          source: smtpInfo.source,
        }}
        initialBridgeHealth={bridgeHealth}
        dbHealth={{
          status: dbHealth.status,
          engine: dbHealth.engine,
          latencyMs: dbHealth.latencyMs,
          journalMode: dbHealth.pragmas.journalMode,
          sizeKb: Math.round(dbHealth.pragmas.databaseSizeBytes / 1024),
        }}
        hasNeonUrl={Boolean(process.env.NEON_DATABASE_URL)}
        actorEmail={actor.email || ""}
        recentLogs={serializedLogs}
      />
    </div>
  );
}
