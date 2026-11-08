import { Prisma } from "@/generated/prisma/client";
import { db, withWriteLock } from "@sezsec/db";

export interface RecordActivityParams {
  action: string;
  summary: string;
  userId?: string;
  userName?: string;
  targetId?: string;
  details?: Record<string, unknown>;
}

export async function recordActivity(params: RecordActivityParams): Promise<void> {
  try {
    await withWriteLock(() =>
      db.activityLog.create({
        data: {
          action: params.action,
          summary: params.summary,
          userId: params.userId || "system",
          userName: params.userName || "System",
          targetId: params.targetId ?? null,
          details: params.details
            ? (params.details as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          timestamp: Date.now(),
        },
      })
    );
  } catch (err) {
    console.error("[activity-log] Failed to record activity:", err);
  }
}

export async function listRecentActivities(limit = 60) {
  return db.activityLog.findMany({
    orderBy: { timestamp: "desc" },
    take: limit,
  });
}
