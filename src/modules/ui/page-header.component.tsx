import React from "react";
import { cn } from "@sezsec/shared";
import { FatimidRosette } from "./arabesque.component";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-[#E5DDD0] pb-4 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-[#6A1B1B]">
            <FatimidRosette size={13} />
            <span>{eyebrow}</span>
          </div>
        ) : null}
        <h1 className="font-editorial text-2xl font-bold tracking-tight text-[#231917] sm:text-3xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-[#5E4F4A]">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
