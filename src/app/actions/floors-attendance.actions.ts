"use server";

import { revalidatePath } from "next/cache";
import type { AttendanceStatus } from "@/generated/prisma/client";
import { fetchBridgeEventById } from "@sezsec/bridge";
import { db, withWriteLock } from "@sezsec/db";
import { recordActivity } from "@sezsec/logs";
import { hasUserPathAccess, requireServerSession } from "@sezsec/rbac/rbac.server";

async function assertFloorAdmin() {
  const session = await requireServerSession();
  const ok =
    session.role === "ADMIN" ||
    (await hasUserPathAccess(session, "/admin/floors"));
  if (!ok) {
    throw new Error("Insufficient permissions to manage floor hierarchy.");
  }
  return session;
}

async function assertAttendanceAdmin() {
  const session = await requireServerSession();
  const ok =
    session.role === "ADMIN" ||
    (await hasUserPathAccess(session, "/admin/attendance"));
  if (!ok) {
    throw new Error("Insufficient permissions to manage attendance sessions.");
  }
  return session;
}

export async function createFloorAction(
  name: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const actor = await assertFloorAdmin();
    const cleanName = name.trim();
    if (!cleanName) {
      return { ok: false, error: "Floor name is required." };
    }
    const exists = await db.floorConfig.findUnique({
      where: { name: cleanName },
    });
    if (exists) {
      return { ok: false, error: `Floor "${cleanName}" already exists.` };
    }

    await withWriteLock(() =>
      db.floorConfig.create({ data: { name: cleanName } })
    );
    await recordActivity({
      action: "FLOOR_CREATED",
      summary: `Created floor "${cleanName}"`,
      userId: actor.id,
      userName: actor.name || actor.username,
    });
    revalidatePath("/admin/floors");
    revalidatePath("/admin/team");
    revalidatePath("/admin/take-attendance");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to create floor.",
    };
  }
}

export async function renameFloorAction(input: {
  floorId: string;
  name: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertFloorAdmin();
    const cleanName = input.name.trim();
    if (!cleanName) return { ok: false, error: "Floor name cannot be empty." };
    await withWriteLock(() =>
      db.floorConfig.update({
        where: { id: input.floorId },
        data: { name: cleanName },
      })
    );
    revalidatePath("/admin/floors");
    revalidatePath("/admin/team");
    revalidatePath("/admin/take-attendance");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to rename floor.",
    };
  }
}

export async function deleteFloorAction(
  floorId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const actor = await assertFloorAdmin();
    await withWriteLock(() =>
      db.floorConfig.delete({ where: { id: floorId } })
    );
    await recordActivity({
      action: "FLOOR_DELETED",
      summary: `Deleted floor ${floorId}`,
      userId: actor.id,
      userName: actor.name || actor.username,
    });
    revalidatePath("/admin/floors");
    revalidatePath("/admin/team");
    revalidatePath("/admin/take-attendance");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete floor.",
    };
  }
}

export async function updateFloorAssignmentAction(input: {
  floorId: string;
  userId: string;
  tier: "HEAD" | "SUBHEAD" | "MEMBER";
  mode: "ADD" | "REMOVE";
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertFloorAdmin();
    const op =
      input.mode === "ADD"
        ? { connect: { id: input.userId } }
        : { disconnect: { id: input.userId } };

    await withWriteLock(() =>
      db.floorConfig.update({
        where: { id: input.floorId },
        data:
          input.tier === "HEAD"
            ? { heads: op }
            : input.tier === "SUBHEAD"
              ? { subHeads: op }
              : { members: op },
      })
    );

    revalidatePath("/admin/floors");
    revalidatePath("/admin/team");
    revalidatePath("/admin/take-attendance");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Failed to update floor member.",
    };
  }
}

export async function startOrUpdateAttendanceSessionAction(input: {
  eventId: string;
  startTime: string;
  endTime: string;
  isActive?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const actor = await assertAttendanceAdmin();
    const start = new Date(input.startTime);
    const end = new Date(input.endTime);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return { ok: false, error: "Valid start and end timestamps are required." };
    }
    if (end <= start) {
      return { ok: false, error: "End time must be after start time." };
    }

    const bridgeEv = await fetchBridgeEventById(input.eventId).catch(
      () => null
    );

    await withWriteLock(() =>
      db.attendanceEventClone.upsert({
        where: { eventId: input.eventId },
        update: {
          startTime: start,
          endTime: end,
          isActive: input.isActive ?? true,
          ...(bridgeEv
            ? {
                eventTitle: bridgeEv.description || bridgeEv.name,
                eventDate: bridgeEv.occasionDate,
                eventTime: bridgeEv.occasionTime,
                eventType: bridgeEv.eventType,
              }
            : {}),
        },
        create: {
          eventId: input.eventId,
          startTime: start,
          endTime: end,
          isActive: input.isActive ?? true,
          eventTitle: bridgeEv ? bridgeEv.description || bridgeEv.name : null,
          eventDate: bridgeEv?.occasionDate ?? null,
          eventTime: bridgeEv?.occasionTime ?? null,
          eventType: bridgeEv?.eventType ?? null,
        },
      })
    );

    await recordActivity({
      action: "ATTENDANCE_SESSION_CONFIGURED",
      summary: `Configured attendance window for ${bridgeEv?.description || bridgeEv?.name || input.eventId}`,
      userId: actor.id,
      userName: actor.name || actor.username,
      targetId: input.eventId,
    });

    revalidatePath("/admin/attendance");
    revalidatePath("/admin/take-attendance");
    revalidatePath("/admin/attendance-details");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to configure attendance session.",
    };
  }
}

