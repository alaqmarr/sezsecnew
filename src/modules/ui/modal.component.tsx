"use client";

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@sezsec/shared";
import { Button } from "./button.component";

const MODAL_SIZES = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  full: "max-w-6xl",
} as const;

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  size = "md",
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  size?: keyof typeof MODAL_SIZES;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-5">
      <div
        onClick={onClose}
        className="fixed inset-0 bg-[#231917]/50 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl border border-[#D9C398] bg-white shadow-2xl",
          MODAL_SIZES[size]
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#EAE2D6] bg-[#FAF7F2] px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[#231917] sm:text-lg">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-0.5 text-xs text-[#7B6B63]">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-[#7B6B63] hover:bg-[#EAE2D6] hover:text-[#231917] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-[#EAE2D6] bg-[#FAF7F2] px-5 py-3.5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  widthClass = "max-w-xl",
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  widthClass?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[110] flex justify-end">
      <div
        onClick={onClose}
        className="fixed inset-0 bg-[#231917]/50 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 flex h-full w-full flex-col border-l border-[#D9C398] bg-white shadow-2xl",
          widthClass
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#EAE2D6] bg-[#FAF7F2] px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[#231917] sm:text-lg">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-0.5 text-xs text-[#7B6B63]">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="rounded-lg p-1.5 text-[#7B6B63] hover:bg-[#EAE2D6] hover:text-[#231917] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-[#EAE2D6] bg-[#FAF7F2] px-5 py-3.5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  variant = "danger",
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  variant?: "danger" | "primary";
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-[#5E4F4A]">{description}</div>
    </Modal>
  );
}
