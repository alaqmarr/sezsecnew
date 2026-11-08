import { connection } from "next/server";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { fetchBridgeEvents } from "@sezsec/bridge";
import { db } from "@sezsec/db";
import { requireServerPathAccess } from "@sezsec/rbac/rbac.server";
import { Button, PageHeader } from "@sezsec/ui";
import { AttendanceMasterClient } from "./attendance-master-client";

export default async function AttendanceMasterDetailsPage() {
  await connection();
  await requireServerPathAccess("/admin/attendance-details");

  const [records, clones, totalMembers] = await Promise.all([
    db.attendanceRecord.findMany({
      select: { eventId: true, status: true, timestamp: true },
    }),
    db.attendanceEventClone.findMany(),
    db.user.count(),
  ]);

  const allEventIds = new Set<string>([
    ...records.map((r) => r.eventId),
    ...clones.map((c) => c.eventId),
  ]);

  const bridgeEvents =
    allEventIds.size > 0
      ? await fetchBridgeEvents({
          ids: Array.from(allEventIds),
          order: "desc",
        }).catch(() => [])
      : [];

  const cloneByEventId = new Map(clones.map((c) => [c.eventId, c]));
  const bridgeById = new Map(bridgeEvents.map((e) => [e.id, e]));

  const statsByEvent = new Map<
    string,
    { present: number; excused: number; absent: number; latestTs: number }
  >();

  for (const id of allEventIds) {
    statsByEvent.set(id, { present: 0, excused: 0, absent: 0, latestTs: 0 });
  }

  for (const r of records) {
    const bucket = statsByEvent.get(r.eventId)!;
    if (r.status === "PRESENT") bucket.present += 1;
    else if (r.status === "EXCUSED") bucket.excused += 1;
    else bucket.absent += 1;
    const ts = r.timestamp.getTime();
    if (ts > bucket.latestTs) bucket.latestTs = ts;
  }

  const rows = Array.from(allEventIds)
    .map((eventId) => {
      const st = statsByEvent.get(eventId)!;
      const br = bridgeById.get(eventId);
      const cl = cloneByEventId.get(eventId);
      const occasionDate =
        br?.occasionDate ??
        cl?.eventDate ??
        (st.latestTs ? new Date(st.latestTs) : new Date());
      return {
        eventId,
        title:
          br?.description ||
          br?.name ||
          cl?.eventTitle ||
          `Occasion (${eventId.slice(0, 8)})`,
        occasionDate: occasionDate.toISOString(),
        occasionTime: br?.occasionTime || cl?.eventTime || "",
        eventType: br?.eventType || cl?.eventType || "PUBLIC",
        present: st.present,
        excused: st.excused,
        absent: st.absent,
        totalMarked: st.present + st.excused + st.absent,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.occasionDate).getTime() - new Date(a.occasionDate).getTime()
    );

  return (
    <div className="w-full space-y-6">
      <PageHeader
        eyebrow="Attendance Analytics"
        title="Master Attendance Reports"
        subtitle="Event-by-event participation breakdown across all SEZ Secunderabad committee brothers."
        actions={
          <Link href="/admin/attendance">
            <Button
              variant="secondary"
              size="sm"
              icon={<CalendarClock className="h-4 w-4" />}
            >
              Session Windows
            </Button>
          </Link>
        }
      />

      <AttendanceMasterClient rows={rows} totalMembers={totalMembers} />
    </div>
  );
}
