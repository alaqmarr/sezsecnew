"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChefHat, Clock, Utensils, X } from "lucide-react";

export interface TodayMenuAlertProps {
  title: string;
  menu: string;
  time: string;
  thaalCount: number;
  halls: string[];
  hallCounts: Record<string, number> | null;
  occasionDateIso: string;
}

function parseTimeString(timeStr: string): { hours: number; minutes: number } {
  const match = timeStr.trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const isPM = match[3].toUpperCase() === "PM";
    if (isPM && hours !== 12) hours += 12;
    if (!isPM && hours === 12) hours = 0;
    return { hours, minutes };
  }
  const match24 = timeStr.trim().match(/^(\d{1,2}):(\d{2})/);
  if (match24) {
    return {
      hours: parseInt(match24[1], 10) || 19,
      minutes: parseInt(match24[2], 10) || 30,
    };
  }
  return { hours: 19, minutes: 30 };
}

function computeEventInstantMs(occasionDateIso: string, timeStr: string): number {
  const { hours, minutes } = parseTimeString(timeStr);
  // Extract YYYY-MM-DD in IST (+05:30) so client & server compute the exact same instant
  const istParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(occasionDateIso));
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  return new Date(`${istParts}T${hh}:${mm}:00+05:30`).getTime();
}

export function HomeMenuAlert({
  title,
  menu,
  time,
  halls,
  hallCounts,
  occasionDateIso,
}: TodayMenuAlertProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    const init = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(init);
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  const eventMs = computeEventInstantMs(occasionDateIso, time);
  const countdownStartMs = eventMs - 24 * 60 * 60 * 1000; // 24h before event
  const revealMs = eventMs - 75 * 60 * 1000; // 75m before event

  let showMenu = false;
  let countdown: { hours: number; minutes: number; seconds: number } | null =
    null;

  if (nowMs !== null) {
    const timeToReveal = revealMs - nowMs;
    const timeToCountdownStart = countdownStartMs - nowMs;

    if (timeToReveal <= 0) {
      showMenu = true;
    } else if (timeToCountdownStart <= 0) {
      const totalSeconds = Math.floor(timeToReveal / 1000);
      countdown = {
        hours: Math.floor(totalSeconds / 3600),
        minutes: Math.floor((totalSeconds % 3600) / 60),
        seconds: totalSeconds % 60,
      };
    }
  }

  const hallRows: Array<[string, string | number]> =
    hallCounts &&
    typeof hallCounts === "object" &&
    Object.keys(hallCounts).length > 0
      ? Object.entries(hallCounts)
      : halls.map((h) => [h, "—"]);

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <>
      {/* Seamless Attached Today's Event Bar */}
      <div className="relative z-30 mx-auto w-full max-w-4xl px-0 sm:px-4">
        <div
          role={showMenu ? "button" : undefined}
          tabIndex={showMenu ? 0 : undefined}
          onClick={() => {
            if (showMenu) setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (showMenu && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              setIsOpen(true);
            }
          }}
          className={`flex items-center justify-between gap-4 border-b border-[#D9C398]/50 bg-gradient-to-r from-[#4A1215] via-[#6A1B1B] to-[#4A1215] px-4 py-2.5 text-[#FAF7F2] shadow-sm transition-all sm:rounded-b-2xl sm:border-x sm:px-6 ${
            showMenu ? "cursor-pointer hover:brightness-105" : ""
          }`}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E2BD75]/40 bg-[#E2BD75]/15 text-[#E2BD75]">
              <Utensils className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-[#E2BD75]">
                Today&apos;s Event
              </p>
              <p className="truncate font-editorial text-base font-bold leading-tight text-[#FAF7F2] sm:text-lg">
                {title}
              </p>
            </div>
          </div>

          {showMenu ? (
            <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#E2BD75]/40 bg-black/25 px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#F5DFB0]">
              <span>View Menu</span>
              <ChefHat className="h-3.5 w-3.5 text-[#E2BD75]" />
            </div>
          ) : countdown ? (
            <div className="flex shrink-0 items-center gap-2">
              <Clock className="hidden h-3.5 w-3.5 text-[#E2BD75] sm:block" />
              <div className="flex items-center gap-1 font-mono text-xs font-bold tabular-nums text-[#FAF7F2] sm:text-sm">
                <span className="rounded bg-black/30 px-1.5 py-0.5">
                  {pad(countdown.hours)}
                </span>
                <span className="text-[#E2BD75]">:</span>
                <span className="rounded bg-black/30 px-1.5 py-0.5">
                  {pad(countdown.minutes)}
                </span>
                <span className="text-[#E2BD75]">:</span>
                <span className="rounded bg-black/30 px-1.5 py-0.5">
                  {pad(countdown.seconds)}
                </span>
              </div>
            </div>
          ) : (
            <div className="shrink-0 rounded-full border border-white/15 bg-black/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#F5DFB0]">
              Something delicious is coming soon
            </div>
          )}
        </div>
      </div>

      {/* Today's Feast Modal */}
      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
              <div
                onClick={() => setIsOpen(false)}
                className="fixed inset-0 bg-[#231917]/65 backdrop-blur-xs"
              />
              <div className="relative z-10 flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[#D9C398] bg-white shadow-2xl">
                {/* Header */}
                <div className="relative shrink-0 bg-gradient-to-b from-[#4A1215] to-[#6A1B1B] px-6 py-6 text-center">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    aria-label="Close menu"
                    className="absolute right-4 top-4 rounded-full p-1.5 text-[#FAF7F2]/70 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <span className="inline-block rounded-full border border-[#E2BD75]/35 bg-[#E2BD75]/15 px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#F5DFB0]">
                    Today&apos;s Feast
                  </span>
                  <h3 className="mt-2.5 font-editorial text-2xl font-bold leading-snug text-[#FAF7F2] sm:text-3xl">
                    {title}
                  </h3>
                </div>

                {/* Scrollable Body */}
                <div className="flex-1 overflow-y-auto">
                  <div className="space-y-4 p-6 text-center">
                    <div>
                      <h4 className="font-editorial text-2xl font-bold text-[#6A1B1B]">
                        The Menu
                      </h4>
                      <div className="mx-auto mt-1.5 h-0.5 w-12 rounded-full bg-[#B8924A]" />
                    </div>
                    <div className="whitespace-pre-wrap rounded-xl border border-[#EAE2D6] bg-[#FAF7F2] p-4 text-sm font-medium leading-relaxed text-[#231917]">
                      {menu}
                    </div>
                  </div>

                  {hallRows.length > 0 ? (
                    <div className="border-t border-[#D9C398]/40 bg-[#3B1012] text-[#FAF7F2]">
                      <div className="grid grid-cols-2 bg-black/25 px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-[#E2BD75]">
                        <span>Hall Name</span>
                        <span className="text-right">Thaals</span>
                      </div>
                      <div className="divide-y divide-white/10 text-sm">
                        {hallRows.map(([hallName, count], idx) => (
                          <div
                            key={`${hallName}-${idx}`}
                            className="grid grid-cols-2 px-5 py-2.5"
                          >
                            <span className="font-medium text-[#FAF7F2]">
                              {hallName}
                            </span>
                            <span className="text-right font-mono font-bold text-[#E2BD75]">
                              {count}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
