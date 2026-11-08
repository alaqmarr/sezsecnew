"use client";

import React from "react";
import { cn } from "@sezsec/shared";
import { IosSpinner } from "./ios-loader.component";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "brass"
  | "ghost"
  | "danger"
  | "sage";

export type ButtonSize = "xs" | "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-[#6A1B1B] text-[#FAF7F2] border border-[#6A1B1B] hover:bg-[#541414] active:bg-[#430F0F] shadow-xs",
  secondary:
    "bg-white text-[#231917] border border-[#DCD2C2] hover:border-[#B8924A] hover:bg-[#FBF6EB]",
  brass:
    "bg-[#FBF6EB] text-[#6A1B1B] border border-[#D9C398] hover:bg-[#F4EBD5]",
  ghost:
    "bg-transparent text-[#5E4F4A] border border-transparent hover:bg-[#F3EFE6] hover:text-[#231917]",
  danger:
    "bg-[#991B1B] text-white border border-[#991B1B] hover:bg-[#7F1D1D] shadow-xs",
  sage:
    "bg-[#2A6041] text-white border border-[#2A6041] hover:bg-[#214D34] shadow-xs",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: "h-7 px-2.5 text-xs rounded-lg gap-1.5",
  sm: "h-8.5 px-3.5 text-xs rounded-xl gap-1.5",
  md: "h-10 px-4 text-sm rounded-xl gap-2",
  lg: "h-11 px-5 text-sm rounded-xl gap-2.5",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const spinnerTone =
    variant === "primary" || variant === "danger" || variant === "sage"
      ? "light"
      : "maroon";

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center font-semibold transition-all duration-150 select-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-60",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className
      )}
      {...rest}
    >
      {loading ? (
        <IosSpinner
          size={size === "xs" ? "xs" : "sm"}
          tone={spinnerTone}
        />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}
