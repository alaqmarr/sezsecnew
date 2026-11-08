"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Users,
  Utensils,
} from "lucide-react";
import {
  cn,
  formatIST,
  getMisriDate,
  MONTH_NAMES_FULL,
} from "@sezsec/shared";
import { Badge, Button, Card, CardBody, CardHeader } from "@sezsec/ui";

export interface CalendarEventItem {
  id: string;
  title: string;
  hostName: string;
  dateKey: string; // yyyy-MM-dd IST
  occasionDateIso: string;
  occasionTime: string;
  halls: string[];
  thaalCount: number;
  totalThaalsDone: number | null;
  eventType: "PUBLIC" | "PRIVATE";
  hasMenu: boolean;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function EventsCalendarClient({
  events,
  todayIso,
  canSeePrivate,
}: {
  events: CalendarEventItem[];
  todayIso: string;
  canSeePrivate: boolean;
}) {
  const [initialYear, initialMonth] = todayIso.split("-").map(Number);
  const [viewYear, setViewYear] = useState(initialYear);
  const [viewMonth, setViewMonth] = useState(initialMonth - 1); // 0-11
  const [selectedDateKey, setSelectedDateKey] = useState(todayIso);
  const [typeFilter, setTypeFilter] = useState<"ALL" | "PUBLIC" | "PRIVATE">(
    "ALL"
  );

  const filteredEvents = useMemo(() => {
    if (typeFilter === "ALL") return events;
    return events.filter((e) => e.eventType === typeFilter);
  }, [events, typeFilter]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEventItem[]>();
    for (const ev of filteredEvents) {
      const list = map.get(ev.dateKey) || [];
      list.push(ev);
      map.set(ev.dateKey, list);
    }
    return map;
  }, [filteredEvents]);

  const calendarCells = useMemo(() => {
    const firstDayDow = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: Array<{
      dateKey: string;
      day: number;
      inCurrentMonth: boolean;
    }> = [];

    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
    for (let i = firstDayDow - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const dt = new Date(viewYear, viewMonth - 1, d);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, "0");
      const dd = String(dt.getDate()).padStart(2, "0");
      cells.push({ dateKey: `${y}-${m}-${dd}`, day: d, inCurrentMonth: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const m = String(viewMonth + 1).padStart(2, "0");
      const dd = String(d).padStart(2, "0");
      cells.push({
        dateKey: `${viewYear}-${m}-${dd}`,
        day: d,
        inCurrentMonth: true,
      });
    }

    const trailing = (7 - (cells.length % 7)) % 7;
    for (let d = 1; d <= trailing; d++) {
      const dt = new Date(viewYear, viewMonth + 1, d);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, "0");
      const dd = String(dt.getDate()).padStart(2, "0");
      cells.push({ dateKey: `${y}-${m}-${dd}`, day: d, inCurrentMonth: false });
    }

    return cells;
  }, [viewYear, viewMonth]);

  const firstOfMonthMisri = getMisriDate(
    `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-01`
  );
  const lastOfMonthMisri = getMisriDate(
    `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(
      new Date(viewYear, viewMonth + 1, 0).getDate()
    ).padStart(2, "0")}`
  );

  const selectedDayEvents = eventsByDate.get(selectedDateKey) || [];
  const selectedMisri = getMisriDate(selectedDateKey);

  const upcomingList = useMemo(
    () => filteredEvents.filter((e) => e.dateKey >= todayIso).slice(0, 8),
    [filteredEvents, todayIso]
  );

  const recentFallbackList = useMemo(
    () => [...filteredEvents].reverse().slice(0, 8),
    [filteredEvents]
  );

  const agendaList = upcomingList.length > 0 ? upcomingList : recentFallbackList;
  const isShowingRecentFallback =
    upcomingList.length === 0 && recentFallbackList.length > 0;

