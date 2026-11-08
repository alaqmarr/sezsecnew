import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import type {
  ApprovalStatus,
  AttendanceStatus,
  FeeStatus,
  ProfileStatus,
  Role,
} from "@/generated/prisma/client";
import {
  getBridgeSecretKey,
  getInternalJamateventsUrl,
} from "@sezsec/bridge/bridge.service";
import {
  db,
  getDatabaseHealth,
  sqliteAdapterFactory,
  withWriteLock,
} from "@sezsec/db";
import { recordActivity } from "@sezsec/logs";
import {
  DEFAULT_SEZSEC_MODULES,
  EVENT_CHARGES_MODULE_ID,
} from "@sezsec/rbac/rbac.constants";
import { formatTimeDisplay, getHallModuleId } from "@sezsec/shared";
import type {
  InventorySyncSourceMode,
  MigrationPreviewReport,
  MigrationRunResult,
  MigrationTableCount,
} from "./migration.types";

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

function coerceBoolean(val: unknown): boolean {
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val !== 0;
  if (typeof val === "string") {
    const lower = val.trim().toLowerCase();
    return lower === "true" || lower === "1";
  }
  return Boolean(val);
}

function cleanNullableUnique(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  const trimmed = String(val).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toDate(val: unknown, fallback: Date = new Date()): Date {
  if (val === null || val === undefined || val === "") return fallback;
  if (val instanceof Date) {
    return Number.isNaN(val.getTime()) ? fallback : val;
  }
  if (typeof val === "number") {
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? fallback : d;
  }
  const str = String(val).trim();
  if (!str) return fallback;
  if (/^\d{10,15}$/.test(str)) {
    const d = new Date(Number(str));
    return Number.isNaN(d.getTime()) ? fallback : d;
  }
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

function toNullableDate(val: unknown): Date | null {
  if (val === null || val === undefined || val === "") return null;
  if (val instanceof Date) {
    return Number.isNaN(val.getTime()) ? null : val;
  }
  if (typeof val === "number") {
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const str = String(val).trim();
  if (!str) return null;
  if (/^\d{10,15}$/.test(str)) {
    const d = new Date(Number(str));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

interface UnifiedFloorSnapshot {
  id: string;
  name: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  headIds: string[];
  subHeadIds: string[];
  memberIds: string[];
}

interface UnifiedAttendanceCloneSnapshot {
  id: string;
  eventId: string;
  isActive: unknown;
  startTime: unknown;
  endTime: unknown;
  createdAt?: unknown;
  eventTitle?: string | null;
  eventDate?: unknown;
  eventTime?: string | null;
  eventType?: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawRow = Record<string, any>;

interface InventoryBootstrapSnapshot {
  modules: RawRow[];
  moduleLinks: RawRow[];
  users: RawRow[];
  userModuleAccess: RawRow[];
  halls: Array<{ id?: string; name: string }>;
  khidmatRequests: RawRow[];
  memberRegistrations: RawRow[];
  blogs: RawRow[];
  banners: RawRow[];
  userFeeConfigs: RawRow[];
  feeRecords: RawRow[];
  feeTransactions: RawRow[];
  eventContributions: RawRow[];
  feeTransactionAllocations: RawRow[];
  floorConfigs: UnifiedFloorSnapshot[];
  attendanceRecords: RawRow[];
  attendanceEventClones: UnifiedAttendanceCloneSnapshot[];
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

function resolveSiblingInventorySqlitePath(): string | null {
  const candidates: string[] = [];
  if (process.env.INVENTORY_DB_PATH?.trim()) {
    const custom = process.env.INVENTORY_DB_PATH.trim().replace(/^file:/, "");
    candidates.push(
      path.isAbsolute(custom)
        ? custom
        : path.resolve(/*turbopackIgnore: true*/ process.cwd(), custom)
    );
  }

  candidates.push(
    path.resolve(
      /*turbopackIgnore: true*/ process.cwd(),
      "../sezinv/data/jamatevents.db"
    ),
    path.resolve(
      /*turbopackIgnore: true*/ process.cwd(),
      "../jamatevents/data/jamatevents.db"
    ),
    "/home/ubuntu/sezinv/data/jamatevents.db"
  );

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(/*turbopackIgnore: true*/ candidate)) {
        return candidate;
      }
    } catch {
      // Ignore inaccessible candidate path
    }
  }

  return null;
}

async function withReadOnlyInventorySqlite<T>(
  sqliteFilePath: string,
  fn: (sqlite: Database.Database, existingTables: Set<string>) => T
): Promise<T> {
  if (!sqliteAdapterFactory.getRawClient()) {
    await getDatabaseHealth();
  }
  const primaryClient = sqliteAdapterFactory.getRawClient();
  if (!primaryClient) {
    throw new Error("Primary SQLite adapter client is not initialized.");
  }

  const DatabaseCtor = primaryClient.constructor as unknown as new (
    filename: string,
    options?: Database.Options
  ) => Database.Database;

  let sqlite: Database.Database;
  try {
    sqlite = new DatabaseCtor(sqliteFilePath, {
      readonly: true,
      fileMustExist: true,
      timeout: 8000,
    });
  } catch {
    // If WAL -shm has not been initialized yet by a writer, open with query_only=ON so zero writes can occur
    sqlite = new DatabaseCtor(sqliteFilePath, {
      fileMustExist: true,
      timeout: 8000,
    });
    sqlite.pragma("query_only = ON");
  }

  try {
    const rows = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as Array<{ name: string }>;
    const existingTables = new Set(rows.map((r) => r.name));
    return fn(sqlite, existingTables);
  } finally {
    sqlite.close();
  }
}

async function fetchInventoryBridgeJson<T>(
  pathAndQuery: string
): Promise<{ data: T; baseUrl: string }> {
  const primaryBase = await getInternalJamateventsUrl();
  const candidateBases = [primaryBase];
  if (primaryBase.includes("127.0.0.1")) {
    candidateBases.push(primaryBase.replace("127.0.0.1", "localhost"));
  } else if (primaryBase.includes("localhost")) {
    candidateBases.push(primaryBase.replace("localhost", "127.0.0.1"));
  }

  let lastErr: Error | null = null;
  for (const base of candidateBases) {
    try {
      const res = await fetch(`${base}${pathAndQuery}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-sezsec-bridge-key": getBridgeSecretKey(),
          "x-sezsec-source": "sezsecnew-3334",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) {
        lastErr = new Error(
          `Inventory bridge ${base}${pathAndQuery} returned HTTP ${res.status}`
        );
        continue;
      }
      const json = (await res.json()) as T;
      return { data: json, baseUrl: base };
    } catch (err) {
      lastErr =
        err instanceof Error
          ? err
          : new Error(`Unreachable loopback at ${base}`);
    }
  }

  throw (
    lastErr ||
    new Error(`Inventory App loopback unreachable at ${primaryBase}`)
  );
}

async function readSnapshotFromSiblingSqlite(
  sqlitePath: string
): Promise<InventoryBootstrapSnapshot> {
  return withReadOnlyInventorySqlite(sqlitePath, (sqlite, existingTables) => {
    const selectAll = (table: string): RawRow[] => {
      if (!existingTables.has(table)) return [];
      return sqlite.prepare(`SELECT * FROM "${table}"`).all() as RawRow[];
    };

    const rawFloors = selectAll("floor_configs");
    const floorIdSet = new Set(rawFloors.map((f) => String(f.id)));
    const headsJoin = selectAll("_FloorHeads");
    const subHeadsJoin = selectAll("_FloorSubHeads");
    const membersJoin = selectAll("_FloorMembers");

    const extractJoinUsers = (floorId: string, joinRows: RawRow[]): string[] => {
      const out = new Set<string>();
      for (const j of joinRows) {
        const a = String(j.A ?? "");
        const b = String(j.B ?? "");
        if (a === floorId && b) {
          out.add(b);
        } else if (b === floorId && a && !floorIdSet.has(a)) {
          out.add(a);
        }
      }
      return [...out];
    };

    const floorConfigs: UnifiedFloorSnapshot[] = rawFloors.map((fc) => ({
      id: String(fc.id),
      name: String(fc.name),
      createdAt: fc.createdAt,
      updatedAt: fc.updatedAt,
      headIds: extractJoinUsers(String(fc.id), headsJoin),
      subHeadIds: extractJoinUsers(String(fc.id), subHeadsJoin),
      memberIds: extractJoinUsers(String(fc.id), membersJoin),
    }));

    const eventsMap = new Map<
      string,
      {
        title: string;
        occasionDate: unknown;
        occasionTime: string | null;
        eventType: string | null;
      }
    >();
    if (existingTables.has("events")) {
      const evRows = sqlite
        .prepare(
          `SELECT id, name, description, occasionDate, occasionTime, eventType FROM "events"`
        )
        .all() as RawRow[];
      for (const ev of evRows) {
        eventsMap.set(String(ev.id), {
          title: String(ev.description || ev.name || "Jamaat Miqaat"),
          occasionDate: ev.occasionDate,
          occasionTime: ev.occasionTime
            ? formatTimeDisplay(String(ev.occasionTime))
            : null,
          eventType: ev.eventType ? String(ev.eventType) : null,
        });
      }
    }

    const rawClones = selectAll("attendance_event_clones");
    const attendanceEventClones: UnifiedAttendanceCloneSnapshot[] =
      rawClones.map((aec) => {
        const meta = eventsMap.get(String(aec.eventId));
        return {
          id: String(aec.id),
          eventId: String(aec.eventId),
          isActive: aec.isActive,
          startTime: aec.startTime,
          endTime: aec.endTime,
          createdAt: aec.createdAt,
          eventTitle: meta?.title ?? null,
          eventDate: meta?.occasionDate ?? null,
          eventTime: meta?.occasionTime ?? null,
          eventType: meta?.eventType ?? null,
        };
      });

    const rawHalls = selectAll("halls");

    return {
      modules: selectAll("modules"),
      moduleLinks: selectAll("module_links"),
      users: selectAll("users"),
      userModuleAccess: selectAll("user_module_access"),
      halls: rawHalls.map((h) => ({
        id: String(h.id),
        name: String(h.name || ""),
      })),
      khidmatRequests: selectAll("khidmat_requests"),
      memberRegistrations: selectAll("member_registrations"),
      blogs: selectAll("blogs"),
      banners: selectAll("banners"),
      userFeeConfigs: selectAll("user_fee_configs"),
      feeRecords: selectAll("fee_records"),
      feeTransactions: selectAll("fee_transactions"),
      eventContributions: selectAll("event_contributions"),
      feeTransactionAllocations: selectAll("fee_transaction_allocations"),
      floorConfigs,
      attendanceRecords: selectAll("attendance_records"),
      attendanceEventClones,
    };
  });
}

async function loadInventoryBootstrapSnapshot(): Promise<{
  sourceMode: Exclude<InventorySyncSourceMode, "unavailable">;
  sourceLabel: string;
  snapshot: InventoryBootstrapSnapshot;
}> {
  // Primary Path: Internal Loopback HTTP Bridge to sezinv (127.0.0.1:3333)
  let bridgeError: string | null = null;
  try {
    const { data, baseUrl } = await fetchInventoryBridgeJson<{
      ok?: boolean;
      snapshot?: InventoryBootstrapSnapshot;
    }>("/api/bridge/bootstrap");
    if (data?.snapshot) {
      return {
        sourceMode: "loopback-bridge",
        sourceLabel: `${baseUrl}/api/bridge/bootstrap`,
        snapshot: data.snapshot,
      };
    }
  } catch (err) {
    bridgeError = err instanceof Error ? err.message : String(err);
  }

  // Automatic Offline / Pre-Start Fallback: Direct read-only sibling Inventory SQLite DB (../sezinv/data/jamatevents.db)
  const siblingDbPath = resolveSiblingInventorySqlitePath();
  if (siblingDbPath) {
    const snapshot = await readSnapshotFromSiblingSqlite(siblingDbPath);
    return {
      sourceMode: "sibling-sqlite",
      sourceLabel: siblingDbPath,
      snapshot,
    };
  }

  throw new Error(
    `Could not reach Inventory App (sezinv) over loopback (${bridgeError || "offline"}) and no sibling jamatevents.db found.`
  );
}

export async function inspectInventoryVsPortalCounts(): Promise<MigrationPreviewReport> {
  const sqliteCounts = await Promise.all(
    TABLE_DEFINITIONS.map((t) => t.countSqlite())
  );

  // Try fast ?mode=counts over loopback bridge first
  try {
    const { data, baseUrl } = await fetchInventoryBridgeJson<{
      ok?: boolean;
      counts?: Record<string, number>;
    }>("/api/bridge/bootstrap?mode=counts");
    if (data?.counts) {
      const counts = data.counts;
      const tables: MigrationTableCount[] = TABLE_DEFINITIONS.map(
        (def, idx) => ({
          table: def.table,
          label: def.label,
          group: def.group,
          inventoryCount: counts[def.table] ?? 0,
          sqliteCount: sqliteCounts[idx],
        })
      );
      return {
        inventoryReachable: true,
        sourceMode: "loopback-bridge",
        sourceLabel: `${baseUrl}/api/bridge/bootstrap`,
        tables,
        totalInventoryRows: tables.reduce((a, b) => a + b.inventoryCount, 0),
        totalSqliteRows: sqliteCounts.reduce((a, b) => a + b, 0),
      };
    }
  } catch {
    // Fallback to sibling SQLite check below
  }

  const siblingDbPath = resolveSiblingInventorySqlitePath();
  if (siblingDbPath) {
    try {
      const counts = await withReadOnlyInventorySqlite(
        siblingDbPath,
        (sqlite, existingTables) => {
          const out: Record<string, number> = {};
          for (const def of TABLE_DEFINITIONS) {
            if (!existingTables.has(def.table)) {
              out[def.table] = 0;
              continue;
            }
            const row = sqlite
              .prepare(`SELECT COUNT(*) AS cnt FROM "${def.table}"`)
              .get() as { cnt?: number } | undefined;
            out[def.table] = Number(row?.cnt ?? 0);
          }
          return out;
        }
      );

      const tables: MigrationTableCount[] = TABLE_DEFINITIONS.map(
        (def, idx) => ({
          table: def.table,
          label: def.label,
          group: def.group,
          inventoryCount: counts[def.table] ?? 0,
          sqliteCount: sqliteCounts[idx],
        })
      );

      return {
        inventoryReachable: true,
        sourceMode: "sibling-sqlite",
        sourceLabel: siblingDbPath,
        tables,
        totalInventoryRows: tables.reduce((a, b) => a + b.inventoryCount, 0),
        totalSqliteRows: sqliteCounts.reduce((a, b) => a + b, 0),
      };
    } catch (err) {
      const tables: MigrationTableCount[] = TABLE_DEFINITIONS.map(
        (def, idx) => ({
          table: def.table,
          label: def.label,
          group: def.group,
          inventoryCount: 0,
          sqliteCount: sqliteCounts[idx],
        })
      );
      return {
        inventoryReachable: false,
        sourceMode: "unavailable",
        sourceLabel: siblingDbPath,
        error:
          err instanceof Error
            ? err.message
            : "Could not inspect sibling Inventory SQLite database.",
        tables,
        totalInventoryRows: 0,
        totalSqliteRows: sqliteCounts.reduce((a, b) => a + b, 0),
      };
    }
  }

  const targetUrl = await getInternalJamateventsUrl();
  const tables: MigrationTableCount[] = TABLE_DEFINITIONS.map((def, idx) => ({
    table: def.table,
    label: def.label,
    group: def.group,
    inventoryCount: 0,
    sqliteCount: sqliteCounts[idx],
  }));

  return {
    inventoryReachable: false,
    sourceMode: "unavailable",
    sourceLabel: targetUrl,
    error: `Inventory App (sezinv) is not reachable at ${targetUrl} and no sibling jamatevents.db was found.`,
    tables,
    totalInventoryRows: 0,
    totalSqliteRows: sqliteCounts.reduce((a, b) => a + b, 0),
  };
}

export async function syncPortalDataFromInventory(params: {
  actor: { id: string; name: string };
}): Promise<MigrationRunResult> {
  const startedAt = performance.now();
  const importedByTable: Record<string, number> = {};
  const warnings: string[] = [];
  let hallsProvisioned = 0;

  const { sourceMode, sourceLabel, snapshot } =
    await loadInventoryBootstrapSnapshot();

  await withWriteLock(() =>
    db.$transaction(
      async (tx) => {
        // 1. Modules, Hall Modules & Module Links
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

        // Ensure canonical SEZSEC modules exist
        for (const defMod of DEFAULT_SEZSEC_MODULES) {
          const existingById = await tx.module.findUnique({
            where: { id: defMod.id },
            include: { links: true },
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
          } else if (
            existingById &&
            existingById.links.length === 0 &&
            defMod.links.length > 0
          ) {
            await tx.moduleLink.createMany({
              data: defMod.links.map((l) => ({
                moduleId: existingById.id,
                path: l.path,
                label: l.label,
                order: l.order,
              })),
            });
          }
        }

        // Provision hall-<slug> modules for every Hall in the Inventory App
        for (const h of snapshot.halls || []) {
          const cleanName = String(h.name || "").trim();
          if (!cleanName) continue;
          const hallModId = getHallModuleId(cleanName);
          const hallModName = `Hall Thaal Entry: ${cleanName}`;
          const byId = await tx.module.findUnique({ where: { id: hallModId } });
          const byName = await tx.module.findUnique({
            where: { name: hallModName },
          });
          if (!byId && !byName) {
            await tx.module.create({
              data: {
                id: hallModId,
                name: hallModName,
                description: `Allows entering actual thaals served for ${cleanName} on /menu`,
                icon: "Utensils",
              },
            });
            moduleIdMap.set(hallModId, hallModId);
            hallsProvisioned += 1;
          } else if (byId) {
            moduleIdMap.set(hallModId, byId.id);
          } else if (byName) {
            moduleIdMap.set(hallModId, byName.id);
          }
        }

        importedByTable.modules = snapshot.modules.length + hallsProvisioned;

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
          const mid =
            moduleIdMap.get(uma.moduleId) ||
            (await tx.module
              .findUnique({
                where: { id: String(uma.moduleId) },
                select: { id: true },
              })
              .then((r) => r?.id));
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

        // Ensure ADMIN users always hold event_charges permission
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
              isActive: coerceBoolean(bn.isActive),
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
              isActive: coerceBoolean(bn.isActive),
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
          const mapUserIdList = (ids?: string[]) => {
            const unique = new Set<string>();
            for (const rawId of ids || []) {
              const mapped = userIdMap.get(String(rawId));
              if (mapped) unique.add(mapped);
            }
            return [...unique].map((id) => ({ id }));
          };

          const headIds = mapUserIdList(fc.headIds);
          const subHeadIds = mapUserIdList(fc.subHeadIds);
          const memberIds = mapUserIdList(fc.memberIds);

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
          const evDate = toNullableDate(aec.eventDate);
          await tx.attendanceEventClone.upsert({
            where: { eventId: String(aec.eventId) },
            update: {
              isActive: coerceBoolean(aec.isActive),
              startTime: toDate(aec.startTime),
              endTime: toDate(aec.endTime),
              ...(aec.eventTitle ? { eventTitle: aec.eventTitle } : {}),
              ...(evDate ? { eventDate: evDate } : {}),
              ...(aec.eventTime ? { eventTime: aec.eventTime } : {}),
              ...(aec.eventType ? { eventType: aec.eventType } : {}),
            },
            create: {
              id: aec.id,
              eventId: String(aec.eventId),
              eventTitle: aec.eventTitle ?? null,
              eventDate: evDate,
              eventTime: aec.eventTime ?? null,
              eventType: aec.eventType ?? null,
              isActive: coerceBoolean(aec.isActive),
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
    action: "INVENTORY_SYNC_COMPLETED",
    summary: `Synced ${totalImported} records from Inventory App (${sourceMode}) in ${(durationMs / 1000).toFixed(1)}s`,
    userId: params.actor.id,
    userName: params.actor.name,
    details: {
      sourceMode,
      sourceLabel,
      totalImported,
      hallsProvisioned,
      durationMs,
      importedByTable,
    },
  });

  return {
    ok: true,
    sourceMode,
    sourceLabel,
    durationMs,
    importedByTable,
    totalImported,
    hallsProvisioned,
    warnings,
  };
}

export async function syncInitialPortalDataIfEmpty(options?: {
  force?: boolean;
}): Promise<{
  synced: boolean;
  sourceMode?: InventorySyncSourceMode;
  sourceLabel?: string;
  totalImported: number;
  usersSynced: number;
  hallsProvisioned: number;
  durationMs: number;
}> {
  const userCount = await db.user.count();
  if (userCount > 0 && !options?.force) {
    return {
      synced: false,
      totalImported: 0,
      usersSynced: userCount,
      hallsProvisioned: 0,
      durationMs: 0,
    };
  }

  const res = await syncPortalDataFromInventory({
    actor: { id: "system", name: "Inventory App Sanction" },
  });

  return {
    synced: true,
    sourceMode: res.sourceMode,
    sourceLabel: res.sourceLabel,
    totalImported: res.totalImported,
    usersSynced: res.importedByTable.users ?? 0,
    hallsProvisioned: res.hallsProvisioned,
    durationMs: res.durationMs,
  };
}
