"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import type { AttendanceStatus } from "@/generated/prisma/client";
import { markMemberAttendanceAction } from "@/app/actions/floors-attendance.actions";
import { formatIST } from "@sezsec/shared";
import {
  Badge,
  Button,
  IosSpinner,
  SearchInput,
  Select,
  Tabs,
  notify,
} from "@sezsec/ui";

interface AttendeeRow {
  userId: string;
  name: string;
  username: string;
  its: string;
  mobile: string;
  floorName: string;
  status: AttendanceStatus | null;
  markedAt: string | null;
  markedBy: string | null;
}

type StatusFilter = "ALL" | "PRESENT" | "EXCUSED" | "ABSENT" | "UNMARKED";

export function EventAttendeesClient({
  eventId,
  eventTitle,
  attendees,
  floorNames,
}: {
  eventId: string;
  eventTitle: string;
  attendees: AttendeeRow[];
  floorNames: string[];
}) {
  const router = useRouter();
  const [statusTab, setStatusTab] = useState<StatusFilter>("ALL");
  const [floorFilter, setFloorFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const counts = useMemo(() => {
    let present = 0;
    let excused = 0;
    let absent = 0;
    let unmarked = 0;
    for (const a of attendees) {
      if (a.status === "PRESENT") present += 1;
      else if (a.status === "EXCUSED") excused += 1;
      else if (a.status === "ABSENT") absent += 1;
      else unmarked += 1;
    }
    return { present, excused, absent, unmarked };
  }, [attendees]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return attendees.filter((a) => {
      if (statusTab === "UNMARKED" && a.status !== null) return false;
      if (
        statusTab !== "ALL" &&
        statusTab !== "UNMARKED" &&
        a.status !== statusTab
      ) {
        return false;
      }
      if (floorFilter !== "ALL" && a.floorName !== floorFilter) return false;
      if (
        q &&
        !a.name.toLowerCase().includes(q) &&
        !a.its.toLowerCase().includes(q) &&
        !a.username.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [attendees, statusTab, floorFilter, search]);

  async function handleOverride(
    userId: string,
    status: AttendanceStatus | "CLEAR"
  ) {
    setPendingUserId(userId);
    try {
      const res = await markMemberAttendanceAction({
        eventId,
        userId,
        status,
      });
      if (!res.ok) {
        notify.error("Could not update status", res.error);
        return;
      }
      router.refresh();
    } finally {
      setPendingUserId(null);
    }
  }

  function exportCsv() {
    const headers = [
      "Name",
      "ITS",
      "Floor",
      "Mobile",
      "Status",
      "Marked By",
      "Marked At",
    ];
    const lines = filtered.map((a) =>
      [
        `"${a.name.replace(/"/g, '""')}"`,
        `"${a.its}"`,
        `"${a.floorName}"`,
        `"${a.mobile}"`,
        `"${a.status || "UNMARKED"}"`,
        `"${a.markedBy || ""}"`,
        `"${a.markedAt ? formatIST(a.markedAt, "dd MMM yyyy hh:mm a") : ""}"`,
      ].join(",")
    );
    const blob = new Blob([[headers.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance-${eventTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const floorOptions = [
    { value: "ALL", label: "All Floors" },
    ...floorNames.map((f) => ({ value: f, label: f })),
    { value: "Unassigned", label: "Unassigned" },
  ];

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs<StatusFilter>
          activeTab={statusTab}
          onChange={setStatusTab}
          tabs={[
            { id: "ALL", label: "All", count: attendees.length },
            { id: "PRESENT", label: "Present", count: counts.present },
            { id: "EXCUSED", label: "Excused", count: counts.excused },
            { id: "ABSENT", label: "Absent", count: counts.absent },
            { id: "UNMARKED", label: "Unmarked", count: counts.unmarked },
          ]}
        />

        <Button
          variant="secondary"
          size="sm"
          onClick={exportCsv}
          icon={<Download className="h-4 w-4" />}
        >
          Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <SearchInput
            placeholder="Search member by name, ITS, or username…"
            value={search}
            onChange={setSearch}
          />
        </div>
        <Select
          value={floorFilter}
          onChange={setFloorFilter}
          options={floorOptions}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#E5DDD0] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#E5DDD0] bg-[#FAF7F2] text-xs font-bold uppercase tracking-wider text-[#6E5D55]">
                <th className="px-5 py-3.5">Member</th>
                <th className="px-4 py-3.5">Floor</th>
                <th className="px-4 py-3.5">Current Status</th>
                <th className="px-4 py-3.5">Audit</th>
                <th className="px-5 py-3.5 text-right">Mark / Override</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE8DC]">
              {filtered.map((a) => {
                const busy = pendingUserId === a.userId;
                return (
                  <tr
                    key={a.userId}
                    className="transition-colors hover:bg-[#FAF7F2]/60"
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-[#231917]">
                        {a.name}
                      </div>
                      <div className="text-xs text-[#7B6B63]">
                        {a.its ? `ITS ${a.its}` : a.username}
                        {a.mobile ? ` • ${a.mobile}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs font-medium text-[#4E3F3A]">
                      {a.floorName}
                    </td>
                    <td className="px-4 py-3.5">
                      {a.status === "PRESENT" ? (
                        <Badge tone="emerald">Present</Badge>
                      ) : a.status === "EXCUSED" ? (
                        <Badge tone="brass">Excused</Badge>
                      ) : a.status === "ABSENT" ? (
                        <Badge tone="crimson">Absent</Badge>
                      ) : (
                        <Badge tone="neutral">Unmarked</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[#7B6B63]">
                      {a.markedAt
                        ? `${formatIST(a.markedAt, "hh:mm a")} by ${a.markedBy}`
                        : "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {busy ? <IosSpinner size="xs" tone="maroon" /> : null}
                        <Button
                          size="xs"
                          variant={
                            a.status === "PRESENT" ? "primary" : "secondary"
                          }
                          disabled={busy}
                          onClick={() => handleOverride(a.userId, "PRESENT")}
                        >
                          P
                        </Button>
                        <Button
                          size="xs"
                          variant={
                            a.status === "EXCUSED" ? "brass" : "secondary"
                          }
                          disabled={busy}
                          onClick={() => handleOverride(a.userId, "EXCUSED")}
                        >
                          E
                        </Button>
                        <Button
                          size="xs"
                          variant={
                            a.status === "ABSENT" ? "danger" : "secondary"
                          }
                          disabled={busy}
                          onClick={() => handleOverride(a.userId, "ABSENT")}
                        >
                          A
                        </Button>
                        {a.status ? (
                          <Button
                            size="xs"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => handleOverride(a.userId, "CLEAR")}
                          >
                            Clear
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
