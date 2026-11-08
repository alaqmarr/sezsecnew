import { connection } from "next/server";
import { AlertTriangle } from "lucide-react";
import { getCurrentSessionUser } from "@sezsec/auth";
import { fetchBridgeEvents } from "@sezsec/bridge";
import { VIEW_PRIVATE_EVENTS_MODULE_ID } from "@sezsec/rbac/rbac.constants";
import { formatIST, getISTTodayString } from "@sezsec/shared";
import { PageHeader } from "@sezsec/ui";
import {
  EventsCalendarClient,
  type CalendarEventItem,
} from "./events-calendar-client";

export default async function PublicEventsCalendarPage() {
  await connection();
  const user = await getCurrentSessionUser();
  const canSeePrivate = Boolean(
    user &&
      (user.role === "ADMIN" ||
        user.moduleIds.includes(VIEW_PRIVATE_EVENTS_MODULE_ID))
  );

  const bridgeRes = await fetchBridgeEvents({
    types: canSeePrivate ? ["PUBLIC", "PRIVATE"] : ["PUBLIC"],
    excludeCancelled: true,
    order: "asc",
    limit: 2000,
  })
    .then((items) => ({ items, offline: false }))
    .catch(() => ({ items: [], offline: true }));

  const rawEvents = bridgeRes.items;
  const bridgeOffline = bridgeRes.offline;

  const events: CalendarEventItem[] = rawEvents.map((ev) => ({
    id: ev.id,
    title: ev.description || ev.name,
    hostName: ev.name,
    dateKey: formatIST(ev.occasionDate, "yyyy-MM-dd"),
    occasionDateIso: ev.occasionDate.toISOString(),
    occasionTime: ev.occasionTime,
    halls: ev.hall,
    thaalCount: ev.thaalCount,
    totalThaalsDone: ev.totalThaalsDone,
    eventType: ev.eventType,
    hasMenu: Boolean(ev.menu && ev.menu.trim()),
  }));

  const todayIso = getISTTodayString();

  return (
    <div className="w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
      <PageHeader
        eyebrow="Fatimid Misri Hijri & Gregorian Schedule"
        title="Jamaat Miqaats & Events Calendar"
        subtitle={
          canSeePrivate
            ? "Showing both Public Jamaat Miqaats and Private Family Bookings (authorized view)."
            : "Showing Public Jamaat Miqaats synchronized live with Secunderabad Jamaat Hall Bookings."
        }
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
              Start the inventory portal on port 3333 so live Jamaat Miqaats and
              hall schedules load over the internal bridge.
            </p>
          </div>
        </div>
      ) : null}

      <EventsCalendarClient
        events={events}
        todayIso={todayIso}
        canSeePrivate={canSeePrivate}
      />
    </div>
  );
}
