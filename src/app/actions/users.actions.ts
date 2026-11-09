"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import type { Role } from "@/generated/prisma/client";
import {
  pushUserSyncToJamatevents,
  syncUserByIdToJamatevents,
} from "@sezsec/bridge";
import { db, withWriteLock } from "@sezsec/db";
import { recordActivity } from "@sezsec/logs";
import { EVENT_CHARGES_MODULE_ID } from "@sezsec/rbac/rbac.constants";
import { hasUserPathAccess, requireServerSession } from "@sezsec/rbac/rbac.server";
import { parseISTDateOnly } from "@sezsec/shared";

const ALLOWED_ROLES = new Set<Role>([
  "ADMIN",
  "ADMIN_CUSTOM",
  "MANAGER",
  "STAFF",
  "WATCHER",
  "USER",
]);

async function assertUserManagementAccess(path = "/admin/users") {
  const session = await requireServerSession();
  const ok =
    session.role === "ADMIN" ||
    (await hasUserPathAccess(session, path)) ||
    (await hasUserPathAccess(session, "/admin/edit-user"));
  if (!ok) {
    throw new Error("You do not have permission to manage member accounts.");
  }
  return session;
}

export async function createMemberAccountAction(input: {
  username: string;
  password: string;
  name?: string;
  its?: string;
  email?: string;
  mobile?: string;
  role?: Role;
  monthlyFee?: number;
}): Promise<{ ok: boolean; error?: string; userId?: string }> {
  try {
    const actor = await assertUserManagementAccess("/admin/users");
    const username = input.username.trim();
    const rawPassword = input.password.trim();
    const its = input.its?.trim() || null;
    const role: Role =
      input.role && ALLOWED_ROLES.has(input.role) ? input.role : "USER";

    if (!username || !rawPassword) {
      return { ok: false, error: "Username and password are required." };
    }
    if (role === "ADMIN" && actor.role !== "ADMIN") {
      return { ok: false, error: "Only Administrators can create ADMIN accounts." };
    }

    const existingByUsername = await db.user.findUnique({ where: { username } });
    if (existingByUsername) {
      return { ok: false, error: `Username "${username}" is already in use.` };
    }
    if (its) {
      const existingByIts = await db.user.findUnique({ where: { its } });
      if (existingByIts) {
        return { ok: false, error: `ITS "${its}" is already assigned.` };
      }
    }

    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const feeAmount = Math.max(0, Math.round(Number(input.monthlyFee ?? 0)));

    const created = await withWriteLock(() =>
      db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            username,
            password: passwordHash,
            name: input.name?.trim() || null,
            its,
            email: input.email?.trim().toLowerCase() || null,
            mobile: input.mobile?.trim() || null,
            role,
          },
        });

        if (feeAmount > 0) {
          await tx.userFeeConfig.create({
            data: { userId: user.id, amount: feeAmount },
          });
        }

        if (role === "ADMIN") {
          const chargesMod = await tx.module.findUnique({
            where: { id: EVENT_CHARGES_MODULE_ID },
          });
          if (chargesMod) {
            await tx.userModuleAccess.upsert({
              where: {
                userId_moduleId: {
                  userId: user.id,
                  moduleId: EVENT_CHARGES_MODULE_ID,
                },
              },
              update: {},
              create: { userId: user.id, moduleId: EVENT_CHARGES_MODULE_ID },
            });
          }
        }

        return user;
      })
    );

    await syncUserByIdToJamatevents(created.id);
    await recordActivity({
      action: "USER_CREATED",
      summary: `Created member account ${created.name || created.username} (${created.username})`,
      userId: actor.id,
      userName: actor.name || actor.username,
      targetId: created.id,
    });

    revalidatePath("/admin/users");
    revalidatePath("/admin/accounts");
    revalidatePath("/admin/fees");
    return { ok: true, userId: created.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to create member.",
    };
  }
}

