import { connection } from "next/server";
import { CalendarCheck2, CheckCircle2, Clock, XCircle } from "lucide-react";
import { fetchBridgeEvents } from "@sezsec/bridge";
import { db } from "@sezsec/db";
import { requireServerSession } from "@sezsec/rbac/rbac.server";
import { formatIST } from "@sezsec/shared";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  PageHeader,
  StatTile,
} from "@sezsec/ui";

export default async function MyAttendanceHistoryPage() {
  await connection();
  const session = await requireServerSession();

  const records = await db.attendanceRecord.findMany({
    where: { userId: session.id },
    orderBy: { timestamp: "desc" },
    include: {
      markedBy: { select: { name: true, username: true } },
    },
  });

  const eventIds = [...new Set(records.map((r) => r.eventId))];
  const [bridgeEvents, clones] = await Promise.all([
    eventIds.length > 0
      ? fetchBridgeEvents({ ids: eventIds }).catch(() => [])
      : Promise.resolve([]),
    eventIds.length > 0
      ? db.attendanceEventClone.findMany({
          where: { eventId: { in: eventIds } },
        })
      : Promise.resolve([]),
  ]);

  const bridgeMap = new Map(bridgeEvents.map((e) => [e.id, e]));
  const cloneMap = new Map(clones.map((c) => [c.eventId, c]));

  const presentCount = records.filter((r) => r.status === "PRESENT").length;
  const excusedCount = records.filter((r) => r.status === "EXCUSED").length;
  const absentCount = records.filter((r) => r.status === "ABSENT").length;
  const rate =
    records.length > 0
      ? Math.round(((presentCount + excusedCount) / records.length) * 100)
      : 100;

  return (
    <div className="w-full space-y-6">
      <PageHeader
        eyebrow="Personal Khidmat Record"
        title="My Miqaat Attendance History"
        subtitle="Complete record of your marked attendance across Secunderabad Jamaat Miqaats."
      />

      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Attendance Rate"
          value={`${rate}%`}
          sublabel={`${records.length} recorded miqaat(s)`}
          icon={<CalendarCheck2 className="h-5 w-5" />}
          tone="maroon"
        />
        <StatTile
          label="Present"
          value={presentCount}
          sublabel="Marked on floor"
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="sage"
        />
        <StatTile
          label="Excused / Rukhsat"
          value={excusedCount}
          sublabel="Approved leave"
          icon={<Clock className="h-5 w-5" />}
          tone="brass"
        />
        <StatTile
          label="Absent"
          value={absentCount}
          sublabel="Missed sessions"
          icon={<XCircle className="h-5 w-5" />}
        />
      </div>

      <Card>
        <CardHeader
          title="Chronological Miqaat Log"
          subtitle="Hydrated from Jamaat Bookings & Attendance Sessions"
        />
        <CardBody className="overflow-x-auto">
          {records.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#7B6B63]">
              No attendance records have been logged for your account yet.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#EAE2D6] text-[11px] font-bold uppercase tracking-wider text-[#7B6B63]">
                  <th className="py-2.5 pr-4">Miqaat / Occasion</th>
                  <th className="py-2.5 px-4">Occasion Date</th>
                  <th className="py-2.5 px-4">Marked By</th>
                  <th className="py-2.5 px-4">Marked At</th>
                  <th className="py-2.5 pl-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0E9DD]">
                {records.map((rec) => {
                  const ev = bridgeMap.get(rec.eventId);
                  const cl = cloneMap.get(rec.eventId);
                  const title =
                    ev?.description ||
                    ev?.name ||
                    cl?.eventTitle ||
                    `Miqaat (${rec.eventId.slice(0, 8)})`;
                  const occDate = ev?.occasionDate || cl?.eventDate;

                  return (
                    <tr key={rec.id}>
                      <td className="py-3 pr-4 font-semibold text-[#231917]">
                        {title}
                      </td>
                      <td className="py-3 px-4 text-xs text-[#5E4F4A]">
                        {occDate ? formatIST(occDate, "dd MMM yyyy") : "—"}
                      </td>
                      <td className="py-3 px-4 text-xs text-[#5E4F4A]">
                        {rec.markedBy
                          ? rec.markedBy.name || rec.markedBy.username
                          : "System"}
                      </td>
                      <td className="py-3 px-4 text-xs text-[#7B6B63]">
                        {formatIST(rec.timestamp, "dd MMM yyyy, hh:mm a")}
                      </td>
                      <td className="py-3 pl-4 text-right">
                        <Badge
                          tone={
                            rec.status === "PRESENT"
                              ? "success"
                              : rec.status === "EXCUSED"
                                ? "brass"
                                : "danger"
                          }
                        >
                          {rec.status}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
