import crypto from "node:crypto";
import { NextResponse } from "next/server";
import type { Role } from "@/generated/prisma/client";
import { db, withWriteLock } from "@sezsec/db";
import { getPortalRuntimeConfig } from "@sezsec/notifications";
import {
  EVENT_CHARGES_MODULE_ID,
  UPDATE_THAAL_COUNT_MODULE_ID,
  VIEW_PRIVATE_EVENTS_MODULE_ID,
} from "@sezsec/rbac/rbac.constants";
import { getHallModuleId } from "@sezsec/shared";
import type {
  BridgeConnectionHealth,
  BridgeEvent,
  BridgeHall,
  BridgeInventoryItem,
} from "./bridge.types";

const DEFAULT_BRIDGE_KEY = "sezsec-internal-bridge-key-2026";

export function getBridgeSecretKey(): string {
  return (process.env.SEZSEC_BRIDGE_KEY || DEFAULT_BRIDGE_KEY).trim();
}

export async function getInternalJamateventsUrl(): Promise<string> {
  try {
    const cfg = await getPortalRuntimeConfig();
    if (cfg.jamateventsInternalUrl) {
      return cfg.jamateventsInternalUrl;
    }
  } catch {
    // Fallback to env if DB not initialized yet
  }
  const raw =
    process.env.JAMATEVENTS_INTERNAL_URL ||
    process.env.JAMATEVENTS_API_URL ||
    "http://127.0.0.1:3333";
  return raw.trim().replace(/\/+$/, "");
}

export function getPublicJamateventsUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_JAMATEVENTS_URL ||
    process.env.JAMATEVENTS_API_URL ||
    "http://localhost:3333";
  return raw.trim().replace(/\/+$/, "");
}

function getBridgeHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-sezsec-bridge-key": getBridgeSecretKey(),
    "x-sezsec-source": "sezsecnew-3334",
  };
}

/**
 * Resilient internal loopback fetch to jamatevents (:3333).
 * Automatically falls back between 127.0.0.1 and localhost if OS dual-stack
 * binds IPv6 (::1) or IPv4 exclusively.
 */
