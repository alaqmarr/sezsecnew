import React from "react";
import { cn } from "@sezsec/shared";

export type BadgeTone =
  | "neutral"
  | "maroon"
  | "brass"
  | "success"
  | "emerald"
  | "warning"
  | "danger"
  | "crimson"
  | "info";

const TONE_STYLES: Record<BadgeTone, string> = {
  neutral: "bg-[#F3EFE6] text-[#5E4F4A] border-[#E5DDD0]",
  maroon: "bg-[#6A1B1B]/10 text-[#6A1B1B] border-[#6A1B1B]/25",
  brass: "bg-[#FBF6EB] text-[#7C5B1F] border-[#D9C398]",
  success: "bg-[#ECFDF5] text-[#166534] border-[#BBF7D0]",
  emerald: "bg-[#ECFDF5] text-[#166534] border-[#BBF7D0]",
  warning: "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]",
  danger: "bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]",
  crimson: "bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]",
  info: "bg-[#F0F9FF] text-[#075985] border-[#BAE6FD]",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
        TONE_STYLES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
