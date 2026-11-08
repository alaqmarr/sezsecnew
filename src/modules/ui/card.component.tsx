import React from "react";
import { cn } from "@sezsec/shared";

export function Card({
  children,
  doubleFrame = false,
  className,
}: {
  children: React.ReactNode;
  doubleFrame?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "jadwal-card rounded-2xl",
        doubleFrame ? "jadwal-double-frame" : "",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b border-[#EAE2D6] px-5 py-4",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {icon ? (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#D9C398] bg-[#FBF6EB] text-[#6A1B1B]">
            {icon}
          </div>
        ) : null}
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-[#231917]">
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-[#7B6B63]">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function CardBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("p-5", className)}>{children}</div>;
}

export function CardFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t border-[#EAE2D6] bg-[#FAF7F2]/60 px-5 py-3.5 rounded-b-2xl",
        className
      )}
    >
      {children}
    </div>
  );
}

export function StatTile({
  label,
  value,
  sublabel,
  icon,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  sublabel?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "maroon" | "brass" | "sage";
  className?: string;
}) {
  const iconTone = {
    default: "bg-[#F3EFE6] text-[#5E4F4A] border-[#E5DDD0]",
    maroon: "bg-[#6A1B1B]/10 text-[#6A1B1B] border-[#6A1B1B]/20",
    brass: "bg-[#FBF6EB] text-[#8C6422] border-[#D9C398]",
    sage: "bg-[#ECFDF5] text-[#166534] border-[#BBF7D0]",
  }[tone];

  return (
    <div
      className={cn(
        "jadwal-card flex items-start justify-between gap-3 rounded-2xl p-4 sm:p-5",
        className
      )}
    >
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7B6B63]">
          {label}
        </p>
        <div className="mt-1.5 text-2xl font-bold tracking-tight text-[#231917] tabular-nums">
          {value}
        </div>
        {sublabel ? (
          <div className="mt-1 text-xs text-[#7B6B63]">{sublabel}</div>
        ) : null}
      </div>
      {icon ? (
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
            iconTone
          )}
        >
          {icon}
        </div>
      ) : null}
    </div>
  );
}