async function loopbackFetchJamatevents(
  pathAndQuery: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<Response> {
  const primaryBase = await getInternalJamateventsUrl();
  const timeoutMs = init?.timeoutMs ?? 8000;
  const candidateBases = [primaryBase];

  if (primaryBase.includes("127.0.0.1")) {
    candidateBases.push(primaryBase.replace("127.0.0.1", "localhost"));
  } else if (primaryBase.includes("localhost")) {
    candidateBases.push(primaryBase.replace("localhost", "127.0.0.1"));
  }

  let lastError: unknown = null;
  for (const base of candidateBases) {
    try {
      return await fetch(`${base}${pathAndQuery}`, {
        ...init,
        headers: {
          ...getBridgeHeaders(),
          ...(init?.headers || {}),
        },
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Jamatevents loopback unreachable at ${primaryBase}`);
}

/**
 * Verifies inbound server-to-server bridge calls to sezsecnew (/api/bridge/*)
 * using constant-time key comparison.
 */
export function verifyBridgeRequest(
  request: Request
): { ok: true } | { ok: false; response: NextResponse } {
  const expectedKey = getBridgeSecretKey();
  const providedKey = (
    request.headers.get("x-sezsec-bridge-key") || ""
  ).trim();

  if (!providedKey) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Missing bridge authentication key." },
        { status: 401 }
      ),
    };
  }

  const a = Buffer.from(expectedKey, "utf8");
  const b = Buffer.from(providedKey, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid bridge authentication key." },
        { status: 403 }
      ),
    };
  }

  return { ok: true };
}

function hydrateBridgeEvent(raw: Record<string, unknown>): BridgeEvent {
  const hallRaw = raw.hall;
  const hall = Array.isArray(hallRaw) ? hallRaw.map(String) : [];
  const hallCountsRaw = raw.hallCounts;
  const hallCounts =
    hallCountsRaw &&
    typeof hallCountsRaw === "object" &&
    !Array.isArray(hallCountsRaw)
      ? (hallCountsRaw as Record<string, number>)
      : null;

  return {
    id: String(raw.id ?? ""),
    reference: raw.reference ? String(raw.reference) : null,
    name: String(raw.name ?? ""),
    mobile: String(raw.mobile ?? ""),
    email: raw.email ? String(raw.email) : null,
    occasionDate: new Date(String(raw.occasionDate)),
    occasionDay: raw.occasionDay ? String(raw.occasionDay) : null,
    occasionTime: String(raw.occasionTime ?? "07:30 PM"),
    description: String(raw.description ?? ""),
    hall,
    catererName: String(raw.catererName ?? ""),
    catererPhone: String(raw.catererPhone ?? ""),
    decoratorName: raw.decoratorName ? String(raw.decoratorName) : null,
    decoratorPhone: raw.decoratorPhone ? String(raw.decoratorPhone) : null,
    thaalCount: Number(raw.thaalCount ?? 0),
    totalThaalsDone:
      raw.totalThaalsDone === null || raw.totalThaalsDone === undefined
        ? null
        : Number(raw.totalThaalsDone),
    sarkariThaalSet: Number(raw.sarkariThaalSet ?? 0),
    bhaiSaabIzzan: Boolean(raw.bhaiSaabIzzan),
    muraqebeenIzzan: Boolean(raw.muraqebeenIzzan),
    benSaabIzzan: Boolean(raw.benSaabIzzan),
    extraChilamchiLota: Number(raw.extraChilamchiLota ?? 0),
    tablesAndChairs: Number(raw.tablesAndChairs ?? 0),
    mic: Boolean(raw.mic),
    crockeryRequired: Boolean(raw.crockeryRequired),
    thaalForDevri: Boolean(raw.thaalForDevri),
    paat: Boolean(raw.paat),
    masjidLight: Boolean(raw.masjidLight),
    crockeryStatus:
      (raw.crockeryStatus as "PENDING" | "NOT_REQUIRED" | "COMPLETED") ||
      "NOT_REQUIRED",
    acStartTime: raw.acStartTime ? String(raw.acStartTime) : null,
    partyTime: raw.partyTime ? String(raw.partyTime) : null,
    decorations: Boolean(raw.decorations),
    gasCount:
      raw.gasCount === null || raw.gasCount === undefined
        ? null
        : Number(raw.gasCount),
    menu: raw.menu ? String(raw.menu) : null,
    status:
      (raw.status as "BOOKED" | "CANCELLED" | "COMPLETED") || "BOOKED",
    eventType: (raw.eventType as "PUBLIC" | "PRIVATE") || "PRIVATE",
    hallCounts,
    razaGranted: Boolean(raw.razaGranted),
    createdAt: raw.createdAt ? new Date(String(raw.createdAt)) : new Date(),
    updatedAt: raw.updatedAt ? new Date(String(raw.updatedAt)) : new Date(),
  };
}

export function parseEventTimeString(
  timeStr?: string | null
): { hours: number; minutes: number } {
  if (!timeStr) return { hours: 19, minutes: 30 };
  const trimmed = timeStr.trim();

  const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = parseInt(ampmMatch[2], 10);
    const period = ampmMatch[3].toUpperCase();
    if (period === "PM" && hours !== 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
    return { hours, minutes };
  }

  const twentyFourMatch = trimmed.match(/^(\d{1,2}):(\d{2})/);
  if (twentyFourMatch) {
    return {
      hours: parseInt(twentyFourMatch[1], 10) || 0,
      minutes: parseInt(twentyFourMatch[2], 10) || 0,
    };
  }

  return { hours: 19, minutes: 30 };
}

export async function fetchBridgeEvents(params?: {
  types?: Array<"PUBLIC" | "PRIVATE" | string>;
  excludeCancelled?: boolean;
  from?: Date | string;
  to?: Date | string;
  hasMenu?: boolean;
  ids?: string[];
  limit?: number;
  order?: "asc" | "desc";
}): Promise<BridgeEvent[]> {
  const search = new URLSearchParams();
  if (params?.types && params.types.length > 0) {
    search.set("types", params.types.join(","));
  }
  if (params?.excludeCancelled) {
    search.set("excludeCancelled", "true");
  }
  if (params?.from) {
    search.set(
      "from",
      params.from instanceof Date ? params.from.toISOString() : params.from
    );
  }
  if (params?.to) {
    search.set(
      "to",
      params.to instanceof Date ? params.to.toISOString() : params.to
    );
  }
  if (params?.hasMenu) {
    search.set("hasMenu", "true");
  }
  if (params?.ids && params.ids.length > 0) {
    search.set("ids", params.ids.join(","));
  }
  if (params?.limit) {
    search.set("limit", String(params.limit));
  }
  if (params?.order) {
    search.set("order", params.order);
  }

  const qs = search.toString();
  const res = await loopbackFetchJamatevents(
    `/api/bridge/events${qs ? `?${qs}` : ""}`,
    { method: "GET" }
  );

  if (!res.ok) {
    throw new Error(`Internal bridge /events returned ${res.status}`);
  }

  const data = (await res.json()) as { events?: Record<string, unknown>[] };
  return Array.isArray(data?.events)
    ? data.events.map(hydrateBridgeEvent)
    : [];
}

export async function fetchBridgeEventById(
  id: string
): Promise<BridgeEvent | null> {
  const res = await loopbackFetchJamatevents(
    `/api/bridge/events/${encodeURIComponent(id)}`,
    { method: "GET" }
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Internal bridge /events/${id} returned ${res.status}`);
  }
  const data = (await res.json()) as { event?: Record<string, unknown> };
  return data?.event ? hydrateBridgeEvent(data.event) : null;
}

export async function fetchBridgeMenu(
  mode: "today" | "upcoming"
): Promise<BridgeEvent | null> {
  const res = await loopbackFetchJamatevents(
    `/api/bridge/menu?mode=${encodeURIComponent(mode)}`,
    { method: "GET" }
  );

  if (!res.ok) {
    throw new Error(`Internal bridge /menu returned ${res.status}`);
  }

  const data = (await res.json()) as { event?: Record<string, unknown> | null };
  return data?.event ? hydrateBridgeEvent(data.event) : null;
}

export async function updateBridgeEventThaals(
  eventId: string,
  payload: {
    hallCounts?: Record<string, number>;
    totalOverride?: number;
    actorId?: string;
    actorName?: string;
  }
): Promise<{ ok: true; event: BridgeEvent } | { ok: false; error: string }> {
  const res = await loopbackFetchJamatevents(
    `/api/bridge/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  );

  const data = (await res.json().catch(() => ({}))) as {
    event?: Record<string, unknown>;
    error?: string;
  };
  if (!res.ok || !data.event) {
    return {
      ok: false,
      error:
        data?.error || "Failed to update thaal count on Jamaat Events service.",
    };
  }

  return {
    ok: true,
    event: hydrateBridgeEvent(data.event),
  };
}

export async function deleteBridgeEvent(
  eventId: string,
  actor?: { actorId?: string; actorName?: string }
): Promise<boolean> {
  const res = await loopbackFetchJamatevents(
    `/api/bridge/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      body: JSON.stringify(actor || {}),
    }
  );
  return res.ok;
}

export async function fetchBridgeHalls(): Promise<BridgeHall[]> {
  const res = await loopbackFetchJamatevents("/api/bridge/halls", {
    method: "GET",
  });

  if (!res.ok) {
    throw new Error(`Internal bridge /halls returned ${res.status}`);
  }

  const data = (await res.json()) as { halls?: BridgeHall[] };
  return Array.isArray(data?.halls) ? data.halls : [];
}

export async function fetchBridgeInventory(): Promise<BridgeInventoryItem[]> {
  const res = await loopbackFetchJamatevents("/api/bridge/inventory", {
    method: "GET",
  });

  if (!res.ok) {
    throw new Error(`Internal bridge /inventory returned ${res.status}`);
  }

  const data = (await res.json()) as { items?: BridgeInventoryItem[] };
  return Array.isArray(data?.items) ? data.items : [];
}

export async function pingJamateventsBridge(): Promise<BridgeConnectionHealth> {
  const targetUrl = await getInternalJamateventsUrl();
  const started = performance.now();
  try {
    const res = await loopbackFetchJamatevents("/api/bridge/health", {
      method: "GET",
      timeoutMs: 4000,
    });
    const latencyMs = Math.round((performance.now() - started) * 100) / 100;
    if (!res.ok) {
      return {
        reachable: false,
        targetUrl,
        latencyMs,
        error: `HTTP ${res.status} (${res.statusText || "Bridge auth or endpoint error"})`,
      };
    }
    const data = (await res.json()) as {
      hallsCount?: number;
      eventsCount?: number;
    };
    return {
      reachable: true,
      targetUrl,
      latencyMs,
      hallCount: typeof data.hallsCount === "number" ? data.hallsCount : 0,
    };
  } catch (err) {
    return {
      reachable: false,
      targetUrl,
      latencyMs: null,
      error:
        err instanceof Error ? err.message : "Loopback connection refused",
    };
  }
}

/**
 * Best-effort internal loopback push to sync updated user credentials/modules
 * directly into sezinv (jamatevents :3333) when running side-by-side.
 */
export async function pushUserSyncToJamatevents(payload: {
  action: "UPSERT" | "DELETE";
  userId: string;
  user?: {
    id: string;
    username: string;
    password: string;
    name: string | null;
    email: string | null;
    mobile: string | null;
    its: string | null;
    role: string;
    moduleIds?: string[];
    modules?: Array<{
      id: string;
      name: string;
      description: string | null;
      icon: string | null;
    }>;
  };
}): Promise<void> {
  try {
    await loopbackFetchJamatevents("/api/bridge/users/sync", {
      method: "POST",
      body: JSON.stringify(payload),
      timeoutMs: 3500,
    });
  } catch {
    // Non-blocking: sezsecnew succeeds even if sezinv is restarting
  }
}

export async function syncUserByIdToJamatevents(userId: string): Promise<void> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        moduleAccess: {
          include: { module: true },
        },
      },
    });
    if (!user) return;
    await pushUserSyncToJamatevents({
      action: "UPSERT",
      userId: user.id,
      user: {
        id: user.id,
        username: user.username,
        password: user.password,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        its: user.its,
        role: user.role,
        moduleIds: user.moduleAccess.map((m) => m.moduleId),
        modules: user.moduleAccess.map((m) => ({
          id: m.module.id,
          name: m.module.name,
          description: m.module.description,
          icon: m.module.icon,
        })),
      },
    });
  } catch {
    // Non-blocking
  }
}

