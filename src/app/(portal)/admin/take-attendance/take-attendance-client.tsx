"use client";

import React, { useMemo, useState } from "react";
import { Check, CheckCheck, Clock, Layers, X } from "lucide-react";
import type { AttendanceStatus } from "@/generated/prisma/client";
import {
  bulkMarkFloorAttendanceAction,
  markMemberAttendanceAction,
} from "@/app/actions/floors-attendance.actions";
import { cn } from "@sezsec/shared";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  IosSpinner,
  SearchInput,
  Select,
  Tabs,
  notify,
} from "@sezsec/ui";

interface LiveSessionOption {
  eventId: string;
  title: string;
  windowLabel: string;
}

interface RosterMember {
  id: string;
  name: string;
  username: string;
  its: string;
  mobile: string;
  tier: string;
}

interface FloorRoster {
  id: string;
  name: string;
  roster: RosterMember[];
}

export function TakeAttendanceClient({
  sessions,
  floors,
  initialMarks,
}: {
  sessions: LiveSessionOption[];
  floors: FloorRoster[];
  initialMarks: Array<{
    eventId: string;
    userId: string;
    status: AttendanceStatus;
  }>;
}) {
  const [selectedEventId, setSelectedEventId] = useState(
    sessions[0]?.eventId || ""
  );
  const [selectedFloorId, setSelectedFloorId] = useState(floors[0]?.id || "");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "UNMARKED" | "PRESENT" | "ABSENT" | "EXCUSED"
  >("ALL");
  const [query, setQuery] = useState("");
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>(() => {
    const map: Record<string, AttendanceStatus> = {};
    for (const m of initialMarks) {
      map[`${m.eventId}:${m.userId}`] = m.status;
    }
    return map;
  });
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const activeFloor =
    floors.find((f) => f.id === selectedFloorId) || floors[0] || null;

  const filteredRoster = useMemo(() => {
    if (!activeFloor) return [];
    const q = query.trim().toLowerCase();
    return activeFloor.roster.filter((person) => {
      const current = marks[`${selectedEventId}:${person.id}`];
      if (statusFilter === "UNMARKED" && current !== undefined) return false;
      if (
        statusFilter !== "ALL" &&
        statusFilter !== "UNMARKED" &&
        current !== statusFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        person.name.toLowerCase().includes(q) ||
        person.username.toLowerCase().includes(q) ||
        person.its.toLowerCase().includes(q)
      );
    });
  }, [activeFloor, marks, selectedEventId, statusFilter, query]);

  if (sessions.length === 0) {
    return (
      <Card className="p-10 text-center">
        <p className="font-editorial text-2xl font-bold text-[#231917]">
          No Active Attendance Window Right Now
        </p>
        <p className="mt-1.5 text-sm text-[#5E4F4A]">
          Attendance opens automatically 30 minutes before any Public Miqaat (for
          6 hours) or whenever an Administrator activates a custom session in{" "}
          <strong>Attendance Sessions</strong>.
        </p>
      </Card>
    );
  }

  if (floors.length === 0) {
    return (
      <Card className="p-10 text-center">
        <p className="font-editorial text-2xl font-bold text-[#231917]">
          No Assigned Floors Found
        </p>
        <p className="mt-1.5 text-sm text-[#5E4F4A]">
          Ask an Administrator to assign you as a Floor Head or Sub-Head in
          Floor Hierarchy.
        </p>
      </Card>
    );
  }

  async function handleMark(
    userId: string,
    nextStatus: AttendanceStatus
  ) {
    const key = `${selectedEventId}:${userId}`;
    const current = marks[key];
    const isClearing = current === nextStatus;

    setBusyUserId(userId);
    try {
      const res = await markMemberAttendanceAction({
        eventId: selectedEventId,
        userId,
        status: isClearing ? "CLEAR" : nextStatus,
      });
      if (!res.ok) {
        notify.error("Failed to mark attendance", res.error);
        return;
      }
      setMarks((prev) => {
        const copy = { ...prev };
        if (isClearing) {
          delete copy[key];
        } else {
          copy[key] = nextStatus;
        }
        return copy;
      });
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleBulkPresent() {
    if (!activeFloor) return;
    const unmarkedIds = activeFloor.roster
      .filter((p) => !marks[`${selectedEventId}:${p.id}`])
      .map((p) => p.id);

    if (unmarkedIds.length === 0) {
      notify.info("All members on this floor are already marked");
      return;
    }

    setBulkBusy(true);
    try {
      const res = await bulkMarkFloorAttendanceAction({
        eventId: selectedEventId,
        userIds: unmarkedIds,
        status: "PRESENT",
      });
      if (!res.ok) {
        notify.error("Bulk mark failed", res.error);
        return;
      }
      setMarks((prev) => {
        const copy = { ...prev };
        for (const uid of unmarkedIds) {
          copy[`${selectedEventId}:${uid}`] = "PRESENT";
        }
        return copy;
      });
      notify.success(`Marked ${unmarkedIds.length} member(s) Present`);
    } finally {
      setBulkBusy(false);
    }
  }

  const floorStats = activeFloor
    ? {
        total: activeFloor.roster.length,
        present: activeFloor.roster.filter(
          (p) => marks[`${selectedEventId}:${p.id}`] === "PRESENT"
        ).length,
        excused: activeFloor.roster.filter(
          (p) => marks[`${selectedEventId}:${p.id}`] === "EXCUSED"
        ).length,
        absent: activeFloor.roster.filter(
          (p) => marks[`${selectedEventId}:${p.id}`] === "ABSENT"
        ).length,
      }
    : { total: 0, present: 0, excused: 0, absent: 0 };

  return (
    <div className="space-y-5">
      {/* Event + Floor Selector Bar */}
      <Card className="p-4 sm:p-5">
        <div className="grid w-full grid-cols-1 items-end gap-4 md:grid-cols-12">
          <div className="md:col-span-5">
            <Select
              label="Active Miqaat Session"
              value={selectedEventId}
              onChange={setSelectedEventId}
              options={sessions.map((s) => ({
                value: s.eventId,
                label: s.title,
                sublabel: s.windowLabel,
              }))}
            />
          </div>
          <div className="md:col-span-4">
            <Select
              label="Floor Team"
              value={selectedFloorId}
              onChange={setSelectedFloorId}
              options={floors.map((f) => ({
                value: f.id,
                label: f.name,
                sublabel: `${f.roster.length} members`,
              }))}
            />
          </div>
          <div className="md:col-span-3">
            <Button
              variant="sage"
              loading={bulkBusy}
              onClick={handleBulkPresent}
              icon={<CheckCheck className="h-4 w-4" />}
              className="w-full"
            >
              Mark Unmarked Present
            </Button>
          </div>
        </div>
      </Card>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          tabs={[
            { id: "ALL", label: "All", count: floorStats.total },
            {
              id: "UNMARKED",
              label: "Unmarked",
              count:
                floorStats.total -
                floorStats.present -
                floorStats.excused -
                floorStats.absent,
            },
            { id: "PRESENT", label: "Present", count: floorStats.present },
            { id: "EXCUSED", label: "Excused", count: floorStats.excused },
            { id: "ABSENT", label: "Absent", count: floorStats.absent },
          ]}
          activeTab={statusFilter}
          onChange={setStatusFilter}
        />

        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search member or ITS…"
          className="w-full sm:w-72"
        />
      </div>

      {/* Full-Width Roster Roll Call */}
      <Card>
        <CardHeader
          icon={<Layers className="h-4 w-4" />}
          title={activeFloor ? activeFloor.name : "Floor Roster"}
          subtitle={`${floorStats.present} Present • ${floorStats.excused} Excused • ${floorStats.absent} Absent of ${floorStats.total}`}
        />
        <CardBody className="divide-y divide-[#F0E9DD] p-0">
          {filteredRoster.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#7B6B63]">
              No members match the selected filter.
            </div>
          ) : (
            filteredRoster.map((person) => {
              const current = marks[`${selectedEventId}:${person.id}`];
              const isBusy = busyUserId === person.id;

              return (
                <div
                  key={person.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 hover:bg-[#FAF7F2]/60"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#231917]">
                        {person.name}
                      </span>
                      <Badge
                        tone={
                          person.tier === "Head"
                            ? "maroon"
                            : person.tier === "Sub-Head"
                              ? "brass"
                              : "neutral"
                        }
                      >
                        {person.tier}
                      </Badge>
                    </div>
                    <p className="text-xs text-[#7B6B63]">
                      {person.its ? `ITS ${person.its}` : `@${person.username}`}
                      {person.mobile ? ` • ${person.mobile}` : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {isBusy ? (
                      <IosSpinner size="sm" tone="maroon" className="mr-1" />
                    ) : null}

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleMark(person.id, "PRESENT")}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all cursor-pointer",
                        current === "PRESENT"
                          ? "border-[#166534] bg-[#166534] text-white shadow-xs"
                          : "border-[#DCD2C2] bg-white text-[#3D2E2A] hover:border-[#166534] hover:text-[#166534]"
                      )}
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Present</span>
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleMark(person.id, "EXCUSED")}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all cursor-pointer",
                        current === "EXCUSED"
                          ? "border-[#B8924A] bg-[#B8924A] text-white shadow-xs"
                          : "border-[#DCD2C2] bg-white text-[#3D2E2A] hover:border-[#B8924A]"
                      )}
                    >
                      <Clock className="h-3.5 w-3.5" />
                      <span>Excused</span>
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleMark(person.id, "ABSENT")}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all cursor-pointer",
                        current === "ABSENT"
                          ? "border-[#991B1B] bg-[#991B1B] text-white shadow-xs"
                          : "border-[#DCD2C2] bg-white text-[#3D2E2A] hover:border-[#991B1B] hover:text-[#991B1B]"
                      )}
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Absent</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </CardBody>
      </Card>
    </div>
  );
}