  function stepMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  function jumpToToday() {
    const [y, m] = todayIso.split("-").map(Number);
    setViewYear(y);
    setViewMonth(m - 1);
    setSelectedDateKey(todayIso);
  }

  return (
    <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-12">
      {/* Left 8 Columns: Full-Width Misri + Gregorian Grid */}
      <Card className="xl:col-span-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAE2D6] px-5 py-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="font-editorial text-2xl font-bold text-[#231917]">
                {MONTH_NAMES_FULL[viewMonth]} {viewYear}
              </h2>
              <Badge tone="brass">{filteredEvents.length} Synced</Badge>
            </div>
            <p className="text-xs text-[#6E5D55]">
              {firstOfMonthMisri.monthNameEn === lastOfMonthMisri.monthNameEn
                ? `${firstOfMonthMisri.monthNameEn} ${firstOfMonthMisri.year}H`
                : `${firstOfMonthMisri.monthNameEn} – ${lastOfMonthMisri.monthNameEn} ${lastOfMonthMisri.year}H`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canSeePrivate ? (
              <div className="inline-flex rounded-xl border border-[#DCD2C2] bg-[#FAF7F2] p-0.5 text-xs">
                {(["ALL", "PUBLIC", "PRIVATE"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setTypeFilter(mode)}
                    className={cn(
                      "rounded-lg px-2.5 py-1 font-semibold transition-colors cursor-pointer",
                      typeFilter === mode
                        ? "bg-[#6A1B1B] text-[#FAF7F2]"
                        : "text-[#5E4F4A] hover:text-[#231917]"
                    )}
                  >
                    {mode === "ALL"
                      ? "All"
                      : mode === "PUBLIC"
                        ? "Public"
                        : "Private"}
                  </button>
                ))}
              </div>
            ) : null}

            <Button variant="secondary" size="sm" onClick={jumpToToday}>
              Today
            </Button>
            <div className="inline-flex items-center gap-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => stepMonth(-1)}
                icon={<ChevronLeft className="h-4 w-4" />}
                aria-label="Previous month"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => stepMonth(1)}
                icon={<ChevronRight className="h-4 w-4" />}
                aria-label="Next month"
              />
            </div>
          </div>
        </div>

