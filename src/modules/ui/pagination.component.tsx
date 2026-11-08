"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button.component";

export function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalItems?: number;
  pageSize?: number;
  onPageChange: (nextPage: number) => void;
}) {
  if (totalPages <= 1) return null;

  const start =
    totalItems !== undefined && pageSize
      ? (page - 1) * pageSize + 1
      : undefined;
  const end =
    totalItems !== undefined && pageSize
      ? Math.min(page * pageSize, totalItems)
      : undefined;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
      <div className="text-xs text-[#7B6B63]">
        {start !== undefined && end !== undefined && totalItems !== undefined ? (
          <>
            Showing <strong className="text-[#231917]">{start}</strong>–
            <strong className="text-[#231917]">{end}</strong> of{" "}
            <strong className="text-[#231917]">{totalItems}</strong>
          </>
        ) : (
          <>
            Page <strong className="text-[#231917]">{page}</strong> of{" "}
            <strong className="text-[#231917]">{totalPages}</strong>
          </>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          icon={<ChevronLeft className="h-3.5 w-3.5" />}
        >
          Previous
        </Button>
        <span className="px-2.5 text-xs font-semibold text-[#3D2E2A] tabular-nums">
          {page} / {totalPages}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
