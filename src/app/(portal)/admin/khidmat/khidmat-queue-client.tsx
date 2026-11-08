"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2, X } from "lucide-react";
import type { ApprovalStatus } from "@/generated/prisma/client";
import {
  deleteKhidmatRequestAction,
  updateKhidmatStatusAction,
} from "@/app/actions/community.actions";
import { formatIST, getMisriDate } from "@sezsec/shared";
import { Badge, Button, ConfirmDialog, Tabs, notify } from "@sezsec/ui";

interface KhidmatItem {
  id: string;
  miqat: string;
  name: string;
  phone: string;
  date: string;
  status: ApprovalStatus;
  createdAt: string;
}

type FilterTab = "ALL" | ApprovalStatus;

export function KhidmatQueueClient({ requests }: { requests: KhidmatItem[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<FilterTab>("PENDING");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deletingItem, setDeletingItem] = useState<KhidmatItem | null>(null);

  const counts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    for (const r of requests) {
      if (r.status === "PENDING") pending += 1;
      else if (r.status === "APPROVED") approved += 1;
      else rejected += 1;
    }
    return { pending, approved, rejected };
  }, [requests]);

  const filtered = useMemo(
    () =>
      tab === "ALL" ? requests : requests.filter((r) => r.status === tab),
    [requests, tab]
  );

  async function handleStatus(requestId: string, status: ApprovalStatus) {
    setBusyId(requestId);
    try {
      const res = await updateKhidmatStatusAction({ requestId, status });
      if (!res.ok) {
        notify.error("Update failed", res.error);
        return;
      }
      notify.success(`Khidmat request marked ${status.toLowerCase()}`);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete() {
    if (!deletingItem) return;
    setBusyId(deletingItem.id);
    try {
      const res = await deleteKhidmatRequestAction(deletingItem.id);
      if (!res.ok) {
        notify.error("Delete failed", res.error);
        return;
      }
      notify.info("Khidmat request deleted");
      setDeletingItem(null);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="w-full space-y-5">
      <Tabs<FilterTab>
        activeTab={tab}
        onChange={setTab}
        tabs={[
          { id: "PENDING", label: "Pending", count: counts.pending },
          { id: "APPROVED", label: "Approved", count: counts.approved },
          { id: "REJECTED", label: "Declined", count: counts.rejected },
          { id: "ALL", label: "All", count: requests.length },
        ]}
      />

      <div className="overflow-hidden rounded-2xl border border-[#E5DDD0] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#E5DDD0] bg-[#FAF7F2] text-xs font-bold uppercase tracking-wider text-[#6E5D55]">
                <th className="px-5 py-3.5">Occasion / Miqaat</th>
                <th className="px-4 py-3.5">Occasion Date</th>
                <th className="px-4 py-3.5">Host Name</th>
                <th className="px-4 py-3.5">Contact</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE8DC]">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center text-sm text-[#7B6B63]"
                  >
                    No khidmat requests in this queue.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const misri = getMisriDate(r.date);
                  return (
                    <tr
                      key={r.id}
                      className="transition-colors hover:bg-[#FAF7F2]/60"
                    >
                      <td className="px-5 py-3.5 font-semibold text-[#231917]">
                        {r.miqat}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="text-xs font-semibold text-[#231917]">
                          {formatIST(r.date, "EEE, dd MMM yyyy")}
                        </div>
                        <div className="text-[11px] text-[#7B6B63]">
                          {misri.formattedEn}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-[#231917]">
                        {r.name}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-[#4E3F3A]">
                        {r.phone}
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge
                          tone={
                            r.status === "APPROVED"
                              ? "emerald"
                              : r.status === "REJECTED"
                                ? "crimson"
                                : "brass"
                          }
                        >
                          {r.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {r.status !== "APPROVED" ? (
                            <Button
                              size="xs"
                              variant="primary"
                              loading={busyId === r.id}
                              onClick={() => handleStatus(r.id, "APPROVED")}
                              icon={<Check className="h-3.5 w-3.5" />}
                            >
                              Approve
                            </Button>
                          ) : null}
                          {r.status !== "REJECTED" ? (
                            <Button
                              size="xs"
                              variant="secondary"
                              loading={busyId === r.id}
                              onClick={() => handleStatus(r.id, "REJECTED")}
                              icon={<X className="h-3.5 w-3.5" />}
                            >
                              Decline
                            </Button>
                          ) : null}
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => setDeletingItem(r)}
                            icon={
                              <Trash2 className="h-3.5 w-3.5 text-[#991B1B]" />
                            }
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deletingItem)}
        onClose={() => setDeletingItem(null)}
        onConfirm={handleDelete}
        loading={Boolean(deletingItem && busyId === deletingItem.id)}
        title="Delete Khidmat Request?"
        description={
          <>
            Delete the khidmat request for{" "}
            <strong>{deletingItem?.miqat}</strong> by{" "}
            <strong>{deletingItem?.name}</strong>?
          </>
        }
      />
    </div>
  );
}