        <div className="p-3 sm:p-5">
          <div className="grid grid-cols-7 gap-1.5 pb-2 text-center text-[11px] font-bold uppercase tracking-wider text-[#7B6B63]">
            {WEEKDAYS.map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {calendarCells.map((cell) => {
              const misri = getMisriDate(cell.dateKey);
              const dayEvents = eventsByDate.get(cell.dateKey) || [];
              const isToday = cell.dateKey === todayIso;
              const isSelected = cell.dateKey === selectedDateKey;

              return (
                <button
                  key={cell.dateKey}
                  type="button"
                  onClick={() => setSelectedDateKey(cell.dateKey)}
                  className={cn(
                    "group flex min-h-[82px] flex-col justify-between rounded-xl border p-2 text-left transition-all sm:min-h-[104px] sm:p-2.5 cursor-pointer",
                    !cell.inCurrentMonth ? "opacity-45 bg-[#FAF7F2]/50" : "bg-white",
                    isSelected
                      ? "border-[#6A1B1B] ring-2 ring-[#6A1B1B]/15 bg-[#FBF6EB]/70"
                      : isToday
                        ? "border-[#B8924A] bg-[#FBF6EB]/40"
                        : "border-[#E5DDD0] hover:border-[#B8924A]"
                  )}
                >
                  <div className="flex w-full items-start justify-between gap-1">
                    <span
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded-lg text-xs font-bold tabular-nums",
                        isToday
                          ? "bg-[#6A1B1B] text-[#FAF7F2]"
                          : "text-[#231917]"
                      )}
                    >
                      {cell.day}
                    </span>
                    <span
                      dir="rtl"
                      className="font-arabic text-sm leading-none text-[#8C6422] sm:text-base"
                      title={misri.formattedEn}
                    >
                      {misri.dayAr}
                    </span>
                  </div>

                  <div className="mt-1 space-y-1">
                    {misri.day === 1 ? (
                      <div className="truncate text-[10px] font-bold text-[#6A1B1B]">
                        {misri.monthNameEn.split("-")[0]}
                      </div>
                    ) : null}

                    {dayEvents.slice(0, 2).map((ev) => (
                      <div
                        key={ev.id}
                        className={cn(
                          "truncate rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                          ev.eventType === "PUBLIC"
                            ? "bg-[#6A1B1B] text-[#FAF7F2]"
                            : "bg-[#F3EFE6] text-[#5E4F4A] border border-[#DCD2C2]"
                        )}
                      >
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 ? (
                      <div className="text-[10px] font-semibold text-[#6A1B1B]">
                        +{dayEvents.length - 2} more
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Right 4 Columns: Selected Date Details + Upcoming Agenda */}
      <div className="space-y-6 xl:col-span-4">
        <Card doubleFrame>
          <CardHeader
            icon={<CalendarIcon className="h-4 w-4" />}
            title={formatIST(selectedDateKey, "EEEE, dd MMMM yyyy")}
            subtitle={`${selectedMisri.formattedEn} • ${selectedMisri.formattedAr}`}
          />
          <CardBody className="space-y-3">
            {selectedDayEvents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#DCD2C2] bg-[#FAF7F2] px-4 py-7 text-center text-xs text-[#7B6B63]">
                No scheduled events on this date.
              </div>
            ) : (
              selectedDayEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="space-y-2 rounded-xl border border-[#E5DDD0] bg-[#FAF7F2]/80 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-bold text-[#231917]">
                      {ev.title}
                    </h4>
                    <Badge
                      tone={ev.eventType === "PUBLIC" ? "maroon" : "neutral"}
                    >
                      {ev.eventType}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-xs text-[#5E4F4A]">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-[#8C7B73]" />
                      <span>{ev.occasionTime}</span>
                    </div>
                    {ev.halls.length > 0 ? (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-[#8C7B73]" />
                        <span>{ev.halls.join(", ")}</span>
                      </div>
                    ) : null}
                    <div className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-[#8C7B73]" />
                      <span>Expected Thaals: {ev.thaalCount}</span>
                    </div>
                  </div>
                  {ev.hasMenu && ev.dateKey === todayIso ? (
                    <Link href="/menu" className="inline-block pt-1">
                      <Button
                        size="xs"
                        variant="brass"
                        icon={<Utensils className="h-3 w-3" />}
                      >
                        Open Jaman Menu
                      </Button>
                    </Link>
                  ) : null}
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={
              isShowingRecentFallback
                ? "Recent Jamaat Occasions"
                : "Upcoming Schedule"
            }
            subtitle={
              isShowingRecentFallback
                ? "Click any occasion to jump to its month on the calendar"
                : "Next scheduled Jamaat occasions"
            }
          />
          <CardBody className="space-y-2.5">
            {agendaList.length === 0 ? (
              <p className="text-xs text-[#7B6B63]">
                No occasions listed.
              </p>
            ) : (
              agendaList.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => {
                    const [y, m] = ev.dateKey.split("-").map(Number);
                    setViewYear(y);
                    setViewMonth(m - 1);
                    setSelectedDateKey(ev.dateKey);
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#EAE2D6] bg-white px-3.5 py-2.5 text-left transition-colors hover:border-[#B8924A] hover:bg-[#FBF6EB] cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-[#231917]">
                      {ev.title}
                    </p>
                    <p className="text-[11px] text-[#7B6B63]">
                      {formatIST(ev.dateKey, "dd MMM yyyy")} • {ev.occasionTime}
                    </p>
                  </div>
                  <Badge tone="brass">{ev.thaalCount}T</Badge>
                </button>
              ))
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
