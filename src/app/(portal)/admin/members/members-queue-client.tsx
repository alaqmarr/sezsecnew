"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, Trash2, XCircle } from "lucide-react";
import type { ApprovalStatus } from "@/generated/prisma/client";
import {
  deleteMemberRegistrationAction,
  updateMemberRegistrationStatusAction,
} from "@/app/actions/community.actions";
import { formatIST } from "@sezsec/shared";
import {
  Badge,
  Button,
  ConfirmDialog,
  Drawer,
  Tabs,
  notify,
} from "@sezsec/ui";

interface ApplicationItem {
  id: string;
  title: string;
  name: string;
  its: string;
  email: string;
  dob: string;
  phone: string;
  quranHifz: string;
  passport: string;
  kunSafar: string;
  occupation: string;
  sports: string;
  status: ApprovalStatus;
  createdAt: string;
}

type FilterTab = "ALL" | ApprovalStatus;

export function MembersQueueClient({
  applications,
}: {
  applications: ApplicationItem[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<FilterTab>("PENDING");
  const [inspecting, setInspecting] = useState<ApplicationItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deletingItem, setDeletingItem] = useState<ApplicationItem | null>(
    null
  );

  const counts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    for (const a of applications) {
      if (a.status === "PENDING") pending += 1;
      else if (a.status === "APPROVED") approved += 1;
      else rejected += 1;
    }
    return { pending, approved, rejected };
  }, [applications]);

  const filtered = useMemo(
    () =>
      tab === "ALL"
        ? applications
        : applications.filter((a) => a.status === tab),
    [applications, tab]
  );

  async function handleReview(
    id: string,
    status: ApprovalStatus,
    provisionAccount: boolean
  ) {
    setBusyId(id);
    try {
      const res = await updateMemberRegistrationStatusAction({
        registrationId: id,
        status,
        provisionAccount,
      });
      if (!res.ok) {
        notify.error("Action failed", res.error);
        return;
      }
      notify.success(
        status === "APPROVED"
          ? res.provisionedUserId
            ? "Application approved & login account provisioned (Username & Password = ITS)"
            : "Application approved"
          : "Application marked as rejected"
      );
      setInspecting(null);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete() {
    if (!deletingItem) return;
    setBusyId(deletingItem.id);
    try {
      const res = await deleteMemberRegistrationAction(deletingItem.id);
      if (!res.ok) {
        notify.error("Delete failed", res.error);
        return;
      }
      notify.info("Application record removed");
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
          { id: "PENDING", label: "Pending Review", count: counts.pending },
          { id: "APPROVED", label: "Approved", count: counts.approved },
          { id: "REJECTED", label: "Rejected", count: counts.rejected },
          { id: "ALL", label: "All", count: applications.length },
        ]}
      />

      <div className="overflow-hidden rounded-2xl border border-[#E5DDD0] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#E5DDD0] bg-[#FAF7F2] text-xs font-bold uppercase tracking-wider text-[#6E5D55]">
                <th className="px-5 py-3.5">Applicant</th>
                <th className="px-4 py-3.5">ITS</th>
                <th className="px-4 py-3.5">Contact</th>
                <th className="px-4 py-3.5">Hifz / Occupation</th>
                <th className="px-4 py-3.5">Submitted</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE8DC]">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center text-sm text-[#7B6B63]"
                  >
                    No membership applications in this queue.
                  </td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr
                    key={a.id}
                    className="transition-colors hover:bg-[#FAF7F2]/60"
                  >
                    <td className="px-5 py-3.5 font-semibold text-[#231917]">
                      {a.title} {a.name}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs font-semibold text-[#231917]">
                      {a.its}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[#4E3F3A]">
                      <div>{a.phone}</div>
                      <div className="text-[#7B6B63]">{a.email}</div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[#4E3F3A]">
                      <div>Hifz: {a.quranHifz}</div>
                      <div className="text-[#7B6B63]">{a.occupation}</div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[#7B6B63]">
                      {formatIST(a.createdAt, "dd MMM yyyy")}
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge
                        tone={
                          a.status === "APPROVED"
                            ? "emerald"
                            : a.status === "REJECTED"
                              ? "crimson"
                              : "brass"
                        }
                      >
                        {a.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="xs"
                          variant="secondary"
                          onClick={() => setInspecting(a)}
                          icon={<Eye className="h-3.5 w-3.5" />}
                        >
                          Details
                        </Button>
                        {a.status === "PENDING" ? (
                          <Button
                            size="xs"
                            variant="primary"
                            loading={busyId === a.id}
                            onClick={() => handleReview(a.id, "APPROVED", true)}
                            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                          >
                            Approve &amp; Create
                          </Button>
                        ) : null}
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => setDeletingItem(a)}
                          icon={
                            <Trash2 className="h-3.5 w-3.5 text-[#991B1B]" />
                          }
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Drawer
        open={Boolean(inspecting)}
        onClose={() => setInspecting(null)}
        title={
          inspecting ? `${inspecting.title} ${inspecting.name}` : "Application"
        }
        subtitle={inspecting ? `ITS ${inspecting.its}` : ""}
        footer={
          inspecting ? (
            <>
              <Button
                variant="danger"
                loading={busyId === inspecting.id}
                onClick={() => handleReview(inspecting.id, "REJECTED", false)}
                icon={<XCircle className="h-4 w-4" />}
              >
                Reject
              </Button>
              <Button
                variant="primary"
                loading={busyId === inspecting.id}
                onClick={() => handleReview(inspecting.id, "APPROVED", true)}
                icon={<CheckCircle2 className="h-4 w-4" />}
              >
                Approve &amp; Provision Account
              </Button>
            </>
          ) : undefined
        }
      >
        {inspecting ? (
          <dl className="divide-y divide-[#EFE8DC] text-sm">
            {[
              ["Full Name", `${inspecting.title} ${inspecting.name}`],
              ["8-Digit ITS", inspecting.its],
              ["Mobile", inspecting.phone],
              ["Email", inspecting.email],
              ["Date of Birth", formatIST(inspecting.dob, "dd MMMM yyyy")],
              ["Occupation", inspecting.occupation],
              ["Quran Hifz", inspecting.quranHifz],
              ["Valid Passport", inspecting.passport],
              ["Kun Ziyarat Safar", inspecting.kunSafar],
              ["Sports & Interests", inspecting.sports],
              [
                "Submitted On",
                formatIST(inspecting.createdAt, "dd MMM yyyy, hh:mm a"),
              ],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-3">
                <dt className="text-xs font-semibold uppercase tracking-wider text-[#7B6B63]">
                  {k}
                </dt>
                <dd className="text-right font-medium text-[#231917]">{v}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </Drawer>

      <ConfirmDialog
        open={Boolean(deletingItem)}
        onClose={() => setDeletingItem(null)}
        onConfirm={handleDelete}
        loading={Boolean(deletingItem && busyId === deletingItem.id)}
        title="Delete Application?"
        description={
          <>
            Remove membership application from{" "}
            <strong>{deletingItem?.name}</strong>?
          </>
        }
      />
    </div>
  );
}
