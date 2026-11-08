import { Pool, types as pgTypes, type PoolClient } from "pg";
import type {
  ApprovalStatus,
  AttendanceStatus,
  FeeStatus,
  ProfileStatus,
  Role,
} from "@/generated/prisma/client";
import { db, sqliteAdapterFactory, withWriteLock } from "@sezsec/db";
import { recordActivity } from "@sezsec/logs";
import {
  DEFAULT_SEZSEC_MODULES,
  EVENT_CHARGES_MODULE_ID,
} from "@sezsec/rbac/rbac.constants";
import type {
  MigrationPreviewReport,
  MigrationRunResult,
  MigrationTableCount,
} from "./migration.types";

function parsePgTimestampWithoutTzAsUtc(raw: string): Date {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return new Date(NaN);
  if (/[zZ]|[+-]\d{2}(:?\d{2})?$/.test(trimmed)) {
    return new Date(trimmed.replace(" ", "T"));
  }
  return new Date(`${trimmed.replace(" ", "T")}Z`);
}

pgTypes.setTypeParser(1114, parsePgTimestampWithoutTzAsUtc);
pgTypes.setTypeParser(
  1082,
  (raw: string) => new Date(`${String(raw).trim()}T00:00:00.000Z`)
);

const VALID_ROLES = new Set<Role>([
  "ADMIN",
  "ADMIN_CUSTOM",
  "MANAGER",
  "STAFF",
  "WATCHER",
  "USER",
]);
const VALID_PROFILE_STATUS = new Set<ProfileStatus>(["COMPLETED", "SKIPPED"]);
const VALID_APPROVAL_STATUS = new Set<ApprovalStatus>([
  "PENDING",
  "APPROVED",
  "REJECTED",
]);
const VALID_FEE_STATUS = new Set<FeeStatus>(["PENDING", "PARTIAL", "PAID"]);
const VALID_ATTENDANCE_STATUS = new Set<AttendanceStatus>([
  "PRESENT",
  "ABSENT",
  "EXCUSED",
]);

const VALID_SEZSEC_ROUTE_PATTERNS = new Set<string>([
  "/",
  "/events",
  "/menu",
  "/our-events",
  "/khidmat",
  "/join",
  "/profile",
  "/fees",
  "/inventory",
  "/admin/accounts",
  "/admin/fees",
  "/admin/attendance",
  "/admin/attendance-details",
  "/admin/attendance-details/[id]",
  "/admin/take-attendance",
  "/admin/my-attendance-history",
  "/admin/floors",
  "/admin/team",
  "/admin/users",
  "/admin/edit-user",
  "/admin/members",
  "/admin/khidmat",
  "/admin/banners",
  "/admin/blogs",
  "/admin/blogs/new",
  "/admin/modules",
  "/admin/manage-access",
  "/admin/manage-access/[userId]",
  "/admin/contributions",
  "/admin/contribution-history",
  "/admin/messages",
  "/admin/exports",
  "/admin/settings",
]);

function isSupportedSezsecLinkPath(rawPath: string): boolean {
  const clean = String(rawPath || "")
    .split("?")[0]
    .trim()
    .replace(/\/+$/, "");
  const normalized = clean || "/";
  return VALID_SEZSEC_ROUTE_PATTERNS.has(normalized);
}

function coerceRole(val: unknown): Role {
  const s = String(val || "").toUpperCase() as Role;
  return VALID_ROLES.has(s) ? s : "USER";
}

function coerceProfileStatus(val: unknown): ProfileStatus | null {
  if (!val) return null;
  const s = String(val).toUpperCase() as ProfileStatus;
  return VALID_PROFILE_STATUS.has(s) ? s : null;
}

function coerceApprovalStatus(val: unknown): ApprovalStatus {
  const s = String(val || "").toUpperCase() as ApprovalStatus;
  return VALID_APPROVAL_STATUS.has(s) ? s : "PENDING";
}

function coerceFeeStatus(val: unknown): FeeStatus {
  const s = String(val || "").toUpperCase() as FeeStatus;
  return VALID_FEE_STATUS.has(s) ? s : "PENDING";
}

function coerceAttendanceStatus(val: unknown): AttendanceStatus {
  const s = String(val || "").toUpperCase() as AttendanceStatus;
  return VALID_ATTENDANCE_STATUS.has(s) ? s : "PRESENT";
}

