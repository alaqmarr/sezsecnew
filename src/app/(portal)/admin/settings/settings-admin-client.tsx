"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Database,
  Download,
  Mail,
  RefreshCw,
  Save,
  Server,
  Users,
} from "lucide-react";
import {
  pingInternalBridgeAction,
  pushAllUsersToJamateventsBridgeAction,
  saveSystemSettingsAction,
  sendTestSmtpEmailAction,
} from "@/app/actions/settings.actions";
import { syncItsToUsernamesAction } from "@/app/actions/users.actions";
import type { BridgeConnectionHealth } from "@sezsec/bridge";
import { formatIST } from "@sezsec/shared";
import { Badge, Button, Input, notify } from "@sezsec/ui";

export function SettingsAdminClient({
  initialRuntime,
  initialSmtp,
  initialBridgeHealth,
  dbHealth,
  actorEmail,
  recentLogs,
}: {
  initialRuntime: {
    upiId: string;
    upiPayeeName: string;
    jamateventsInternalUrl: string;
  };
  initialSmtp: {
    smtpEmail: string;
    configured: boolean;
    source: string;
  };
  initialBridgeHealth: BridgeConnectionHealth;
  dbHealth: {
    status: string;
    engine: string;
    latencyMs: number;
    journalMode: string;
    sizeKb: number;
  };
  actorEmail: string;
  recentLogs: Array<{
    id: string;
    action: string;
    summary: string;
    userName: string;
    createdAt: string;
  }>;
}) {
  const router = useRouter();
  const [bridgeUrl, setBridgeUrl] = useState(
    initialRuntime.jamateventsInternalUrl
  );
  const [upiId, setUpiId] = useState(initialRuntime.upiId);
  const [upiPayeeName, setUpiPayeeName] = useState(initialRuntime.upiPayeeName);
  const [smtpEmail, setSmtpEmail] = useState(initialSmtp.smtpEmail);
  const [smtpPassword, setSmtpPassword] = useState("");
  const [testRecipient, setTestRecipient] = useState(
    actorEmail || initialSmtp.smtpEmail
  );

  const [bridgeHealth, setBridgeHealth] = useState(initialBridgeHealth);
  const [saving, setSaving] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [pushingUsers, setPushingUsers] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [syncingIts, setSyncingIts] = useState(false);
  const [syncingInventory, setSyncingInventory] = useState(false);

  async function handleSaveAll(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await saveSystemSettingsAction({
        jamateventsInternalUrl: bridgeUrl,
        upiId,
        upiPayeeName,
        smtpEmail,
        smtpPassword: smtpPassword || undefined,
      });
      if (!res.ok) {
        notify.error("Could not save settings", res.error);
        return;
      }
      notify.success("System configuration saved");
      setSmtpPassword("");
      const latestPing = await pingInternalBridgeAction();
      setBridgeHealth(latestPing);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handlePingBridge() {
    setPinging(true);
    try {
      const res = await pingInternalBridgeAction();
      setBridgeHealth(res);
      if (res.reachable) {
        notify.success(
          "Internal Loopback Connected",
          `Reached ${res.targetUrl} in ${res.latencyMs}ms (${res.hallCount ?? 0} halls)`
        );
      } else {
        notify.warning("Bookings Bridge Unreachable", res.error);
      }
    } finally {
      setPinging(false);
    }
  }

  async function handlePushAllUsers() {
    setPushingUsers(true);
    try {
      const res = await pushAllUsersToJamateventsBridgeAction();
      if (!res.ok) {
        notify.error("Full user sync failed", res.error);
        return;
      }
      notify.success(
        "All members & permissions synced",
        `Pushed ${res.syncedCount} accounts over loopback to Bookings (:3333)`
      );
      router.refresh();
    } finally {
      setPushingUsers(false);
    }
  }

  async function handleTestSmtp() {
    setTestingSmtp(true);
    try {
      const res = await sendTestSmtpEmailAction(testRecipient);
      if (!res.ok) {
        notify.error("SMTP test failed", res.error);
        return;
      }
      notify.success("Test email sent", `Dispatched to ${testRecipient}`);
    } finally {
      setTestingSmtp(false);
    }
  }

  async function handleSyncIts() {
    setSyncingIts(true);
    try {
      const res = await syncItsToUsernamesAction();
      if (!res.ok) {
        notify.error("ITS sync failed", res.error);
        return;
      }
      notify.success(
        "ITS synchronization complete",
        `${res.updatedCount} member username(s) aligned with their 8-digit ITS`
      );
      router.refresh();
    } finally {
      setSyncingIts(false);
    }
  }

  async function handleInventorySync() {
    setSyncingInventory(true);
    try {
      const res = await fetch("/api/setup/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        notify.error(
          "Inventory App sync failed",
          data?.error || "Request failed"
        );
        return;
      }
      notify.success(
        "Inventory App Sync Completed",
        `Synced ${data.totalImported ?? 0} records from ${data.sourceMode === "loopback-bridge" ? "sezinv (:3333)" : "jamatevents.db"}`
      );
      router.refresh();
    } finally {
      setSyncingInventory(false);
    }
  }

  return (
    <div className="w-full space-y-6">
      <form
        onSubmit={handleSaveAll}
        className="grid w-full grid-cols-1 gap-6 xl:grid-cols-12"
      >
        {/* Internal Server Bridge + UPI Settings */}
        <div className="space-y-6 rounded-2xl border border-[#E5DDD0] bg-white p-6 xl:col-span-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EAE2D6] pb-4">
            <div className="flex items-center gap-2.5">
              <Server className="h-5 w-5 text-[#6A1B1B]" />
              <h2 className="font-editorial text-2xl font-bold text-[#231917]">
                Internal Loopback Bridge (:3333)
              </h2>
            </div>
            <Badge tone={bridgeHealth.reachable ? "emerald" : "brass"}>
              {bridgeHealth.reachable
                ? `Connected • ${bridgeHealth.latencyMs}ms`
                : "Offline"}
            </Badge>
          </div>

          <Input
            label="Jamaat Events Internal Base URL"
            hint="Use http://127.0.0.1:3333 on your Oracle Ubuntu server so traffic stays strictly on loopback."
            value={bridgeUrl}
            onChange={(e) => setBridgeUrl(e.target.value)}
          />

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              loading={pinging}
              onClick={handlePingBridge}
              icon={<Activity className="h-4 w-4" />}
            >
              Ping Loopback Bridge
            </Button>
            <Button
              type="button"
              size="sm"
              variant="brass"
              loading={pushingUsers}
              onClick={handlePushAllUsers}
              icon={<RefreshCw className="h-4 w-4" />}
            >
              Push All Members &amp; Permissions to :3333
            </Button>
          </div>

          <div className="space-y-4 border-t border-[#EAE2D6] pt-5">
            <h3 className="font-editorial text-xl font-bold text-[#231917]">
              Member Contributions UPI QR
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Committee UPI VPA"
                placeholder="dbjtsez@idfcbank"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
              />
              <Input
                label="UPI Payee Name"
                placeholder="Shabab Ul Eidiz Zahabi"
                value={upiPayeeName}
                onChange={(e) => setUpiPayeeName(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Encrypted SMTP Configuration */}
        <div className="flex flex-col justify-between space-y-6 rounded-2xl border border-[#E5DDD0] bg-white p-6 xl:col-span-6">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EAE2D6] pb-4">
              <div className="flex items-center gap-2.5">
                <Mail className="h-5 w-5 text-[#6A1B1B]" />
                <h2 className="font-editorial text-2xl font-bold text-[#231917]">
                  Encrypted Gmail SMTP
                </h2>
              </div>
              <Badge tone={initialSmtp.configured ? "emerald" : "crimson"}>
                {initialSmtp.configured
                  ? `Active (${initialSmtp.source})`
                  : "Unconfigured"}
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Sender Email Address"
                type="email"
                value={smtpEmail}
                onChange={(e) => setSmtpEmail(e.target.value)}
              />
              <Input
                label="Gmail 16-Character App Password"
                type="password"
                placeholder={
                  initialSmtp.configured
                    ? "•••••••••••• (Encrypted — enter to replace)"
                    : "xxxx xxxx xxxx xxxx"
                }
                value={smtpPassword}
                onChange={(e) => setSmtpPassword(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2.5 border-t border-[#EAE2D6] pt-4 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Input
                  label="Verify SMTP Delivery"
                  type="email"
                  placeholder="recipient@example.com"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                loading={testingSmtp}
                onClick={handleTestSmtp}
              >
                Send Test Email
              </Button>
            </div>
          </div>

          <div className="flex justify-end border-t border-[#EAE2D6] pt-4">
            <Button
              type="submit"
              variant="primary"
              loading={saving}
              icon={<Save className="h-4 w-4" />}
            >
              Save All System Settings
            </Button>
          </div>
        </div>
      </form>

      {/* Database Maintenance & Audit */}
      <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-4 rounded-2xl border border-[#E5DDD0] bg-white p-6 xl:col-span-5">
          <div className="flex items-center justify-between border-b border-[#EAE2D6] pb-3">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-[#6A1B1B]" />
              <h2 className="font-editorial text-2xl font-bold text-[#231917]">
                SQLite WAL &amp; Maintenance
              </h2>
            </div>
            <Badge tone="emerald">
              {dbHealth.journalMode.toUpperCase()} • {dbHealth.latencyMs}ms
            </Badge>
          </div>

          <p className="text-xs leading-relaxed text-[#5E4F4A]">
            Engine: <strong>{dbHealth.engine}</strong> ({dbHealth.sizeKb} KB on
            disk). Serialized write lock + WAL mode active.
          </p>

          <div className="flex flex-col gap-2.5 pt-1">
            <a href="/api/settings/backup" className="block">
              <Button
                type="button"
                variant="secondary"
                className="w-full justify-start"
                icon={<Download className="h-4 w-4" />}
              >
                Download Full JSON Database Snapshot
              </Button>
            </a>

            <Button
              type="button"
              variant="secondary"
              className="w-full justify-start"
              loading={syncingIts}
              onClick={handleSyncIts}
              icon={<Users className="h-4 w-4" />}
            >
              Align Member Usernames with 8-Digit ITS
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start"
              loading={syncingInventory}
              onClick={handleInventorySync}
              icon={<RefreshCw className="h-4 w-4" />}
            >
              Pull &amp; Reconcile Records from Inventory App (:3333)
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-[#E5DDD0] bg-white p-6 xl:col-span-7">
          <h2 className="mb-3 font-editorial text-2xl font-bold text-[#231917]">
            Recent Administrative Audit Trail
          </h2>
          <div className="max-h-72 divide-y divide-[#EFE8DC] overflow-y-auto">
            {recentLogs.length === 0 ? (
              <p className="py-6 text-xs text-[#7B6B63]">
                No administrative actions logged yet.
              </p>
            ) : (
              recentLogs.map((l) => (
                <div
                  key={l.id}
                  className="flex items-start justify-between gap-4 py-2.5 text-xs"
                >
                  <div>
                    <p className="font-semibold text-[#231917]">{l.summary}</p>
                    <p className="text-[#7B6B63]">
                      {l.userName} • <code>{l.action}</code>
                    </p>
                  </div>
                  <span className="shrink-0 text-[#8C7B73]">
                    {formatIST(l.createdAt, "dd MMM, hh:mm a")}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
