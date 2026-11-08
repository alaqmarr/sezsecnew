"use client";

import React from "react";
import { cn } from "@sezsec/shared";
import { IosSpinner } from "./ios-loader.component";

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  loading = false,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "inline-flex items-center justify-between gap-3 select-none",
        disabled || loading ? "opacity-65 cursor-not-allowed" : "cursor-pointer",
        className
      )}
    >
      {(label || description) && (
        <span className="min-w-0">
          {label ? (
            <span className="block text-sm font-semibold text-[#231917]">
              {label}
            </span>
          ) : null}
          {description ? (
            <span className="block text-xs text-[#7B6B63]">{description}</span>
          ) : null}
        </span>
      )}
      <span className="inline-flex items-center gap-2 shrink-0">
        {loading ? <IosSpinner size="xs" tone="maroon" /> : null}
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={disabled || loading}
          onClick={() => onChange(!checked)}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed",
            checked
              ? "border-[#6A1B1B] bg-[#6A1B1B]"
              : "border-[#D1C4B2] bg-[#E8E1D5]"
          )}
        >
          <span
            className={cn(
              "inline-block h-4.5 w-4.5 rounded-full bg-white shadow-xs transition-transform duration-150",
              checked ? "translate-x-5.5" : "translate-x-0.5"
            )}
          />
        </button>
      </span>
    </label>
  );
}
