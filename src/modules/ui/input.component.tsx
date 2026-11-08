"use client";

import React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@sezsec/shared";
import { IosSpinner } from "./ios-loader.component";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leftAdornment?: React.ReactNode;
  rightAdornment?: React.ReactNode;
}

export function Input({
  label,
  hint,
  error,
  leftAdornment,
  rightAdornment,
  required,
  className,
  id,
  ...rest
}: InputProps) {
  return (
    <div className="space-y-1.5">
      {label ? (
        <label
          htmlFor={id}
          className="block text-xs font-semibold tracking-wide text-[#3D2E2A]"
        >
          {label}
          {required ? <span className="ml-0.5 text-[#991B1B]">*</span> : null}
        </label>
      ) : null}
      <div className="relative flex items-center">
        {leftAdornment ? (
          <span className="pointer-events-none absolute left-3 text-[#8C7B73]">
            {leftAdornment}
          </span>
        ) : null}
        <input
          id={id}
          required={required}
          className={cn(
            "h-10 w-full rounded-xl border bg-white px-3.5 text-sm text-[#231917] placeholder:text-[#9E8E85] transition-colors focus:border-[#6A1B1B] focus:outline-none focus:ring-2 focus:ring-[#6A1B1B]/12 disabled:bg-[#F5F1E9] disabled:text-[#7B6B63]",
            error ? "border-[#B91C1C]" : "border-[#DCD2C2]",
            leftAdornment ? "pl-9" : "",
            rightAdornment ? "pr-9" : "",
            className
          )}
          {...rest}
        />
        {rightAdornment ? (
          <span className="absolute right-3 flex items-center text-[#8C7B73]">
            {rightAdornment}
          </span>
        ) : null}
      </div>
      {error ? (
        <p className="text-xs font-medium text-[#B91C1C]">{error}</p>
      ) : hint ? (
        <p className="text-xs text-[#7B6B63]">{hint}</p>
      ) : null}
    </div>
  );
}

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function Textarea({
  label,
  hint,
  error,
  required,
  className,
  id,
  rows = 3,
  ...rest
}: TextareaProps) {
  return (
    <div className="space-y-1.5">
      {label ? (
        <label
          htmlFor={id}
          className="block text-xs font-semibold tracking-wide text-[#3D2E2A]"
        >
          {label}
          {required ? <span className="ml-0.5 text-[#991B1B]">*</span> : null}
        </label>
      ) : null}
      <textarea
        id={id}
        rows={rows}
        required={required}
        className={cn(
          "w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-[#231917] placeholder:text-[#9E8E85] transition-colors focus:border-[#6A1B1B] focus:outline-none focus:ring-2 focus:ring-[#6A1B1B]/12 disabled:bg-[#F5F1E9]",
          error ? "border-[#B91C1C]" : "border-[#DCD2C2]",
          className
        )}
        {...rest}
      />
      {error ? (
        <p className="text-xs font-medium text-[#B91C1C]">{error}</p>
      ) : hint ? (
        <p className="text-xs text-[#7B6B63]">{hint}</p>
      ) : null}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  loading = false,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  loading?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative flex items-center", className)}>
      <span className="pointer-events-none absolute left-3.5 text-[#8C7B73]">
        {loading ? (
          <IosSpinner size="sm" tone="maroon" />
        ) : (
          <Search className="h-4 w-4" />
        )}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-[#DCD2C2] bg-white pl-10 pr-9 text-sm text-[#231917] placeholder:text-[#9E8E85] transition-colors focus:border-[#6A1B1B] focus:outline-none focus:ring-2 focus:ring-[#6A1B1B]/12"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2.5 rounded-md p-1 text-[#8C7B73] hover:bg-[#F3EFE6] hover:text-[#231917] cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