function cleanNullableUnique(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  const trimmed = String(val).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNeonConnectionUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    parsed.searchParams.delete("sslmode");
    parsed.searchParams.delete("channel_binding");
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

const TABLE_DEFINITIONS: Array<{
  table: string;
  label: string;
  group: "Members & RBAC" | "Finance & Attendance" | "Community Content";
  countSqlite: () => Promise<number>;
}> = [
  {
    table: "users",
    label: "Committee Member Accounts",
    group: "Members & RBAC",
    countSqlite: () => db.user.count(),
  },
  {
    table: "modules",
    label: "RBAC Access Modules",
    group: "Members & RBAC",
    countSqlite: () => db.module.count(),
  },
  {
    table: "module_links",
    label: "Module Route Links",
    group: "Members & RBAC",
    countSqlite: () => db.moduleLink.count(),
  },
  {
    table: "user_module_access",
    label: "Member Permissions",
    group: "Members & RBAC",
    countSqlite: () => db.userModuleAccess.count(),
  },
  {
    table: "user_fee_configs",
    label: "Member Monthly Fee Configs",
    group: "Finance & Attendance",
    countSqlite: () => db.userFeeConfig.count(),
  },
  {
    table: "fee_records",
    label: "Monthly Contribution Records",
    group: "Finance & Attendance",
    countSqlite: () => db.feeRecord.count(),
  },
  {
    table: "fee_transactions",
    label: "Recorded Payment Transactions",
    group: "Finance & Attendance",
    countSqlite: () => db.feeTransaction.count(),
  },
  {
    table: "event_contributions",
    label: "Event Contribution Funds",
    group: "Finance & Attendance",
    countSqlite: () => db.eventContribution.count(),
  },
  {
    table: "fee_transaction_allocations",
    label: "Payment Ledger Allocations",
    group: "Finance & Attendance",
    countSqlite: () => db.feeTransactionAllocation.count(),
  },
  {
    table: "floor_configs",
    label: "Floor Hierarchy Groups",
    group: "Finance & Attendance",
    countSqlite: () => db.floorConfig.count(),
  },
  {
    table: "attendance_event_clones",
    label: "Attendance Sessions",
    group: "Finance & Attendance",
    countSqlite: () => db.attendanceEventClone.count(),
  },
  {
    table: "attendance_records",
    label: "Miqaat Attendance Marks",
    group: "Finance & Attendance",
    countSqlite: () => db.attendanceRecord.count(),
  },
  {
    table: "member_registrations",
    label: "Committee Applications",
    group: "Community Content",
    countSqlite: () => db.memberRegistration.count(),
  },
  {
    table: "khidmat_requests",
    label: "Khidmat Invitations",
    group: "Community Content",
    countSqlite: () => db.khidmatRequest.count(),
  },
  {
    table: "blogs",
    label: "Community Chronicles",
    group: "Community Content",
    countSqlite: () => db.blog.count(),
  },
  {
    table: "banners",
    label: "Homepage Banners",
    group: "Community Content",
    countSqlite: () => db.banner.count(),
  },
];

async function withReadOnlyNeonClient<T>(
  connectionUrl: string,
  fn: (client: PoolClient, existingTables: Set<string>) => Promise<T>
): Promise<T> {
  const pool = new Pool({
    connectionString: normalizeNeonConnectionUrl(connectionUrl),
    max: 1,
    connectionTimeoutMillis: 15000,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  try {
    await client.query("SET TIME ZONE 'UTC';");
    await client.query("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;");
    await client.query("BEGIN READ ONLY;");

    const tablesRes = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    );
    const existingTables = new Set(tablesRes.rows.map((r) => r.table_name));

    const result = await fn(client, existingTables);
    await client.query("ROLLBACK;");
    return result;
  } finally {
    client.release();
    await pool.end().catch(() => null);
  }
}

function toDate(val: unknown, fallback: Date = new Date()): Date {
  if (!val) return fallback;
  if (val instanceof Date) return val;
  const d = new Date(String(val));
  return Number.isNaN(d.getTime()) ? fallback : d;
}

function toNullableDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  const d = new Date(String(val));
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function inspectNeonVsSqliteCounts(
  customNeonUrl?: string
): Promise<MigrationPreviewReport> {
  const neonUrl = (customNeonUrl || process.env.NEON_DATABASE_URL || "").trim();
  const sqliteCounts = await Promise.all(
    TABLE_DEFINITIONS.map((t) => t.countSqlite())
  );

  if (!neonUrl) {
    const tables: MigrationTableCount[] = TABLE_DEFINITIONS.map((def, idx) => ({
      table: def.table,
      label: def.label,
      group: def.group,
      neonCount: 0,
      sqliteCount: sqliteCounts[idx],
    }));
    return {
      neonConfigured: false,
      neonReachable: false,
      error: "NEON_DATABASE_URL is not configured in .env.",
      tables,
      totalNeonRows: 0,
      totalSqliteRows: sqliteCounts.reduce((a, b) => a + b, 0),
    };
  }

  try {
    const neonCountMap = await withReadOnlyNeonClient(
      neonUrl,
      async (client, existingTables) => {
        const counts: Record<string, number> = {};
        for (const def of TABLE_DEFINITIONS) {
          if (!existingTables.has(def.table)) {
            counts[def.table] = 0;
            continue;
          }
          const res = await client.query<{ cnt: string }>(
            `SELECT COUNT(*)::text AS cnt FROM "${def.table}"`
          );
          counts[def.table] = parseInt(res.rows[0]?.cnt || "0", 10);
        }
        return counts;
      }
    );

    const tables: MigrationTableCount[] = TABLE_DEFINITIONS.map((def, idx) => ({
      table: def.table,
      label: def.label,
      group: def.group,
      neonCount: neonCountMap[def.table] ?? 0,
      sqliteCount: sqliteCounts[idx],
    }));

    return {
      neonConfigured: true,
      neonReachable: true,
      tables,
      totalNeonRows: Object.values(neonCountMap).reduce((a, b) => a + b, 0),
      totalSqliteRows: sqliteCounts.reduce((a, b) => a + b, 0),
    };
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : "Could not connect to Neon PostgreSQL.";
    const tables: MigrationTableCount[] = TABLE_DEFINITIONS.map((def, idx) => ({
      table: def.table,
      label: def.label,
      group: def.group,
      neonCount: 0,
      sqliteCount: sqliteCounts[idx],
    }));
    return {
      neonConfigured: true,
      neonReachable: false,
      error: msg,
      tables,
      totalNeonRows: 0,
      totalSqliteRows: sqliteCounts.reduce((a, b) => a + b, 0),
    };
  }
}

export async function runOneClickNeonToSqliteMigration(params: {
  actor: { id: string; name: string };
  customNeonUrl?: string;
}): Promise<MigrationRunResult> {
  const startedAt = performance.now();
  const neonUrl = (
    params.customNeonUrl ||
    process.env.NEON_DATABASE_URL ||
    ""
  ).trim();

  if (!neonUrl) {
    throw new Error("NEON_DATABASE_URL is missing.");
  }

  const importedByTable: Record<string, number> = {};
  const warnings: string[] = [];

  const snapshot = await withReadOnlyNeonClient(
    neonUrl,
    async (client, existingTables) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const selectAll = async (tableName: string): Promise<any[]> => {
        if (!existingTables.has(tableName)) return [];
        const res = await client.query(`SELECT * FROM "${tableName}"`);
        return res.rows;
      };

      return {
        modules: await selectAll("modules"),
        moduleLinks: await selectAll("module_links"),
        users: await selectAll("users"),
        userModuleAccess: await selectAll("user_module_access"),
        events: await selectAll("events"),
        config: await selectAll("config"),
        khidmatRequests: await selectAll("khidmat_requests"),
        memberRegistrations: await selectAll("member_registrations"),
        blogs: await selectAll("blogs"),
        banners: await selectAll("banners"),
        userFeeConfigs: await selectAll("user_fee_configs"),
        feeRecords: await selectAll("fee_records"),
        feeTransactions: await selectAll("fee_transactions"),
        eventContributions: await selectAll("event_contributions"),
        feeTransactionAllocations: await selectAll(
          "fee_transaction_allocations"
        ),
        floorConfigs: await selectAll("floor_configs"),
        floorHeadsJoin: await selectAll("_FloorHeads"),
        floorSubHeadsJoin: await selectAll("_FloorSubHeads"),
        floorMembersJoin: await selectAll("_FloorMembers"),
        attendanceRecords: await selectAll("attendance_records"),
        attendanceEventClones: await selectAll("attendance_event_clones"),
      };
    }
  );

  // Build quick lookup map for Neon events so AttendanceEventClone gets snapshot metadata
  const neonEventsById = new Map<
    string,
    {
      title: string;
      occasionDate: Date;
      occasionTime: string;
      eventType: string;
    }
  >();
  for (const ev of snapshot.events) {
    neonEventsById.set(String(ev.id), {
      title: String(ev.description || ev.name || "Jamaat Miqaat"),
      occasionDate: toDate(ev.occasionDate),
      occasionTime: String(ev.occasionTime || "07:30 PM"),
      eventType: String(ev.eventType || "PUBLIC"),
    });
  }

  await withWriteLock(() =>
    db.$transaction(
      async (tx) => {
        // 1. Modules & Module Links
        const moduleIdMap = new Map<string, string>();
        for (const m of snapshot.modules) {
          const byId = await tx.module.findUnique({ where: { id: m.id } });
          const byName = await tx.module.findUnique({
            where: { name: m.name },
          });

          if (byId) {
            await tx.module.update({
              where: { id: byId.id },
              data: {
                ...(byName && byName.id !== byId.id ? {} : { name: m.name }),
                description: m.description ?? null,
                icon: m.icon ?? null,
              },
            });
            moduleIdMap.set(m.id, byId.id);
          } else if (byName) {
            await tx.module.update({
              where: { id: byName.id },
              data: {
                description: m.description ?? null,
                icon: m.icon ?? null,
              },
            });
            moduleIdMap.set(m.id, byName.id);
          } else {
            const created = await tx.module.create({
              data: {
                id: m.id,
                name: m.name,
                description: m.description ?? null,
                icon: m.icon ?? null,
                createdAt: toDate(m.createdAt),
              },
            });
            moduleIdMap.set(m.id, created.id);
          }
        }

        for (const defMod of DEFAULT_SEZSEC_MODULES) {
          const existingById = await tx.module.findUnique({
            where: { id: defMod.id },
          });
          const existingByName = await tx.module.findUnique({
            where: { name: defMod.name },
          });
          if (!existingById && !existingByName) {
            await tx.module.create({
              data: {
                id: defMod.id,
                name: defMod.name,
                description: defMod.description,
                icon: defMod.icon,
                links: {
                  create: defMod.links.map((l) => ({
                    path: l.path,
                    label: l.label,
                    order: l.order,
                  })),
                },
              },
            });
          }
        }
        importedByTable.modules = snapshot.modules.length;

        let mlCount = 0;
        for (const ml of snapshot.moduleLinks) {
          const mappedModuleId = moduleIdMap.get(ml.moduleId);
          if (!mappedModuleId) continue;
          if (!isSupportedSezsecLinkPath(ml.path)) continue;
          await tx.moduleLink.upsert({
            where: { id: ml.id },
            update: {
              moduleId: mappedModuleId,
              path: ml.path,
              label: ml.label ?? null,
              order: Number(ml.order ?? 0),
            },
            create: {
              id: ml.id,
              moduleId: mappedModuleId,
              path: ml.path,
              label: ml.label ?? null,
              order: Number(ml.order ?? 0),
            },
          });
          mlCount += 1;
        }
        importedByTable.module_links = mlCount;

        // 2. Users (Pass 1: accounts; Pass 2: self-referential headedById)
        const userIdMap = new Map<string, string>();
        const existingUsers = await tx.user.findMany({
          select: { id: true, username: true, its: true },
        });
        const idToUser = new Map(existingUsers.map((x) => [x.id, x]));
        const usernameToId = new Map(
          existingUsers.map((x) => [x.username, x.id])
        );
        const itsToId = new Map<string, string>();
        for (const ex of existingUsers) {
          if (ex.its) itsToId.set(ex.its, ex.id);
        }

        for (const u of snapshot.users) {
          const cleanUsername = String(u.username || "").trim();
          if (!cleanUsername) continue;
          const rawIts = cleanNullableUnique(u.its);

          const matchId =
            (idToUser.has(u.id) ? u.id : undefined) ||
            usernameToId.get(cleanUsername) ||
            (rawIts ? itsToId.get(rawIts) : undefined);

          const safeIts =
            rawIts &&
            (!itsToId.has(rawIts) || itsToId.get(rawIts) === (matchId || u.id))
              ? rawIts
              : null;

          if (rawIts && !safeIts) {
            warnings.push(
              `Skipped duplicate ITS "${rawIts}" on user ${cleanUsername}.`
            );
          }

          if (matchId) {
            const canUpdateUsername =
              !usernameToId.has(cleanUsername) ||
              usernameToId.get(cleanUsername) === matchId;

            await tx.user.update({
              where: { id: matchId },
              data: {
                ...(canUpdateUsername ? { username: cleanUsername } : {}),
                password: String(u.password || ""),
                email: u.email ?? null,
                mobile: u.mobile ?? null,
                name: u.name ?? null,
                role: coerceRole(u.role),
                profileStatus: coerceProfileStatus(u.profileStatus),
                dob: toNullableDate(u.dob),
                quranHifz: u.quranHifz ?? null,
                passport: u.passport ?? null,
                kunSafar: u.kunSafar ?? null,
                occupation: u.occupation ?? null,
                sports: u.sports ?? null,
                its: safeIts,
              },
            });
            userIdMap.set(u.id, matchId);
            if (canUpdateUsername) usernameToId.set(cleanUsername, matchId);
            if (safeIts) itsToId.set(safeIts, matchId);
          } else {
            const created = await tx.user.create({
              data: {
                id: u.id,
                username: cleanUsername,
                password: String(u.password || ""),
                email: u.email ?? null,
                mobile: u.mobile ?? null,
                name: u.name ?? null,
                role: coerceRole(u.role),
                profileStatus: coerceProfileStatus(u.profileStatus),
                dob: toNullableDate(u.dob),
                quranHifz: u.quranHifz ?? null,
                passport: u.passport ?? null,
                kunSafar: u.kunSafar ?? null,
                occupation: u.occupation ?? null,
                sports: u.sports ?? null,
                its: safeIts,
                createdAt: toDate(u.createdAt),
                updatedAt: toDate(u.updatedAt),
              },
            });
            userIdMap.set(u.id, created.id);
            idToUser.set(created.id, {
              id: created.id,
              username: cleanUsername,
              its: safeIts,
            });
            usernameToId.set(cleanUsername, created.id);
            if (safeIts) itsToId.set(safeIts, created.id);
          }
        }

        for (const u of snapshot.users) {
          if (!u.headedById) continue;
          const uid = userIdMap.get(u.id);
          const headId = userIdMap.get(u.headedById);
          if (uid && headId && uid !== headId) {
            await tx.user.update({
              where: { id: uid },
              data: { headedById: headId },
            });
          }
        }
        importedByTable.users = userIdMap.size;

        // 3. User Module Access
        let umaCount = 0;
        for (const uma of snapshot.userModuleAccess) {
          const uid = userIdMap.get(uma.userId);
          const mid = moduleIdMap.get(uma.moduleId);
          if (!uid || !mid) continue;

          const existingAccess = await tx.userModuleAccess.findUnique({
            where: { userId_moduleId: { userId: uid, moduleId: mid } },
          });
          if (!existingAccess) {
            const idTaken = await tx.userModuleAccess.findUnique({
              where: { id: uma.id },
            });
            await tx.userModuleAccess.create({
              data: {
                ...(idTaken ? {} : { id: uma.id }),
                userId: uid,
                moduleId: mid,
                createdAt: toDate(uma.createdAt),
              },
            });
          }
          umaCount += 1;
        }

        // Grant event_charges to ADMIN users automatically so OTP works smoothly
        const adminUsers = await tx.user.findMany({
          where: { role: "ADMIN" },
          select: { id: true },
        });
        for (const admin of adminUsers) {
          await tx.userModuleAccess.upsert({
            where: {
              userId_moduleId: {
                userId: admin.id,
                moduleId: EVENT_CHARGES_MODULE_ID,
              },
            },
            update: {},
            create: {
              userId: admin.id,
              moduleId: EVENT_CHARGES_MODULE_ID,
            },
          });
        }
        importedByTable.user_module_access = umaCount;

        // 4. Community Content & Applications
        for (const kr of snapshot.khidmatRequests) {
          await tx.khidmatRequest.upsert({
            where: { id: kr.id },
            update: {
              miqat: kr.miqat,
              name: kr.name,
              phone: kr.phone,
              date: toDate(kr.date),
              status: coerceApprovalStatus(kr.status),
            },
            create: {
              id: kr.id,
              miqat: kr.miqat,
              name: kr.name,
              phone: kr.phone,
              date: toDate(kr.date),
              status: coerceApprovalStatus(kr.status),
              createdAt: toDate(kr.createdAt),
              updatedAt: toDate(kr.updatedAt),
            },
          });
        }
        importedByTable.khidmat_requests = snapshot.khidmatRequests.length;

        for (const mr of snapshot.memberRegistrations) {
          const byId = await tx.memberRegistration.findUnique({
            where: { id: mr.id },
          });
          const byIts = mr.its
            ? await tx.memberRegistration.findUnique({
                where: { its: mr.its },
              })
            : null;
          const targetMr = byId || byIts;

          const mrData = {
            title: mr.title || "",
            name: mr.name,
            its: mr.its,
            email: mr.email || "",
            dob: toDate(mr.dob),
            phone: mr.phone || "",
            quranHifz: mr.quranHifz || "",
            passport: mr.passport || "",
            kunSafar: mr.kunSafar || "",
            occupation: mr.occupation || "",
            sports: mr.sports || "",
            status: coerceApprovalStatus(mr.status),
          };

          if (targetMr) {
            await tx.memberRegistration.update({
              where: { id: targetMr.id },
              data: mrData,
            });
          } else {
            await tx.memberRegistration.create({
              data: {
                id: mr.id,
                ...mrData,
                createdAt: toDate(mr.createdAt),
                updatedAt: toDate(mr.updatedAt),
              },
            });
          }
        }
        importedByTable.member_registrations =
          snapshot.memberRegistrations.length;

        for (const b of snapshot.blogs) {
          await tx.blog.upsert({
            where: { id: b.id },
            update: {
              title: b.title,
              content: b.content || "",
              author: b.author || "",
              publishedAt: toDate(b.publishedAt),
            },
            create: {
              id: b.id,
              title: b.title,
              content: b.content || "",
              author: b.author || "",
              publishedAt: toDate(b.publishedAt),
              createdAt: toDate(b.createdAt),
              updatedAt: toDate(b.updatedAt),
            },
          });
        }
        importedByTable.blogs = snapshot.blogs.length;

        for (const bn of snapshot.banners) {
          await tx.banner.upsert({
            where: { id: bn.id },
            update: {
              imageUrl: bn.imageUrl,
              href: bn.href ?? null,
              isActive: Boolean(bn.isActive),
              countdownTarget: toNullableDate(bn.countdownTarget),
              countdownLabel: bn.countdownLabel ?? null,
              x: bn.x !== null && bn.x !== undefined ? Number(bn.x) : 50,
              y: bn.y !== null && bn.y !== undefined ? Number(bn.y) : 50,
              countdownSize: bn.countdownSize ?? "normal",
              countdownColor: bn.countdownColor ?? "gold",
            },
            create: {
              id: bn.id,
              imageUrl: bn.imageUrl,
              href: bn.href ?? null,
              isActive: Boolean(bn.isActive),
              countdownTarget: toNullableDate(bn.countdownTarget),
              countdownLabel: bn.countdownLabel ?? null,
              x: bn.x !== null && bn.x !== undefined ? Number(bn.x) : 50,
              y: bn.y !== null && bn.y !== undefined ? Number(bn.y) : 50,
              countdownSize: bn.countdownSize ?? "normal",
              countdownColor: bn.countdownColor ?? "gold",
              createdAt: toDate(bn.createdAt),
              updatedAt: toDate(bn.updatedAt),
            },
          });
        }
        importedByTable.banners = snapshot.banners.length;

        // 5. Finance & Contributions
        let ufcCount = 0;
        for (const ufc of snapshot.userFeeConfigs) {
          const uid = userIdMap.get(ufc.userId);
          if (!uid) continue;
          const existingUfc = await tx.userFeeConfig.findUnique({
            where: { userId: uid },
          });
          if (existingUfc) {
            await tx.userFeeConfig.update({
              where: { userId: uid },
              data: { amount: Number(ufc.amount ?? 0) },
            });
          } else {
            const idTaken = await tx.userFeeConfig.findUnique({
              where: { id: ufc.id },
            });
            await tx.userFeeConfig.create({
              data: {
                ...(idTaken ? {} : { id: ufc.id }),
                userId: uid,
                amount: Number(ufc.amount ?? 0),
                updatedAt: toDate(ufc.updatedAt),
              },
            });
          }
          ufcCount += 1;
        }
        importedByTable.user_fee_configs = ufcCount;

        const feeRecordIdMap = new Map<string, string>();
        for (const fr of snapshot.feeRecords) {
          const uid = userIdMap.get(fr.userId);
          if (!uid) continue;
          const month = Number(fr.month ?? 0);
          const year = Number(fr.year ?? 2026);

          const byComposite = await tx.feeRecord.findUnique({
            where: { userId_month_year: { userId: uid, month, year } },
          });
          const byId = await tx.feeRecord.findUnique({ where: { id: fr.id } });
          const target = byComposite || byId;

          if (target) {
            await tx.feeRecord.update({
              where: { id: target.id },
              data: {
                amount: Number(fr.amount ?? 0),
                paidAmount: Number(fr.paidAmount ?? 0),
                status: coerceFeeStatus(fr.status),
              },
            });
            feeRecordIdMap.set(fr.id, target.id);
          } else {
            const created = await tx.feeRecord.create({
              data: {
                id: fr.id,
                userId: uid,
                month,
                year,
                amount: Number(fr.amount ?? 0),
                paidAmount: Number(fr.paidAmount ?? 0),
                status: coerceFeeStatus(fr.status),
                createdAt: toDate(fr.createdAt),
                updatedAt: toDate(fr.updatedAt),
              },
            });
            feeRecordIdMap.set(fr.id, created.id);
          }
        }
        importedByTable.fee_records = feeRecordIdMap.size;

        const validFeeTxIds = new Set<string>();
        for (const ft of snapshot.feeTransactions) {
          const uid = userIdMap.get(ft.userId);
          if (!uid) continue;
          await tx.feeTransaction.upsert({
            where: { id: ft.id },
            update: {
              userId: uid,
              amount: Number(ft.amount ?? 0),
              mode: ft.mode || "CASH",
              reference: ft.reference ?? null,
              note: ft.note ?? null,
              date: toDate(ft.date),
            },
            create: {
              id: ft.id,
              userId: uid,
              amount: Number(ft.amount ?? 0),
              mode: ft.mode || "CASH",
              reference: ft.reference ?? null,
              note: ft.note ?? null,
              date: toDate(ft.date),
            },
          });
          validFeeTxIds.add(ft.id);
        }
        importedByTable.fee_transactions = validFeeTxIds.size;

        const validContributionIds = new Set<string>();
        for (const ec of snapshot.eventContributions) {
          const uid = userIdMap.get(ec.userId);
          if (!uid) continue;
          await tx.eventContribution.upsert({
            where: { id: ec.id },
            update: {
              userId: uid,
              title: ec.title,
              amount: Number(ec.amount ?? 0),
              paidAmount: Number(ec.paidAmount ?? 0),
              status: coerceFeeStatus(ec.status),
            },
            create: {
              id: ec.id,
              userId: uid,
              title: ec.title,
              amount: Number(ec.amount ?? 0),
              paidAmount: Number(ec.paidAmount ?? 0),
              status: coerceFeeStatus(ec.status),
              createdAt: toDate(ec.createdAt),
              updatedAt: toDate(ec.updatedAt),
            },
          });
          validContributionIds.add(ec.id);
        }
        importedByTable.event_contributions = validContributionIds.size;

        let ftaCount = 0;
        for (const fta of snapshot.feeTransactionAllocations) {
          if (!validFeeTxIds.has(fta.transactionId)) continue;
          const mappedFeeRecordId = fta.feeRecordId
            ? (feeRecordIdMap.get(fta.feeRecordId) ?? null)
            : null;
          const mappedContributionId =
            fta.eventContributionId &&
            validContributionIds.has(fta.eventContributionId)
              ? fta.eventContributionId
              : null;

          await tx.feeTransactionAllocation.upsert({
            where: { id: fta.id },
            update: {
              allocatedAmount: Number(fta.allocatedAmount ?? 0),
              feeRecordId: mappedFeeRecordId,
              eventContributionId: mappedContributionId,
            },
            create: {
              id: fta.id,
              transactionId: fta.transactionId,
              feeRecordId: mappedFeeRecordId,
              eventContributionId: mappedContributionId,
              allocatedAmount: Number(fta.allocatedAmount ?? 0),
            },
          });
          ftaCount += 1;
        }
        importedByTable.fee_transaction_allocations = ftaCount;

        // 6. Floor Hierarchy & Attendance
        for (const fc of snapshot.floorConfigs) {
          const mapJoinUsers = (rows: Array<{ A: string; B: string }>) => {
            const uniqueIds = new Set<string>();
            for (const j of rows) {
              if (j.A === fc.id) {
                const mapped = userIdMap.get(String(j.B));
                if (mapped) uniqueIds.add(mapped);
              }
            }
            return [...uniqueIds].map((id) => ({ id }));
          };

          const headIds = mapJoinUsers(snapshot.floorHeadsJoin);
          const subHeadIds = mapJoinUsers(snapshot.floorSubHeadsJoin);
          const memberIds = mapJoinUsers(snapshot.floorMembersJoin);

          const byId = await tx.floorConfig.findUnique({
            where: { id: fc.id },
          });
          const byName = await tx.floorConfig.findUnique({
            where: { name: fc.name },
          });
          const target = byId || byName;

          if (target) {
            await tx.floorConfig.update({
              where: { id: target.id },
              data: {
                ...(byName && byName.id !== target.id ? {} : { name: fc.name }),
                heads: { set: headIds },
                subHeads: { set: subHeadIds },
                members: { set: memberIds },
              },
            });
          } else {
            await tx.floorConfig.create({
              data: {
                id: fc.id,
                name: fc.name,
                createdAt: toDate(fc.createdAt),
                updatedAt: toDate(fc.updatedAt),
                heads: { connect: headIds },
                subHeads: { connect: subHeadIds },
                members: { connect: memberIds },
              },
            });
          }
        }
        importedByTable.floor_configs = snapshot.floorConfigs.length;

        let arCount = 0;
        for (const ar of snapshot.attendanceRecords) {
          const uid = userIdMap.get(ar.userId);
          if (!uid || !ar.eventId) continue;
          const markerId = ar.markedById
            ? (userIdMap.get(ar.markedById) ?? null)
            : null;

          await tx.attendanceRecord.upsert({
            where: {
              eventId_userId: {
                eventId: String(ar.eventId),
                userId: uid,
              },
            },
            update: {
              status: coerceAttendanceStatus(ar.status),
              markedById: markerId,
            },
            create: {
              id: ar.id,
              eventId: String(ar.eventId),
              userId: uid,
              markedById: markerId,
              status: coerceAttendanceStatus(ar.status),
              timestamp: toDate(ar.timestamp),
            },
          });
          arCount += 1;
        }
        importedByTable.attendance_records = arCount;

        let aecCount = 0;
        for (const aec of snapshot.attendanceEventClones) {
          if (!aec.eventId) continue;
          const evMeta = neonEventsById.get(String(aec.eventId));
          await tx.attendanceEventClone.upsert({
            where: { eventId: String(aec.eventId) },
            update: {
              isActive: Boolean(aec.isActive),
              startTime: toDate(aec.startTime),
              endTime: toDate(aec.endTime),
              ...(evMeta
                ? {
                    eventTitle: evMeta.title,
                    eventDate: evMeta.occasionDate,
                    eventTime: evMeta.occasionTime,
                    eventType: evMeta.eventType,
                  }
                : {}),
            },
            create: {
              id: aec.id,
              eventId: String(aec.eventId),
              eventTitle: evMeta?.title ?? null,
              eventDate: evMeta?.occasionDate ?? null,
              eventTime: evMeta?.occasionTime ?? null,
              eventType: evMeta?.eventType ?? null,
              isActive: Boolean(aec.isActive),
              startTime: toDate(aec.startTime),
              endTime: toDate(aec.endTime),
              createdAt: toDate(aec.createdAt),
            },
          });
          aecCount += 1;
        }
        importedByTable.attendance_event_clones = aecCount;
      },
      { maxWait: 20000, timeout: 180000 }
    )
  );

  sqliteAdapterFactory.checkpointWalPassive();

  const totalImported = Object.values(importedByTable).reduce(
    (a, b) => a + b,
    0
  );
  const durationMs = Math.round(performance.now() - startedAt);

  await recordActivity({
    action: "MIGRATION_COMPLETED",
    summary: `Imported ${totalImported} records from legacy Neon database in ${(durationMs / 1000).toFixed(1)}s`,
    userId: params.actor.id,
    userName: params.actor.name,
    details: {
      totalImported,
      durationMs,
      importedByTable,
    },
  });

  return {
    ok: true,
    durationMs,
    importedByTable,
    totalImported,
    warnings,
  };
}

export async function syncInitialPortalDataIfEmpty(): Promise<{
  synced: boolean;
  totalImported: number;
  usersSynced: number;
  durationMs: number;
}> {
  const userCount = await db.user.count();
  if (userCount > 0) {
    return {
      synced: false,
      totalImported: 0,
      usersSynced: userCount,
      durationMs: 0,
    };
  }

  const neonUrl = (process.env.NEON_DATABASE_URL || "").trim();
  if (!neonUrl) {
    throw new Error(
      "NEON_DATABASE_URL is not configured in .env for initial database sync."
    );
  }

  const res = await runOneClickNeonToSqliteMigration({
    actor: { id: "system", name: "Initial Database Sync" },
  });

  return {
    synced: true,
    totalImported: res.totalImported,
    usersSynced: res.importedByTable.users ?? 0,
    durationMs: res.durationMs,
  };
}