const VALID_PORTAL_ROLES = new Set<Role>([
  "ADMIN",
  "ADMIN_CUSTOM",
  "MANAGER",
  "STAFF",
  "WATCHER",
  "USER",
]);

/**
 * Inbound sync handler when jamatevents (:3333) creates/updates/deletes a user
 * or changes password / event_charges permission, keeping sezsecnew (:3334) 100% consistent.
 */
export async function syncInboundBridgeUser(payload: {
  action: "UPSERT" | "DELETE";
  userId: string;
  username?: string;
  user?: {
    id: string;
    username: string;
    password: string;
    name: string | null;
    email: string | null;
    mobile: string | null;
    its: string | null;
    role: string;
    moduleIds?: string[];
  };
}): Promise<{ ok: true }> {
  await withWriteLock(() =>
    db.$transaction(async (tx) => {
      if (payload.action === "DELETE") {
        const existing = await tx.user.findFirst({
          where: {
            OR: [
              { id: payload.userId },
              ...(payload.username ? [{ username: payload.username }] : []),
              ...(payload.user?.username
                ? [{ username: payload.user.username }]
                : []),
            ],
          },
          select: { id: true },
        });
        if (existing) {
          await tx.user.delete({ where: { id: existing.id } });
        }
        return;
      }

      const u = payload.user;
      if (!u || !u.username) return;

      const safeRole: Role = VALID_PORTAL_ROLES.has(u.role as Role)
        ? (u.role as Role)
        : "USER";

      const cleanIts = u.its?.trim() || null;
      const byId = await tx.user.findUnique({ where: { id: u.id } });
      const byUsername = await tx.user.findUnique({
        where: { username: u.username },
      });
      const byIts = cleanIts
        ? await tx.user.findUnique({ where: { its: cleanIts } })
        : null;

      const target = byId || byUsername || byIts;
      const safeIts =
        cleanIts && (!byIts || (target && byIts.id === target.id))
          ? cleanIts
          : null;

      let localUserId: string;
      if (target) {
        const canUpdateUsername = !byUsername || byUsername.id === target.id;
        const updated = await tx.user.update({
          where: { id: target.id },
          data: {
            ...(canUpdateUsername ? { username: u.username } : {}),
            ...(u.password ? { password: u.password } : {}),
            name: u.name,
            email: u.email,
            mobile: u.mobile,
            its: safeIts,
            role: safeRole,
          },
        });
        localUserId = updated.id;
      } else {
        const created = await tx.user.create({
          data: {
            id: u.id,
            username: u.username,
            password: u.password,
            name: u.name,
            email: u.email,
            mobile: u.mobile,
            its: safeIts,
            role: safeRole,
          },
        });
        localUserId = created.id;
      }

      // Sync shared cross-portal module permissions (event_charges, hall-*, etc.)
      // while preserving sezsecnew-specific modules (fees, attendance, blogs, etc.).
      if (Array.isArray(u.moduleIds)) {
        const sharedIds = u.moduleIds.filter(
          (id) =>
            id === EVENT_CHARGES_MODULE_ID ||
            id.startsWith("hall-") ||
            id === VIEW_PRIVATE_EVENTS_MODULE_ID ||
            id === UPDATE_THAAL_COUNT_MODULE_ID
        );

        await tx.userModuleAccess.deleteMany({
          where: {
            userId: localUserId,
            OR: [
              { moduleId: EVENT_CHARGES_MODULE_ID },
              { moduleId: { startsWith: "hall-" } },
              { moduleId: VIEW_PRIVATE_EVENTS_MODULE_ID },
              { moduleId: UPDATE_THAAL_COUNT_MODULE_ID },
            ],
          },
        });

        for (const modId of sharedIds) {
          const exists = await tx.module.findUnique({ where: { id: modId } });
          if (exists) {
            await tx.userModuleAccess.upsert({
              where: {
                userId_moduleId: {
                  userId: localUserId,
                  moduleId: modId,
                },
              },
              update: {},
              create: {
                userId: localUserId,
                moduleId: modId,
              },
            });
          }
        }
      }
    })
  );

  return { ok: true };
}