export async function updateMemberAccountAction(input: {
  userId: string;
  username: string;
  name?: string;
  its?: string;
  email?: string;
  mobile?: string;
  role?: Role;
  newPassword?: string;
  monthlyFee?: number;
  dob?: string;
  occupation?: string;
  quranHifz?: string;
  sports?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const actor = await assertUserManagementAccess("/admin/edit-user");
    const existing = await db.user.findUnique({ where: { id: input.userId } });
    if (!existing) {
      return { ok: false, error: "Member account not found." };
    }

    const username = input.username.trim();
    const its = input.its?.trim() || null;
    if (!username) {
      return { ok: false, error: "Username cannot be empty." };
    }

    const usernameConflict = await db.user.findUnique({ where: { username } });
    if (usernameConflict && usernameConflict.id !== existing.id) {
      return { ok: false, error: `Username "${username}" is already taken.` };
    }

    if (its) {
      const itsConflict = await db.user.findUnique({ where: { its } });
      if (itsConflict && itsConflict.id !== existing.id) {
        return { ok: false, error: `ITS "${its}" is already assigned.` };
      }
    }

    const nextRole: Role =
      input.role && ALLOWED_ROLES.has(input.role) ? input.role : existing.role;
    if (
      (nextRole === "ADMIN" || existing.role === "ADMIN") &&
      actor.role !== "ADMIN"
    ) {
      return {
        ok: false,
        error: "Only Administrators can modify ADMIN accounts.",
      };
    }

    let passwordHash: string | undefined;
    if (input.newPassword && input.newPassword.trim()) {
      passwordHash = await bcrypt.hash(input.newPassword.trim(), 10);
    }

    const parsedDob =
      input.dob !== undefined
        ? input.dob.trim()
          ? parseISTDateOnly(input.dob)
          : null
        : undefined;

    await withWriteLock(() =>
      db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: existing.id },
          data: {
            username,
            name: input.name?.trim() || null,
            its,
            email: input.email?.trim().toLowerCase() || null,
            mobile: input.mobile?.trim() || null,
            role: nextRole,
            ...(passwordHash ? { password: passwordHash } : {}),
            ...(parsedDob !== undefined
              ? {
                  dob:
                    parsedDob && !Number.isNaN(parsedDob.getTime())
                      ? parsedDob
                      : null,
                }
              : {}),
            ...(input.occupation !== undefined
              ? { occupation: input.occupation.trim() || null }
              : {}),
            ...(input.quranHifz !== undefined
              ? { quranHifz: input.quranHifz.trim() || null }
              : {}),
            ...(input.sports !== undefined
              ? { sports: input.sports.trim() || null }
              : {}),
          },
        });

        if (input.monthlyFee !== undefined) {
          const safeFee = Math.max(0, Math.round(Number(input.monthlyFee) || 0));
          await tx.userFeeConfig.upsert({
            where: { userId: existing.id },
            create: { userId: existing.id, amount: safeFee },
            update: { amount: safeFee },
          });
        }
      })
    );

    await syncUserByIdToJamatevents(existing.id);
    await recordActivity({
      action: "USER_UPDATED",
      summary: `Updated member ${input.name || username} (${username})`,
      userId: actor.id,
      userName: actor.name || actor.username,
      targetId: existing.id,
    });

    revalidatePath("/admin/users");
    revalidatePath("/admin/edit-user");
    revalidatePath("/admin/accounts");
    revalidatePath("/admin/fees");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update member.",
    };
  }
}

export async function deleteMemberAccountAction(
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const actor = await assertUserManagementAccess("/admin/users");
    if (actor.role !== "ADMIN") {
      return { ok: false, error: "Only Administrators can delete member accounts." };
    }
    if (actor.id === userId) {
      return { ok: false, error: "You cannot delete your own active account." };
    }

    const target = await db.user.findUnique({ where: { id: userId } });
    if (!target) {
      return { ok: false, error: "Account not found." };
    }

    await withWriteLock(() => db.user.delete({ where: { id: userId } }));
    await pushUserSyncToJamatevents({
      action: "DELETE",
      userId: target.id,
      user: {
        id: target.id,
        username: target.username,
        password: "",
        name: target.name,
        email: target.email,
        mobile: target.mobile,
        its: target.its,
        role: target.role,
      },
    });

    await recordActivity({
      action: "USER_DELETED",
      summary: `Deleted member account ${target.name || target.username} (${target.username})`,
      userId: actor.id,
      userName: actor.name || actor.username,
      targetId: target.id,
    });

    revalidatePath("/admin/users");
    revalidatePath("/admin/accounts");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete member.",
    };
  }
}

