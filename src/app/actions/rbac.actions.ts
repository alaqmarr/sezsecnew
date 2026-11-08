"use server";

import { revalidatePath } from "next/cache";
import { fetchBridgeHalls, syncUserByIdToJamatevents } from "@sezsec/bridge";
import { db, withWriteLock } from "@sezsec/db";
import { recordActivity } from "@sezsec/logs";
import {
  EVENT_CHARGES_MODULE_ID,
  UPDATE_THAAL_COUNT_MODULE_ID,
  VIEW_PRIVATE_EVENTS_MODULE_ID,
} from "@sezsec/rbac/rbac.constants";
import { hasUserPathAccess, requireServerSession } from "@sezsec/rbac/rbac.server";
import { getHallModuleId, slugify } from "@sezsec/shared";

async function assertRbacAccess(targetPath: string) {
  const session = await requireServerSession();
  const allowed =
    session.role === "ADMIN" || (await hasUserPathAccess(session, targetPath));
  if (!allowed) {
    throw new Error("Insufficient permissions for RBAC management.");
  }
  return session;
}

export async function upsertRbacModuleAction(input: {
  id?: string;
  name: string;
  description?: string;
  icon?: string;
  links: Array<{ path: string; label?: string }>;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const actor = await assertRbacAccess("/admin/modules");
    const name = input.name.trim();
    if (!name) {
      return { ok: false, error: "Module name is required." };
    }

    const moduleId = (input.id?.trim() || slugify(name)).trim();
    if (!moduleId) {
      return { ok: false, error: "Invalid module identifier." };
    }

    const cleanLinks = input.links
      .map((l, idx) => ({
        path: l.path.trim(),
        label: l.label?.trim() || null,
        order: idx,
      }))
      .filter((l) => l.path.startsWith("/"));

    await withWriteLock(() =>
      db.$transaction(async (tx) => {
        const existing = await tx.module.findUnique({ where: { id: moduleId } });
        if (existing) {
          await tx.module.update({
            where: { id: moduleId },
            data: {
              name,
              description: input.description?.trim() || null,
              icon: input.icon?.trim() || "Layers",
            },
          });
          await tx.moduleLink.deleteMany({ where: { moduleId } });
          if (cleanLinks.length > 0) {
            await tx.moduleLink.createMany({
              data: cleanLinks.map((l) => ({ ...l, moduleId })),
            });
          }
        } else {
          await tx.module.create({
            data: {
              id: moduleId,
              name,
              description: input.description?.trim() || null,
              icon: input.icon?.trim() || "Layers",
              links: { create: cleanLinks },
            },
          });
        }
      })
    );

    await recordActivity({
      action: "MODULE_UPSERTED",
      summary: `Saved RBAC module "${name}" (${moduleId})`,
      userId: actor.id,
      userName: actor.name || actor.username,
      targetId: moduleId,
    });

    revalidatePath("/admin/modules");
    revalidatePath("/admin/manage-access");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to save module.",
    };
  }
}

export async function deleteRbacModuleAction(
  moduleId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const actor = await assertRbacAccess("/admin/modules");
    await withWriteLock(() => db.module.delete({ where: { id: moduleId } }));
    await recordActivity({
      action: "MODULE_DELETED",
      summary: `Deleted RBAC module ${moduleId}`,
      userId: actor.id,
      userName: actor.name || actor.username,
      targetId: moduleId,
    });
    revalidatePath("/admin/modules");
    revalidatePath("/admin/manage-access");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete module.",
    };
  }
}

export async function generateHallAndChargesModulesAction(): Promise<{
  ok: boolean;
  createdCount: number;
  hallCount: number;
  error?: string;
}> {
  try {
    const actor = await assertRbacAccess("/admin/modules");
    const halls = await fetchBridgeHalls().catch(() => []);

    const specs: Array<{
      id: string;
      name: string;
      description: string;
      icon: string;
    }> = [
      {
        id: EVENT_CHARGES_MODULE_ID,
        name: "Event Charges (Events Portal OTP)",
        description:
          "Allows viewing, editing, and printing rupee charges via 6-digit OTP on Jamaat Events (:3333)",
        icon: "IndianRupee",
      },
      {
        id: VIEW_PRIVATE_EVENTS_MODULE_ID,
        name: "View Private Events on Calendar",
        description:
          "Allows viewing private family functions alongside public miqaats on /events",
        icon: "Calendar",
      },
      {
        id: UPDATE_THAAL_COUNT_MODULE_ID,
        name: "Global Thaal Count Entry",
        description:
          "Allows entering actual thaals served across all halls on /menu",
        icon: "Utensils",
      },
      ...halls.map((h) => ({
        id: getHallModuleId(h.name),
        name: `Hall Thaal Entry: ${h.name}`,
        description: `Allows entering actual thaals served for ${h.name} on /menu`,
        icon: "Utensils",
      })),
    ];

    let createdCount = 0;
    await withWriteLock(async () => {
      for (const spec of specs) {
        const byId = await db.module.findUnique({ where: { id: spec.id } });
        const byName = await db.module.findUnique({
          where: { name: spec.name },
        });
        if (!byId && !byName) {
          await db.module.create({
            data: {
              id: spec.id,
              name: spec.name,
              description: spec.description,
              icon: spec.icon,
            },
          });
          createdCount += 1;
        }
      }
    });

    await recordActivity({
      action: "MODULES_GENERATED",
      summary: `Synced ${halls.length} hall modules + event_charges (${createdCount} newly created)`,
      userId: actor.id,
      userName: actor.name || actor.username,
    });

    revalidatePath("/admin/modules");
    revalidatePath("/admin/manage-access");
    return { ok: true, createdCount, hallCount: halls.length };
  } catch (err) {
    return {
      ok: false,
      createdCount: 0,
      hallCount: 0,
      error: err instanceof Error ? err.message : "Failed to generate modules.",
    };
  }
}

export async function toggleUserModuleAccessAction(input: {
  userId: string;
  moduleId: string;
  grant: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const actor = await assertRbacAccess("/admin/manage-access");

    await withWriteLock(async () => {
      if (input.grant) {
        await db.userModuleAccess.upsert({
          where: {
            userId_moduleId: {
              userId: input.userId,
              moduleId: input.moduleId,
            },
          },
          update: {},
          create: {
            userId: input.userId,
            moduleId: input.moduleId,
          },
        });
      } else {
        await db.userModuleAccess.deleteMany({
          where: {
            userId: input.userId,
            moduleId: input.moduleId,
          },
        });
      }
    });

    // Immediately sync updated module permissions to jamatevents (:3333) over loopback!
    await syncUserByIdToJamatevents(input.userId);

    await recordActivity({
      action: input.grant ? "MODULE_GRANTED" : "MODULE_REVOKED",
      summary: `${input.grant ? "Granted" : "Revoked"} module "${input.moduleId}" for user ${input.userId}`,
      userId: actor.id,
      userName: actor.name || actor.username,
      targetId: input.userId,
    });

    revalidatePath("/admin/manage-access");
    revalidatePath(`/admin/manage-access/${input.userId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Failed to update access permission.",
    };
  }
}
