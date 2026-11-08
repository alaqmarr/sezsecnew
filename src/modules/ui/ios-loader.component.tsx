import React from "react";
import { cn } from "@sezsec/shared";

const BLADE_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;

const SIZE_CLASSES = {
  xs: "h-3.5 w-3.5",
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-7 w-7",
} as const;

const TONE_CLASSES = {
  current: "text-current",
  maroon: "text-[#6A1B1B]",
  brass: "text-[#B8924A]",
  light: "text-[#FAF7F2]",
  muted: "text-[#7B6B63]",
} as const;

export function IosSpinner({
  size = "sm",
  tone = "current",
  className,
  label = "Loading",
}: {
  size?: keyof typeof SIZE_CLASSES;
  tone?: keyof typeof TONE_CLASSES;
  className?: string;
  label?: string;
}) {
  return (
    <svg
      role="status"
      aria-label={label}
      viewBox="0 0 24 24"
      className={cn(
        "inline-block shrink-0 align-middle",
        SIZE_CLASSES[size],
        TONE_CLASSES[tone],
        className
      )}
    >
      {BLADE_INDICES.map((i) => (
        <rect
          key={i}
          x="11"
          y="1.75"
          width="2"
          height="5.6"
          rx="1"
          fill="currentColor"
          className="ios-spinner-blade"
          style={{
            transform: `rotate(${i * 30}deg)`,
            animationDelay: `${-((12 - i) / 12) * 0.96}s`,
          }}
        />
      ))}
    </svg>
  );
}

export function InlineLoader({
  label = "Loading…",
  size = "sm",
  tone = "maroon",
  className,
}: {
  label?: string;
  size?: keyof typeof SIZE_CLASSES;
  tone?: keyof typeof TONE_CLASSES;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-xs font-medium text-[#5E4F4A]",
        className
      )}
    >
      <IosSpinner size={size} tone={tone} label={label} />
      <span>{label}</span>
    </span>
  );
}

export function PageLoader({
  label = "Loading workspace…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[260px] w-full items-center justify-center py-12",
        className
      )}
    >
      <div className="inline-flex items-center gap-3 rounded-2xl border border-[#E5DDD0] bg-white/90 px-5 py-3 shadow-xs">
        <IosSpinner size="md" tone="maroon" label={label} />
        <span className="text-sm font-medium text-[#3D2E2A]">{label}</span>
      </div>
    </div>
  );
}