export async function toggleAttendanceSessionActiveAction(input: {
  cloneId: string;
  isActive: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertAttendanceAdmin();
    await withWriteLock(() =>
      db.attendanceEventClone.update({
        where: { id: input.cloneId },
        data: { isActive: input.isActive },
      })
    );
    revalidatePath("/admin/attendance");
    revalidatePath("/admin/take-attendance");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to toggle session.",
    };
  }
}

export async function deleteAttendanceSessionAction(
  cloneId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertAttendanceAdmin();
    await withWriteLock(() =>
      db.attendanceEventClone.delete({ where: { id: cloneId } })
    );
    revalidatePath("/admin/attendance");
    revalidatePath("/admin/take-attendance");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to remove session.",
    };
  }
}

export async function markMemberAttendanceAction(input: {
  eventId: string;
  userId: string;
  status: AttendanceStatus | "CLEAR";
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await requireServerSession();
    const isGlobalTaker =
      session.role === "ADMIN" ||
      (await hasUserPathAccess(session, "/admin/attendance"));

    if (!isGlobalTaker) {
      const canTake =
        session.isFloorLeader ||
        (await hasUserPathAccess(session, "/admin/take-attendance"));
      if (!canTake) {
        return {
          ok: false,
          error: "You do not have permission to mark attendance.",
        };
      }
    }

    await withWriteLock(async () => {
      if (input.status === "CLEAR") {
        await db.attendanceRecord.deleteMany({
          where: {
            eventId: input.eventId,
            userId: input.userId,
          },
        });
      } else {
        await db.attendanceRecord.upsert({
          where: {
            eventId_userId: {
              eventId: input.eventId,
              userId: input.userId,
            },
          },
          update: {
            status: input.status,
            markedById: session.id,
            timestamp: new Date(),
          },
          create: {
            eventId: input.eventId,
            userId: input.userId,
            markedById: session.id,
            status: input.status,
            timestamp: new Date(),
          },
        });
      }
    });

    revalidatePath("/admin/take-attendance");
    revalidatePath("/admin/attendance");
    revalidatePath("/admin/attendance-details");
    revalidatePath(`/admin/attendance-details/${input.eventId}`);
    revalidatePath("/admin/my-attendance-history");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to mark attendance.",
    };
  }
}

export async function bulkMarkFloorAttendanceAction(input: {
  eventId: string;
  userIds: string[];
  status: AttendanceStatus;
}): Promise<{ ok: boolean; count: number; error?: string }> {
  try {
    const session = await requireServerSession();
    const allowed =
      session.role === "ADMIN" ||
      session.isFloorLeader ||
      (await hasUserPathAccess(session, "/admin/take-attendance")) ||
      (await hasUserPathAccess(session, "/admin/attendance"));

    if (!allowed) {
      return { ok: false, count: 0, error: "Not authorized." };
    }

    await withWriteLock(() =>
      db.$transaction(async (tx) => {
        for (const uid of input.userIds) {
          await tx.attendanceRecord.upsert({
            where: {
              eventId_userId: {
                eventId: input.eventId,
                userId: uid,
              },
            },
            update: {
              status: input.status,
              markedById: session.id,
              timestamp: new Date(),
            },
            create: {
              eventId: input.eventId,
              userId: uid,
              markedById: session.id,
              status: input.status,
              timestamp: new Date(),
            },
          });
        }
      })
    );

    revalidatePath("/admin/take-attendance");
    revalidatePath("/admin/attendance");
    revalidatePath("/admin/attendance-details");
    revalidatePath(`/admin/attendance-details/${input.eventId}`);
    return { ok: true, count: input.userIds.length };
  } catch (err) {
    return {
      ok: false,
      count: 0,
      error: err instanceof Error ? err.message : "Bulk attendance failed.",
    };
  }
}
