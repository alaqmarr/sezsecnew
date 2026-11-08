"use client";

import React from "react";
import { cn } from "@sezsec/shared";

export interface TabOption<T extends string = string> {
  id: T;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export function Tabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  className,
}: {
  tabs: ReadonlyArray<TabOption<T>>;
  activeTab: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex flex-wrap items-center gap-1 rounded-2xl border border-[#E5DDD0] bg-[#F3EFE6]/80 p-1",
        className
      )}
    >
      {tabs.map((t) => {
        const active = t.id === activeTab;
        return (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer",
              active
                ? "bg-white text-[#6A1B1B] shadow-xs border border-[#DCD2C2]"
                : "text-[#5E4F4A] hover:text-[#231917] border border-transparent"
            )}
          >
            {t.icon ? <span className="shrink-0">{t.icon}</span> : null}
            <span>{t.label}</span>
            {t.count !== undefined ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                  active
                    ? "bg-[#6A1B1B]/10 text-[#6A1B1B]"
                    : "bg-[#E5DDD0] text-[#5E4F4A]"
                )}
              >
                {t.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
