"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Clock,
  ExternalLink,
  Plus,
  Trash2,
} from "lucide-react";
import {
  deleteAttendanceSessionAction,
  startOrUpdateAttendanceSessionAction,
  toggleAttendanceSessionActiveAction,
} from "@/app/actions/floors-attendance.actions";
import { formatIST } from "@sezsec/shared";
import {
  Badge,
  Button,
  ConfirmDialog,
  Input,
  Modal,
  Select,
  Toggle,
  notify,
} from "@sezsec/ui";

interface CloneItem {
  id: string;
  eventId: string;
  eventTitle: string;
  eventDate: string | null;
  eventTime: string | null;
  eventType: string | null;
  isActive: boolean;
  startTime: string;
  endTime: string;
  markedCount: number;
}

interface BridgeEventOption {
  id: string;
  title: string;
  occasionDate: string;
  occasionTime: string;
  eventType: "PUBLIC" | "PRIVATE";
  halls: string[];
  thaalCount: number;
}

function toLocalDatetimeInput(isoOrDate: Date | string): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function AttendanceAdminClient({
  clones,
  bridgeEvents,
  serverNowMs,
}: {
  clones: CloneItem[];
  bridgeEvents: BridgeEventOption[];
  serverNowMs: number;
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [startLocal, setStartLocal] = useState("");
  const [endLocal, setEndLocal] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingClone, setDeletingClone] = useState<CloneItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const eventOptions = useMemo(
    () =>
      bridgeEvents.map((ev) => ({
        value: ev.id,
        label: `${formatIST(ev.occasionDate, "dd MMM yyyy")} — ${ev.title}`,
        sublabel: `${ev.eventType} • ${ev.occasionTime}${
          ev.halls.length > 0 ? ` • ${ev.halls.join(", ")}` : ""
        }`,
      })),
    [bridgeEvents]
  );

  function openConfigureModal(existing?: CloneItem, presetHours?: number) {
    const now = new Date();
    if (existing) {
      setSelectedEventId(existing.eventId);
      setStartLocal(toLocalDatetimeInput(existing.startTime));
      setEndLocal(toLocalDatetimeInput(existing.endTime));
      setIsActive(existing.isActive);
    } else {
      const firstId = bridgeEvents[0]?.id || "";
      setSelectedEventId(firstId);
      const hours = presetHours ?? 4;
      setStartLocal(toLocalDatetimeInput(now));
      setEndLocal(
        toLocalDatetimeInput(new Date(now.getTime() + hours * 3_600_000))
      );
      setIsActive(true);
    }
    setModalOpen(true);
  }

  function applyQuickHours(hours: number) {
    const now = new Date();
    setStartLocal(toLocalDatetimeInput(now));
    setEndLocal(
      toLocalDatetimeInput(new Date(now.getTime() + hours * 3_600_000))
    );
  }

  async function handleSaveSession(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEventId) {
      notify.error("Please choose a Jamaat event");
      return;
    }
    setSaving(true);
    try {
      const res = await startOrUpdateAttendanceSessionAction({
        eventId: selectedEventId,
        startTime: new Date(startLocal).toISOString(),
        endTime: new Date(endLocal).toISOString(),
        isActive,
      });
      if (!res.ok) {
        notify.error("Could not configure session", res.error);
        return;
      }
      notify.success("Attendance session window saved");
      setModalOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(clone: CloneItem, nextActive: boolean) {
    setTogglingId(clone.id);
    try {
      const res = await toggleAttendanceSessionActiveAction({
        cloneId: clone.id,
        isActive: nextActive,
      });
      if (!res.ok) {
        notify.error("Toggle failed", res.error);
        return;
      }
      notify.info(
        nextActive
          ? "Attendance window activated"
          : "Attendance window paused"
      );
      router.refresh();
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingClone) return;
    setDeleting(true);
    try {
      const res = await deleteAttendanceSessionAction(deletingClone.id);
      if (!res.ok) {
        notify.error("Failed to remove window", res.error);
        return;
      }
      notify.success("Attendance session configuration removed");
      setDeletingClone(null);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  const nowMs = serverNowMs;

  return (
    <div className="w-full space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E5DDD0] bg-white px-5 py-4">
        <div className="text-sm text-[#4E3F3A]">
          <span className="font-semibold text-[#231917]">
            {clones.length} configured session{clones.length === 1 ? "" : "s"}
          </span>{" "}
          • Floor Heads &amp; Sub-Heads automatically see public miqaats within
          their standard 6-hour window plus any active custom session below.
        </div>
        <Button
          variant="primary"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => openConfigureModal(undefined, 4)}
        >
          Open Attendance Window
        </Button>
      </div>

      {/* Sessions Ledger Table */}
      <div className="overflow-hidden rounded-2xl border border-[#E5DDD0] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#E5DDD0] bg-[#FAF7F2] text-xs font-bold uppercase tracking-wider text-[#6E5D55]">
                <th className="px-5 py-3.5">Occasion</th>
                <th className="px-4 py-3.5">Roll-Call Window (IST)</th>
                <th className="px-4 py-3.5">Window Status</th>
                <th className="px-4 py-3.5">Marked</th>
                <th className="px-4 py-3.5">Active</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE8DC]">
              {clones.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center text-sm text-[#7B6B63]"
                  >
                    No custom attendance windows configured yet. Click{" "}
                    <strong>Open Attendance Window</strong> to start a session
                    for any Jamaat event.
                  </td>
                </tr>
              ) : (
                clones.map((c) => {
                  const startMs = new Date(c.startTime).getTime();
                  const endMs = new Date(c.endTime).getTime();
                  const isLiveNow =
                    c.isActive && nowMs >= startMs && nowMs <= endMs;
                  const isUpcoming = c.isActive && nowMs < startMs;

                  return (
                    <tr
                      key={c.id}
                      className="transition-colors hover:bg-[#FAF7F2]/60"
                    >
                      <td className="px-5 py-4">
                        <div className="font-semibold text-[#231917]">
                          {c.eventTitle}
                        </div>
                        <div className="mt-0.5 text-xs text-[#7B6B63]">
                          {c.eventDate
                            ? formatIST(c.eventDate, "EEE, dd MMM yyyy")
                            : "Date via Bookings"}
                          {c.eventTime ? ` • ${c.eventTime}` : ""}
                          {c.eventType ? ` • ${c.eventType}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-xs text-[#4E3F3A]">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-[#8C7B73]" />
                          <span>
                            {formatIST(c.startTime, "dd MMM, hh:mm a")} →{" "}
                            {formatIST(c.endTime, "dd MMM, hh:mm a")}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {isLiveNow ? (
                          <Badge tone="emerald">Live Now</Badge>
                        ) : isUpcoming ? (
                          <Badge tone="brass">Scheduled</Badge>
                        ) : !c.isActive ? (
                          <Badge tone="neutral">Paused</Badge>
                        ) : (
                          <Badge tone="neutral">Window Ended</Badge>
                        )}
                      </td>
                      <td className="px-4 py-4 font-mono text-xs font-semibold text-[#231917]">
                        {c.markedCount} members
                      </td>
                      <td className="px-4 py-4">
                        <Toggle
                          checked={c.isActive}
                          loading={togglingId === c.id}
                          onChange={(next) => handleToggleActive(c, next)}
                        />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/admin/attendance-details/${c.eventId}`}>
                            <Button
                              size="xs"
                              variant="secondary"
                              icon={<ExternalLink className="h-3.5 w-3.5" />}
                            >
                              Report
                            </Button>
                          </Link>
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => openConfigureModal(c)}
                            icon={<CalendarClock className="h-3.5 w-3.5" />}
                          >
                            Edit
                          </Button>
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => setDeletingClone(c)}
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

      {/* Configure Window Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Configure Attendance Window"
        subtitle="Select a Jamaat Miqaat from Bookings (:3333) and set the active roll-call timeframe."
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setModalOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveSession}
              loading={saving}
            >
              Save Window
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveSession} className="space-y-4">
          <Select
            label="Jamaat Event / Miqaat"
            required
            value={selectedEventId}
            onChange={setSelectedEventId}
            options={eventOptions}
            placeholder="Select an event from Jamaat Bookings…"
          />

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[#6E5D55]">
              Quick Duration from Now:
            </span>
            {[2, 4, 8, 24].map((hrs) => (
              <Button
                key={hrs}
                type="button"
                size="xs"
                variant="secondary"
                onClick={() => applyQuickHours(hrs)}
              >
                Open {hrs}h
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Window Opens At"
              type="datetime-local"
              required
              value={startLocal}
              onChange={(e) => setStartLocal(e.target.value)}
            />
            <Input
              label="Window Closes At"
              type="datetime-local"
              required
              value={endLocal}
              onChange={(e) => setEndLocal(e.target.value)}
            />
          </div>

          <div className="rounded-xl border border-[#EAE2D6] bg-[#FAF7F2] px-4 py-3">
            <Toggle
              checked={isActive}
              onChange={setIsActive}
              label="Enable attendance marking immediately"
              description="When enabled, Floor Heads and Attendance Takers can mark roll call during the window."
            />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingClone)}
        onClose={() => setDeletingClone(null)}
        onConfirm={handleDeleteConfirm}
        loading={deleting}
        title="Remove Attendance Window?"
        description={
          <>
            Remove the custom window configuration for{" "}
            <strong>{deletingClone?.eventTitle}</strong>? Existing marked
            attendance records for this event will remain safely preserved.
          </>
        }
        confirmLabel="Remove Window"
      />
    </div>
  );
}
