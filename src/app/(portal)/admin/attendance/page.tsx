import { connection } from "next/server";
import Link from "next/link";
import { BarChart3, UserCheck } from "lucide-react";
import { fetchBridgeEvents } from "@sezsec/bridge";
import { db } from "@sezsec/db";
import { requireServerPathAccess } from "@sezsec/rbac/rbac.server";
import { getISTDayBounds, getISTTodayString } from "@sezsec/shared";
import { Button, PageHeader } from "@sezsec/ui";
import { AttendanceAdminClient } from "./attendance-admin-client";

export default async function AttendanceAdminPage() {
  await connection();
  await requireServerPathAccess("/admin/attendance");

  const todayIso = getISTTodayString();
  const { startOfDay } = getISTDayBounds(todayIso);
  const thirtyDaysAgo = new Date(startOfDay.getTime() - 30 * 86_400_000);

  const [clones, recordCounts, bridgeEvents] = await Promise.all([
    db.attendanceEventClone.findMany({
      orderBy: { startTime: "desc" },
    }),
    db.attendanceRecord.groupBy({
      by: ["eventId"],
      _count: { _all: true },
    }),
    fetchBridgeEvents({
      from: thirtyDaysAgo,
      excludeCancelled: true,
      limit: 80,
      order: "desc",
    }).catch(() => []),
  ]);

  const countMap = new Map(
    recordCounts.map((r) => [r.eventId, r._count._all])
  );

  const serializedClones = clones.map((c) => ({
    id: c.id,
    eventId: c.eventId,
    eventTitle: c.eventTitle || "Jamaat Occasion",
    eventDate: c.eventDate ? c.eventDate.toISOString() : null,
    eventTime: c.eventTime,
    eventType: c.eventType,
    isActive: c.isActive,
    startTime: c.startTime.toISOString(),
    endTime: c.endTime.toISOString(),
    markedCount: countMap.get(c.eventId) ?? 0,
  }));

  const serializedBridgeEvents = bridgeEvents.map((ev) => ({
    id: ev.id,
    title: ev.description || ev.name,
    occasionDate: ev.occasionDate.toISOString(),
    occasionTime: ev.occasionTime,
    eventType: ev.eventType,
    halls: ev.hall,
    thaalCount: ev.thaalCount,
  }));

  return (
    <div className="w-full space-y-6">
      <PageHeader
        eyebrow="Attendance Control"
        title="Attendance Sessions & Windows"
        subtitle="Open or schedule custom roll-call windows for Jamaat Miqaats and manage live floor attendance."
        actions={
          <>
            <Link href="/admin/take-attendance">
              <Button
                variant="secondary"
                size="sm"
                icon={<UserCheck className="h-4 w-4" />}
              >
                Take Live Attendance
              </Button>
            </Link>
            <Link href="/admin/attendance-details">
              <Button
                variant="brass"
                size="sm"
                icon={<BarChart3 className="h-4 w-4" />}
              >
                Master Analytics
              </Button>
            </Link>
          </>
        }
      />

      <AttendanceAdminClient
        clones={serializedClones}
        bridgeEvents={serializedBridgeEvents}
        serverNowMs={new Date().getTime()}
      />
    </div>
  );
}