/**
 * Inbound sync handler when jamatevents (:3333) adds or updates halls/venues,
 * auto-provisioning hall-<slug> RBAC modules on sezsecnew (:3334).
 */
export async function syncInboundBridgeHalls(
  halls: Array<{ id?: string; name: string }>
): Promise<{ ok: true; syncedCount: number }> {
  let syncedCount = 0;
  await withWriteLock(async () => {
    for (const h of halls) {
      const cleanName = String(h.name || "").trim();
      if (!cleanName) continue;
      const moduleId = getHallModuleId(cleanName);
      const moduleName = `Hall Thaal Entry: ${cleanName}`;
      const byId = await db.module.findUnique({ where: { id: moduleId } });
      const byName = await db.module.findUnique({
        where: { name: moduleName },
      });
      if (!byId && !byName) {
        await db.module.create({
          data: {
            id: moduleId,
            name: moduleName,
            description: `Allows entering actual thaals served for ${cleanName} on /menu`,
            icon: "Utensils",
          },
        });
        syncedCount += 1;
      }
    }
  });
  return { ok: true, syncedCount };
}

/**
 * Inbound sync handler when jamatevents (:3333) updates or deletes an Event,
 * keeping any AttendanceEventClone snapshot in sezsecnew (:3334) up to date.
 */
export async function syncInboundBridgeEventSnapshot(payload: {
  action: "UPSERT" | "DELETE";
  eventId: string;
  event?: {
    title?: string;
    occasionDate?: string;
    occasionTime?: string;
    eventType?: string;
    status?: string;
  };
}): Promise<{ ok: true }> {
  await withWriteLock(async () => {
    const clone = await db.attendanceEventClone.findUnique({
      where: { eventId: payload.eventId },
    });
    if (!clone) return;

    if (payload.action === "DELETE" || payload.event?.status === "CANCELLED") {
      await db.attendanceEventClone.update({
        where: { eventId: payload.eventId },
        data: { isActive: false },
      });
      return;
    }

    if (payload.event) {
      await db.attendanceEventClone.update({
        where: { eventId: payload.eventId },
        data: {
          ...(payload.event.title ? { eventTitle: payload.event.title } : {}),
          ...(payload.event.occasionDate
            ? { eventDate: new Date(payload.event.occasionDate) }
            : {}),
          ...(payload.event.occasionTime
            ? { eventTime: payload.event.occasionTime }
            : {}),
          ...(payload.event.eventType
            ? { eventType: payload.event.eventType }
            : {}),
        },
      });
    }
  });

  return { ok: true };
}
