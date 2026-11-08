"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Role } from "@/generated/prisma/client";
import { ROLE_LABELS } from "@sezsec/shared";
import { Badge, Button, SearchInput } from "@sezsec/ui";

interface UserAccessSummary {
  id: string;
  name: string;
  username: string;
  its: string;
  role: Role;
  moduleCount: number;
  hasEventCharges: boolean;
  sampleModules: string[];
}

export function ManageAccessListClient({
  users,
}: {
  users: UserAccessSummary[];
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.its.toLowerCase().includes(q)
    );
  }, [users, search]);

  return (
    <div className="w-full space-y-5">
      <div className="w-full sm:max-w-md">
        <SearchInput
          placeholder="Search member by name, ITS, or username…"
          value={search}
          onChange={setSearch}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#E5DDD0] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#E5DDD0] bg-[#FAF7F2] text-xs font-bold uppercase tracking-wider text-[#6E5D55]">
                <th className="px-5 py-3.5">Member</th>
                <th className="px-4 py-3.5">Role</th>
                <th className="px-4 py-3.5">Event Charges OTP</th>
                <th className="px-4 py-3.5">Assigned Modules</th>
                <th className="px-5 py-3.5 text-right">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE8DC]">
              {filtered.map((u) => (
                <tr
                  key={u.id}
                  className="transition-colors hover:bg-[#FAF7F2]/60"
                >
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-[#231917]">{u.name}</div>
                    <div className="text-xs text-[#7B6B63]">
                      {u.its ? `ITS ${u.its}` : `@${u.username}`}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge tone={u.role === "ADMIN" ? "maroon" : "neutral"}>
                      {ROLE_LABELS[u.role] || u.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5">
                    {u.hasEventCharges ? (
                      <Badge tone="emerald">Authorized</Badge>
                    ) : (
                      <span className="text-xs text-[#9E8E85]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-[#4E3F3A]">
                    {u.role === "ADMIN" ? (
                      <span className="font-semibold text-[#6A1B1B]">
                        Full Administrator Access (All Modules)
                      </span>
                    ) : u.moduleCount === 0 ? (
                      <span className="text-[#9E8E85]">
                        Self-service member modules only
                      </span>
                    ) : (
                      <span>
                        <strong>{u.moduleCount}</strong> granted (
                        {u.sampleModules.join(", ")}
                        {u.moduleCount > 3 ? "…" : ""})
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link href={`/admin/manage-access/${u.id}`}>
                      <Button size="xs" variant="secondary">
                        Permissions <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
