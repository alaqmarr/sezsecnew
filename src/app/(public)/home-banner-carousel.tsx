"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@sezsec/shared";

export interface PublicBannerSlide {
  id: string;
  imageUrl: string;
  href: string | null;
  countdownTarget: string | null;
  countdownLabel: string | null;
  x: number | null;
  y: number | null;
  countdownSize: string | null;
  countdownColor: string | null;
}

function formatBannerCountdown(targetIso: string, nowMs: number): string {
  const diff = new Date(targetIso).getTime() - nowMs;
  if (diff <= 0) return "Started";

  const days = Math.floor(diff / 86_400_000);
  if (diff > 48 * 3_600_000) {
    return `${days} Days`;
  }

  const totalHours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);

  return `${String(totalHours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(2, "0")}`;
}

function getCountdownSizeClass(size?: string | null): string {
  switch (size) {
    case "small":
      return "text-[10px] sm:text-xs md:text-sm px-2 sm:px-2.5 md:px-3 py-0.5 sm:py-1 md:py-1.5 min-w-[52px] md:min-w-[80px]";
    case "large":
      return "text-xs sm:text-base md:text-xl lg:text-3xl px-2.5 sm:px-4 md:px-6 lg:px-8 py-1 sm:py-2 md:py-3 lg:py-4 min-w-[68px] md:min-w-[130px] lg:min-w-[160px]";
    case "xl":
      return "text-sm sm:text-lg md:text-2xl lg:text-5xl px-3 sm:px-5 md:px-7 lg:px-10 py-1.5 sm:py-2.5 md:py-4 lg:py-6 min-w-[80px] md:min-w-[150px] lg:min-w-[200px]";
    default:
      return "text-[11px] sm:text-sm md:text-lg lg:text-xl px-2.5 sm:px-3.5 md:px-5 py-1 sm:py-1.5 md:py-2.5 min-w-[60px] md:min-w-[105px] lg:min-w-[120px]";
  }
}

function getCountdownColorClass(color?: string | null): string {
  if (color === "wine" || color === "maroon") {
    return "bg-[#6A1B1B]/95 text-[#F5DFB0] border-[#E2BD75]/40";
  }
  if (color === "white") {
    return "bg-white/95 text-[#231917] border-[#D9C398]";
  }
  return "bg-[#D4AF37]/92 text-[#2B0F14] border-white/30";
}

export function HomeBannerCarousel({
  banners,
}: {
  banners: PublicBannerSlide[];
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
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
    if (banners.length <= 1) return;
    const timer = setInterval(
      () => setCurrentIndex((prev) => (prev + 1) % banners.length),
      5000
    );
    return () => clearInterval(timer);
  }, [banners.length]);

  if (banners.length === 0) return null;

  const next = () => setCurrentIndex((prev) => (prev + 1) % banners.length);
  const prev = () =>
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);

  return (
    <section className="group relative w-full">
      {/* Strict 4:1 aspect ratio with zero min-height/max-height overrides so 100% of the banner stays visible across every mobile, tablet, and desktop viewport */}
      <div className="overflow-hidden rounded-xl border border-[#D9C398]/70 bg-[#F3EFE6] shadow-xs sm:rounded-2xl">
        <div className="relative aspect-[4/1] w-full overflow-hidden">
          {banners.map((banner, index) => {
            const isVisible = index === currentIndex;
            const hasCountdown =
              Boolean(banner.countdownTarget) &&
              banner.x !== null &&
              banner.y !== null &&
              nowMs !== null;

            const imageEl = (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={banner.imageUrl}
                alt={banner.countdownLabel || "SEZ Secunderabad Banner"}
                className="block h-full w-full object-contain"
              />
            );

            return (
              <div
                key={banner.id}
                className={cn(
                  "absolute inset-0 transition-opacity duration-700 ease-in-out",
                  isVisible
                    ? "z-10 opacity-100"
                    : "pointer-events-none z-0 opacity-0"
                )}
              >
                {/* Subtle matching backdrop in case a non-4:1 image is ever linked, while keeping 4:1 images 100% edge-to-edge */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={banner.imageUrl}
                  alt=""
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 h-full w-full scale-105 object-cover opacity-25 blur-xl"
                />

                <div className="relative z-10 h-full w-full">
                  {banner.href ? (
                    banner.href.startsWith("http") ? (
                      <a href={banner.href} className="block h-full w-full">
                        {imageEl}
                      </a>
                    ) : (
                      <Link href={banner.href} className="block h-full w-full">
                        {imageEl}
                      </Link>
                    )
                  ) : (
                    imageEl
                  )}
                </div>

                {hasCountdown && banner.countdownTarget && nowMs !== null ? (
                  <div
                    style={{
                      left: `${banner.x}%`,
                      top: `${banner.y}%`,
                    }}
                    className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2"
                  >
                    <div
                      className={cn(
                        "flex flex-col items-center justify-center rounded-full border text-center font-bold shadow-xl backdrop-blur-md",
                        getCountdownSizeClass(banner.countdownSize),
                        getCountdownColorClass(banner.countdownColor)
                      )}
                    >
                      {banner.countdownLabel ? (
                        <div className="mb-0.5 text-[0.58em] font-bold uppercase tracking-widest opacity-85">
                          {banner.countdownLabel}
                        </div>
                      ) : null}
                      <div className="font-mono leading-none tracking-tight tabular-nums">
                        {formatBannerCountdown(banner.countdownTarget, nowMs)}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}

          {banners.length > 1 ? (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  prev();
                }}
                aria-label="Previous banner"
                className="absolute left-2 top-1/2 z-30 -translate-y-1/2 rounded-full bg-black/35 p-1.5 text-white backdrop-blur-xs transition-opacity hover:bg-black/60 sm:left-4 sm:p-2 sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                aria-label="Next banner"
                className="absolute right-2 top-1/2 z-30 -translate-y-1/2 rounded-full bg-black/35 p-1.5 text-white backdrop-blur-xs transition-opacity hover:bg-black/60 sm:right-4 sm:p-2 sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer"
              >
                <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>

              <div className="absolute bottom-2 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 sm:bottom-3.5">
                {banners.map((b, idx) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    aria-label={`Banner ${idx + 1}`}
                    className={cn(
                      "h-1.5 rounded-full transition-all sm:h-2 cursor-pointer",
                      idx === currentIndex
                        ? "w-5 bg-white sm:w-6"
                        : "w-1.5 bg-white/55 sm:w-2"
                    )}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