export async function bulkImportMembersAction(
  rows: Array<{
    username?: string;
    its?: string;
    name?: string;
    email?: string;
    mobile?: string;
    role?: string;
    password?: string;
    monthlyFee?: number;
  }>
): Promise<{
  ok: boolean;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  error?: string;
}> {
  try {
    const actor = await assertUserManagementAccess("/admin/users");
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const touchedIds: string[] = [];

    for (const raw of rows) {
      const cleanIts = String(raw.its || "").trim() || null;
      const cleanUsername = String(raw.username || cleanIts || "").trim();
      if (!cleanUsername) {
        skippedCount += 1;
        continue;
      }

      const rawRole = String(raw.role || "USER").toUpperCase() as Role;
      const safeRole: Role =
        ALLOWED_ROLES.has(rawRole) &&
        (rawRole !== "ADMIN" || actor.role === "ADMIN")
          ? rawRole
          : "USER";

      const rawPass = String(raw.password || cleanUsername).trim();
      const passwordHash = await bcrypt.hash(rawPass, 10);
      const monthlyFee = Math.max(0, Math.round(Number(raw.monthlyFee ?? 0)));

      await withWriteLock(async () => {
        const existing = await db.user.findFirst({
          where: {
            OR: [
              { username: cleanUsername },
              ...(cleanIts ? [{ its: cleanIts }] : []),
            ],
          },
        });

        if (existing) {
          await db.user.update({
            where: { id: existing.id },
            data: {
              name: raw.name?.trim() || existing.name,
              email: raw.email?.trim().toLowerCase() || existing.email,
              mobile: raw.mobile?.trim() || existing.mobile,
              its: cleanIts || existing.its,
            },
          });
          if (monthlyFee > 0) {
            await db.userFeeConfig.upsert({
              where: { userId: existing.id },
              create: { userId: existing.id, amount: monthlyFee },
              update: { amount: monthlyFee },
            });
          }
          updatedCount += 1;
          touchedIds.push(existing.id);
        } else {
          const created = await db.user.create({
            data: {
              username: cleanUsername,
              password: passwordHash,
              name: raw.name?.trim() || null,
              email: raw.email?.trim().toLowerCase() || null,
              mobile: raw.mobile?.trim() || null,
              its: cleanIts,
              role: safeRole,
            },
          });
          if (monthlyFee > 0) {
            await db.userFeeConfig.create({
              data: { userId: created.id, amount: monthlyFee },
            });
          }
          createdCount += 1;
          touchedIds.push(created.id);
        }
      });
    }

    for (const id of touchedIds) {
      await syncUserByIdToJamatevents(id);
    }

    await recordActivity({
      action: "USERS_BULK_IMPORT",
      summary: `Bulk member import: ${createdCount} created, ${updatedCount} updated`,
      userId: actor.id,
      userName: actor.name || actor.username,
    });

    revalidatePath("/admin/users");
    revalidatePath("/admin/accounts");
    return { ok: true, createdCount, updatedCount, skippedCount };
  } catch (err) {
    return {
      ok: false,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      error: err instanceof Error ? err.message : "Bulk import failed.",
    };
  }
}

export async function syncItsToUsernamesAction(): Promise<{
  ok: boolean;
  updatedCount: number;
  error?: string;
}> {
  try {
    const actor = await requireServerSession();
    if (actor.role !== "ADMIN") {
      return { ok: false, updatedCount: 0, error: "Administrator access required." };
    }

    const users = await db.user.findMany({
      select: { id: true, username: true, its: true },
    });
    const usedUsernames = new Set(users.map((u) => u.username));
    const updatedIds: string[] = [];

    await withWriteLock(async () => {
      for (const u of users) {
        const cleanIts = u.its?.trim();
        if (!cleanIts || u.username === cleanIts) continue;
        if (usedUsernames.has(cleanIts)) continue;

        await db.user.update({
          where: { id: u.id },
          data: { username: cleanIts },
        });
        usedUsernames.delete(u.username);
        usedUsernames.add(cleanIts);
        updatedIds.push(u.id);
      }
    });

    for (const id of updatedIds) {
      await syncUserByIdToJamatevents(id);
    }

    revalidatePath("/admin/users");
    revalidatePath("/admin/settings");
    return { ok: true, updatedCount: updatedIds.length };
  } catch (err) {
    return {
      ok: false,
      updatedCount: 0,
      error: err instanceof Error ? err.message : "Sync ITS failed.",
    };
  }
}
