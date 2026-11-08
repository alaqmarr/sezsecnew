import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { Role } from "@/generated/prisma/client";
import { db, withWriteLock } from "@sezsec/db";
import {
  getCurrentSessionUser,
  type NavModuleInfo,
  type SessionUser,
} from "@sezsec/auth";
import { DEFAULT_SEZSEC_MODULES } from "./rbac.constants";
import { isSelfServiceMemberPath, matchDynamicPath } from "./rbac.helper";

let modulesSeededInProcess = false;

export async function ensureDefaultModulesSeeded(): Promise<void> {
  if (modulesSeededInProcess) return;
  try {
    const existing = await db.module.findMany({ select: { id: true, name: true } });
    const existingIds = new Set(existing.map((m) => m.id));
    const existingNames = new Set(existing.map((m) => m.name.toLowerCase()));

    const missing = DEFAULT_SEZSEC_MODULES.filter(
      (m) => !existingIds.has(m.id) && !existingNames.has(m.name.toLowerCase())
    );

    if (missing.length > 0) {
      await withWriteLock(async () => {
        for (const mod of missing) {
          await db.module.upsert({
            where: { id: mod.id },
            update: {},
            create: {
              id: mod.id,
              name: mod.name,
              description: mod.description,
              icon: mod.icon,
              links: {
                create: mod.links.map((l) => ({
                  path: l.path,
                  label: l.label,
                  order: l.order,
                })),
              },
            },
          });
        }
      });
    }
    modulesSeededInProcess = true;
  } catch (err) {
    console.error("[rbac] ensureDefaultModulesSeeded warning:", err);
  }
}

export async function hasUserPathAccess(
  user: SessionUser,
  targetPath: string
): Promise<boolean> {
  if (user.role === "ADMIN") return true;
  if (isSelfServiceMemberPath(targetPath)) return true;

  const cleanTarget = targetPath.split("?")[0].replace(/\/+$/, "") || "/";
  if (cleanTarget === "/admin/take-attendance" && user.isFloorLeader) {
    return true;
  }

  await ensureDefaultModulesSeeded();

  const records = await db.userModuleAccess.findMany({
    where: { userId: user.id },
    include: {
      module: {
        include: { links: true },
      },
    },
  });

  for (const rec of records) {
    for (const link of rec.module.links) {
      if (matchDynamicPath(link.path, cleanTarget)) {
        return true;
      }
    }
  }

  return false;
}

export async function getNavModulesForUser(
  user: SessionUser | null
): Promise<NavModuleInfo[]> {
  if (!user) return [];
  await ensureDefaultModulesSeeded();

  if (user.role === "ADMIN") {
    const all = await db.module.findMany({
      orderBy: { name: "asc" },
      include: { links: { orderBy: { order: "asc" } } },
    });
    return all
      .map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        icon: m.icon,
        links: m.links
          .filter((l) => !l.path.includes("["))
          .map((l) => ({ id: l.id, path: l.path, label: l.label })),
      }))
      .filter((m) => m.links.length > 0);
  }

  const assigned = await db.userModuleAccess.findMany({
    where: { userId: user.id },
    include: {
      module: {
        include: { links: { orderBy: { order: "asc" } } },
      },
    },
  });

  const navMods: NavModuleInfo[] = assigned
    .map((rec) => ({
      id: rec.module.id,
      name: rec.module.name,
      description: rec.module.description,
      icon: rec.module.icon,
      links: rec.module.links
        .filter((l) => !l.path.includes("["))
        .map((l) => ({ id: l.id, path: l.path, label: l.label })),
    }))
    .filter((m) => m.links.length > 0);

  if (
    user.isFloorLeader &&
    !navMods.some((m) => m.links.some((l) => l.path === "/admin/take-attendance"))
  ) {
    navMods.unshift({
      id: "floor-leader-attendance",
      name: "Take Live Attendance",
      description: "Floor Head / Sub-Head Attendance",
      icon: "UserCheck",
      links: [
        {
          id: "floor-leader-link",
          path: "/admin/take-attendance",
          label: "Take Attendance",
        },
      ],
    });
  }

  return navMods;
}

export async function requireServerSession(): Promise<SessionUser> {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function requireServerPathAccess(
  targetPath: string
): Promise<SessionUser> {
  const user = await requireServerSession();
  const allowed = await hasUserPathAccess(user, targetPath);
  if (!allowed) {
    redirect("/unauthorized");
  }
  return user;
}

export async function requireApiAuth(options?: {
  roles?: Role[];
  path?: string;
}): Promise<
  { ok: true; user: SessionUser } | { ok: false; response: NextResponse }
> {
  const user = await getCurrentSessionUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (options?.roles && options.roles.length > 0) {
    if (!options.roles.includes(user.role) && user.role !== "ADMIN") {
      return {
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }
  }

  if (options?.path) {
    const allowed = await hasUserPathAccess(user, options.path);
    if (!allowed) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }
  }

  return { ok: true, user };
}
