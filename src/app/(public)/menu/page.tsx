import { connection } from "next/server";
import { AlertTriangle } from "lucide-react";
import { getCurrentSessionUser } from "@sezsec/auth";
import {
  fetchBridgeHalls,
  fetchBridgeMenu,
  syncInboundBridgeHalls,
} from "@sezsec/bridge";
import { UPDATE_THAAL_COUNT_MODULE_ID } from "@sezsec/rbac/rbac.constants";
import {
  formatIST,
  getHallModuleId,
  getISTTodayString,
  getMisriDate,
  parseISTEventDateTime,
} from "@sezsec/shared";
import { PageHeader } from "@sezsec/ui";
import { MenuThaalClient } from "./menu-thaal-client";

export default async function PublicMenuPage() {
  await connection();
  const [user, todayRes, upcomingRes, hallsRes] = await Promise.all([
    getCurrentSessionUser(),
    fetchBridgeMenu("today")
      .then((ev) => ({ ev, offline: false }))
      .catch(() => ({ ev: null, offline: true })),
    fetchBridgeMenu("upcoming")
      .then((ev) => ({ ev, offline: false }))
      .catch(() => ({ ev: null, offline: true })),
    fetchBridgeHalls()
      .then((list) => ({ list, offline: false }))
      .catch(() => ({ list: [], offline: true })),
  ]);

  const todayEvent = todayRes.ev;
  const upcomingEvent = upcomingRes.ev;
  const allHalls = hallsRes.list;
  const bridgeOffline =
    todayRes.offline || upcomingRes.offline || hallsRes.offline;

  if (allHalls.length > 0) {
    void syncInboundBridgeHalls(allHalls).catch(() => undefined);
  }

  const activeEvent = todayEvent || upcomingEvent;
  const todayIso = getISTTodayString();

  if (!activeEvent) {
    return (
      <div className="w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
        <PageHeader
          eyebrow="Niyaz & Jaman Service"
          title="Jaman Menu & Hall Thaal Counts"
          subtitle="Live menu & hall-wise thaal counter synchronized with Secunderabad Jamaat Bookings."
        />
        {bridgeOffline ? (
          <div className="flex items-start gap-3 rounded-2xl border border-[#D9A94E] bg-[#FDF8EC] px-4 py-3.5 text-sm text-[#5A3F0D]">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#B87A14]" />
            <div>
              <p className="font-semibold">
                Jamaat Events &amp; Inventory service (Port 3333) is currently
                offline.
              </p>
              <p className="mt-0.5 text-xs opacity-90">
                Start the inventory portal on port 3333 so live Jaman Menus and
                Thaal counts load automatically.
              </p>
            </div>
          </div>
        ) : null}
        <div className="jadwal-card rounded-2xl p-10 text-center">
          <p className="font-editorial text-2xl font-bold text-[#231917]">
            No Upcoming Menus Scheduled
          </p>
          <p className="mt-2 text-sm text-[#5E4F4A]">
            When a Public Miqaat menu is entered in Jamaat Bookings, it appears
            here automatically with hall allocations and countdown timing.
          </p>
        </div>
      </div>
    );
  }

  const eventDateTime = parseISTEventDateTime(
    activeEvent.occasionDate,
    activeEvent.occasionTime
  );
  // Reveal 30 minutes prior to event time
  const revealTimestampMs = eventDateTime.getTime() - 30 * 60_000;
  const misri = getMisriDate(activeEvent.occasionDate);

  const eventHalls =
    activeEvent.hall.length > 0
      ? activeEvent.hall
      : allHalls.map((h) => h.name);

  const isGlobalAllowed = Boolean(
    user &&
      (user.role === "ADMIN" ||
        user.moduleIds.includes(UPDATE_THAAL_COUNT_MODULE_ID))
  );

  const editableHalls = user
    ? eventHalls.filter(
        (h) => isGlobalAllowed || user.moduleIds.includes(getHallModuleId(h))
      )
    : [];

  return (
    <div className="w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
      <PageHeader
        eyebrow="Niyaz & Jaman Khidmat"
        title={activeEvent.description || activeEvent.name}
        subtitle={`${formatIST(activeEvent.occasionDate, "EEEE, dd MMMM yyyy")} • ${activeEvent.occasionTime} • ${misri.formattedEn}`}
      />

      <MenuThaalClient
        event={{
          id: activeEvent.id,
          title: activeEvent.description || activeEvent.name,
          dateFormatted: formatIST(
            activeEvent.occasionDate,
            "EEEE, dd MMMM yyyy"
          ),
          isToday:
            formatIST(activeEvent.occasionDate, "yyyy-MM-dd") === todayIso,
          occasionTime: activeEvent.occasionTime,
          misriEn: misri.formattedEn,
          misriAr: misri.formattedAr,
          menuText: activeEvent.menu || "",
          halls: eventHalls,
          expectedThaals: activeEvent.thaalCount,
          totalThaalsDone: activeEvent.totalThaalsDone,
          hallCounts: activeEvent.hallCounts || {},
          revealTimestampMs,
        }}
        canAdminOverrideTotal={user?.role === "ADMIN"}
        editableHalls={editableHalls}
        isSignedIn={Boolean(user)}
      />
    </div>
  );
}
