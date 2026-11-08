import { connection } from "next/server";
import { fetchBridgeEvents } from "@sezsec/bridge";
import { db } from "@sezsec/db";
import {
  hasUserPathAccess,
  requireServerPathAccess,
} from "@sezsec/rbac/rbac.server";
import {
  formatIST,
  getISTDayBounds,
  getISTTodayString,
  parseISTEventDateTime,
} from "@sezsec/shared";
import { PageHeader } from "@sezsec/ui";
import { TakeAttendanceClient } from "./take-attendance-client";

export default async function TakeAttendancePage() {
  await connection();
  const user = await requireServerPathAccess("/admin/take-attendance");

  const now = new Date();
  const todayIso = getISTTodayString(now);
  const { startOfDay } = getISTDayBounds(todayIso);
  const yesterday = new Date(startOfDay.getTime() - 86_400_000);
  const tomorrow = new Date(startOfDay.getTime() + 2 * 86_400_000);

  const [activeClones, recentPublicEvents, allFloors] = await Promise.all([
    db.attendanceEventClone.findMany({
      where: {
        isActive: true,
        startTime: { lte: now },
        endTime: { gte: now },
      },
      orderBy: { startTime: "desc" },
    }),
    fetchBridgeEvents({
      types: ["PUBLIC"],
      excludeCancelled: true,
      from: yesterday,
      to: tomorrow,
    }).catch(() => []),
    db.floorConfig.findMany({
      orderBy: { name: "asc" },
      include: {
        heads: {
          select: { id: true, name: true, username: true, its: true, mobile: true },
        },
        subHeads: {
          select: { id: true, name: true, username: true, its: true, mobile: true },
        },
        members: {
          select: { id: true, name: true, username: true, its: true, mobile: true },
        },
      },
    }),
  ]);

  // Hydrate cloned session titles from bridge if needed
  const cloneEventIds = activeClones.map((c) => c.eventId);
  const clonedBridgeEvents =
    cloneEventIds.length > 0
      ? await fetchBridgeEvents({ ids: cloneEventIds }).catch(() => [])
      : [];
  const bridgeMap = new Map(clonedBridgeEvents.map((e) => [e.id, e]));

  const liveSessionsMap = new Map<
    string,
    {
      eventId: string;
      title: string;
      windowLabel: string;
    }
  >();

  for (const cl of activeClones) {
    const bEv = bridgeMap.get(cl.eventId);
    liveSessionsMap.set(cl.eventId, {
      eventId: cl.eventId,
      title:
        bEv?.description ||
        bEv?.name ||
        cl.eventTitle ||
        `Attendance Session (${cl.eventId.slice(0, 6)})`,
      windowLabel: `Active Window until ${formatIST(cl.endTime, "hh:mm a")}`,
    });
  }

  // Also include any Public Event currently within its [eventStart - 30m, eventStart + 6h] window
  for (const ev of recentPublicEvents) {
    if (liveSessionsMap.has(ev.id)) continue;
    const evStart = parseISTEventDateTime(ev.occasionDate, ev.occasionTime);
    const windowOpen = new Date(evStart.getTime() - 30 * 60_000);
    const windowClose = new Date(evStart.getTime() + 6 * 3_600_000);
    if (now >= windowOpen && now <= windowClose) {
      liveSessionsMap.set(ev.id, {
        eventId: ev.id,
        title: ev.description || ev.name,
        windowLabel: `Auto Live Window (${ev.occasionTime})`,
      });
    }
  }

  const liveSessions = [...liveSessionsMap.values()];

  const isGlobalTaker =
    user.role === "ADMIN" ||
    (await hasUserPathAccess(user, "/admin/attendance"));

  const visibleFloors = isGlobalTaker
    ? allFloors
    : allFloors.filter(
        (f) =>
          f.heads.some((h) => h.id === user.id) ||
          f.subHeads.some((sh) => sh.id === user.id)
      );

  const existingMarks =
    liveSessions.length > 0
      ? await db.attendanceRecord.findMany({
          where: {
            eventId: { in: liveSessions.map((s) => s.eventId) },
          },
          select: {
            eventId: true,
            userId: true,
            status: true,
          },
        })
      : [];

  return (
    <div className="w-full space-y-6">
      <PageHeader
        eyebrow="Floor Roll Call"
        title="Take Live Miqaat Attendance"
        subtitle="Mark floor members Present, Excused, or Absent in real time during active Jamaat occasions."
      />
      <TakeAttendanceClient
        sessions={liveSessions}
        floors={visibleFloors.map((f) => {
          const mapById = new Map<
            string,
            {
              id: string;
              name: string;
              username: string;
              its: string;
              mobile: string;
              tier: string;
            }
          >();
          for (const h of f.heads) {
            mapById.set(h.id, {
              id: h.id,
              name: h.name || h.username,
              username: h.username,
              its: h.its || "",
              mobile: h.mobile || "",
              tier: "Head",
            });
          }
          for (const sh of f.subHeads) {
            if (!mapById.has(sh.id)) {
              mapById.set(sh.id, {
                id: sh.id,
                name: sh.name || sh.username,
                username: sh.username,
                its: sh.its || "",
                mobile: sh.mobile || "",
                tier: "Sub-Head",
              });
            }
          }
          for (const m of f.members) {
            if (!mapById.has(m.id)) {
              mapById.set(m.id, {
                id: m.id,
                name: m.name || m.username,
                username: m.username,
                its: m.its || "",
                mobile: m.mobile || "",
                tier: "Member",
              });
            }
          }
          return {
            id: f.id,
            name: f.name,
            roster: [...mapById.values()],
          };
        })}
        initialMarks={existingMarks}
      />
    </div>
  );
}
