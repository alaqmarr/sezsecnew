"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Database, Eye, EyeOff, KeyRound, UserCheck } from "lucide-react";
import { Button, Card, Input, KeelArchBanner, notify } from "@sezsec/ui";

export function LoginClientForm({
  callbackUrl,
  canInitialSync,
}: {
  callbackUrl?: string;
  canInitialSync: boolean;
}) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Invalid credentials.");
        return;
      }

      notify.success(
        "Welcome back",
        `Signed in as ${data.user?.name || data.user?.username}`
      );
      const dest =
        callbackUrl ||
        (data.user?.role === "ADMIN" ? "/admin/accounts" : "/fees");
      router.push(dest);
      router.refresh();
    } catch {
      setError("Network error while signing in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleInitialSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/setup/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        notify.error("Sync failed", data?.error || "Could not import records");
        return;
      }
      notify.success(
        "Database initialized",
        `Imported ${data.totalImported} records (${data.usersSynced} accounts).`
      );
      router.refresh();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Card doubleFrame className="p-6 sm:p-8">
      <KeelArchBanner
        arabicTitle="بسم الله الرحمن الرحيم"
        subtitle="Member & Committee Authentication"
        className="mb-6"
      />

      {canInitialSync ? (
        <div className="mb-5 rounded-xl border border-[#D9C398] bg-[#FBF6EB] p-3.5">
          <p className="text-xs font-semibold text-[#6A1B1B]">
            First-Time Setup Detected
          </p>
          <p className="mt-0.5 text-xs text-[#5E4F4A]">
            Local SQLite database has 0 accounts. Click below to import existing
            SEZ accounts &amp; records safely in read-only mode.
          </p>
          <Button
            variant="brass"
            size="sm"
            loading={syncing}
            onClick={handleInitialSync}
            icon={<Database className="h-3.5 w-3.5" />}
            className="mt-2.5 w-full"
          >
            Sync Existing SEZ Database
          </Button>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="ITS Number or Username"
          placeholder="Enter 8-digit ITS or username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
          autoComplete="username"
          leftAdornment={<UserCheck className="h-4 w-4" />}
        />

        <Input
          label="Password"
          type={showPass ? "text" : "password"}
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          leftAdornment={<KeyRound className="h-4 w-4" />}
          rightAdornment={
            <button
              type="button"
              onClick={() => setShowPass((s) => !s)}
              className="text-[#8C7B73] hover:text-[#231917] cursor-pointer"
              tabIndex={-1}
            >
              {showPass ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          }
        />

        {error ? (
          <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-xs font-semibold text-[#991B1B]">
            {error}
          </div>
        ) : null}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          className="w-full"
        >
          Sign In to Portal
        </Button>
      </form>

      <div className="mt-5 flex items-center justify-between border-t border-[#EAE2D6] pt-4 text-xs text-[#7B6B63]">
        <span>Prospective committee member?</span>
        <Link
          href="/join"
          className="font-semibold text-[#6A1B1B] hover:underline"
        >
          Apply to Join SEZ →
        </Link>
      </div>
    </Card>
  );
}
