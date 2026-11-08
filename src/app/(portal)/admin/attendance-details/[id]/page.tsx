import { connection } from "next/server";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { fetchBridgeEventById } from "@sezsec/bridge";
import { db } from "@sezsec/db";
import { requireServerPathAccess } from "@sezsec/rbac/rbac.server";
import { formatIST } from "@sezsec/shared";
import { Button, PageHeader } from "@sezsec/ui";
import { EventAttendeesClient } from "./event-attendees-client";

export default async function EventAttendanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  await requireServerPathAccess(`/admin/attendance-details/${id}`);

  const [bridgeEvent, clone, users, floors, records] = await Promise.all([
    fetchBridgeEventById(id).catch(() => null),
    db.attendanceEventClone.findUnique({ where: { eventId: id } }),
    db.user.findMany({
      orderBy: [{ name: "asc" }, { username: "asc" }],
      select: {
        id: true,
        username: true,
        name: true,
        its: true,
        mobile: true,
      },
    }),
    db.floorConfig.findMany({
      orderBy: { name: "asc" },
      include: {
        heads: { select: { id: true } },
        subHeads: { select: { id: true } },
        members: { select: { id: true } },
      },
    }),
    db.attendanceRecord.findMany({
      where: { eventId: id },
      include: {
        markedBy: { select: { name: true, username: true } },
      },
    }),
  ]);

  const userFloorMap = new Map<string, string>();
  for (const fl of floors) {
    for (const u of [...fl.heads, ...fl.subHeads, ...fl.members]) {
      if (!userFloorMap.has(u.id)) {
        userFloorMap.set(u.id, fl.name);
      }
    }
  }

  const recordMap = new Map(records.map((r) => [r.userId, r]));

  const attendees = users.map((u) => {
    const rec = recordMap.get(u.id);
    return {
      userId: u.id,
      name: u.name || u.username,
      username: u.username,
      its: u.its || "",
      mobile: u.mobile || "",
      floorName: userFloorMap.get(u.id) || "Unassigned",
      status: rec?.status || null,
      markedAt: rec ? rec.timestamp.toISOString() : null,
      markedBy: rec ? rec.markedBy?.name || rec.markedBy?.username || null : null,
    };
  });

  const eventTitle =
    bridgeEvent?.description ||
    bridgeEvent?.name ||
    clone?.eventTitle ||
    `Event ${id}`;
  const eventDateLabel = bridgeEvent?.occasionDate
    ? formatIST(bridgeEvent.occasionDate, "EEEE, dd MMMM yyyy")
    : clone?.eventDate
      ? formatIST(clone.eventDate, "EEEE, dd MMMM yyyy")
      : "Jamaat Miqaat";

  return (
    <div className="w-full space-y-6">
      <PageHeader
        eyebrow="Miqaat Roll Call"
        title={eventTitle}
        subtitle={`${eventDateLabel}${
          bridgeEvent?.occasionTime ? ` • ${bridgeEvent.occasionTime}` : ""
        }`}
        actions={
          <Link href="/admin/attendance-details">
            <Button
              variant="secondary"
              size="sm"
              icon={<ArrowLeft className="h-4 w-4" />}
            >
              All Reports
            </Button>
          </Link>
        }
      />

      <EventAttendeesClient
        eventId={id}
        eventTitle={eventTitle}
        attendees={attendees}
        floorNames={floors.map((f) => f.name)}
      />
    </div>
  );
}
