"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatIST } from "@sezsec/shared";
import { Badge, Button, SearchInput } from "@sezsec/ui";

interface EventAttendanceRow {
  eventId: string;
  title: string;
  occasionDate: string;
  occasionTime: string;
  eventType: string;
  present: number;
  excused: number;
  absent: number;
  totalMarked: number;
}

export function AttendanceMasterClient({
  rows,
  totalMembers,
}: {
  rows: EventAttendanceRow[];
  totalMembers: number;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        formatIST(r.occasionDate, "dd MMM yyyy").toLowerCase().includes(q)
    );
  }, [rows, query]);

  const totals = useMemo(() => {
    let present = 0;
    let excused = 0;
    let absent = 0;
    for (const r of rows) {
      present += r.present;
      excused += r.excused;
      absent += r.absent;
    }
    return { present, excused, absent };
  }, [rows]);

  return (
    <div className="w-full space-y-6">
      {/* Clean Summary Metrics Strip */}
      <div className="grid w-full grid-cols-2 divide-y divide-[#EAE2D6] rounded-2xl border border-[#E5DDD0] bg-white sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        <div className="px-5 py-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#8C7B73]">
            Tracked Miqaats
          </p>
          <p className="mt-1 font-editorial text-3xl font-bold text-[#231917]">
            {rows.length}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#166534]">
            Total Present Marks
          </p>
          <p className="mt-1 font-editorial text-3xl font-bold text-[#166534]">
            {totals.present}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#92400E]">
            Total Excused
          </p>
          <p className="mt-1 font-editorial text-3xl font-bold text-[#92400E]">
            {totals.excused}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#991B1B]">
            Total Absent
          </p>
          <p className="mt-1 font-editorial text-3xl font-bold text-[#991B1B]">
            {totals.absent}
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-full sm:max-w-md">
          <SearchInput
            placeholder="Search miqaat title or date…"
            value={query}
            onChange={setQuery}
          />
        </div>
        <span className="text-xs text-[#7B6B63]">
          Committee strength: <strong>{totalMembers}</strong> members
        </span>
      </div>

      {/* Full-Width Ledger */}
      <div className="overflow-hidden rounded-2xl border border-[#E5DDD0] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#E5DDD0] bg-[#FAF7F2] text-xs font-bold uppercase tracking-wider text-[#6E5D55]">
                <th className="px-5 py-3.5">Occasion</th>
                <th className="px-4 py-3.5">Date</th>
                <th className="px-4 py-3.5">Present</th>
                <th className="px-4 py-3.5">Excused</th>
                <th className="px-4 py-3.5">Absent</th>
                <th className="px-4 py-3.5">Turnout</th>
                <th className="px-5 py-3.5 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE8DC]">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center text-sm text-[#7B6B63]"
                  >
                    No attendance sessions match your search.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const pct =
                    totalMembers > 0
                      ? Math.min(
                          100,
                          Math.round((r.present / totalMembers) * 100)
                        )
                      : 0;
                  return (
                    <tr
                      key={r.eventId}
                      className="transition-colors hover:bg-[#FAF7F2]/60"
                    >
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-[#231917]">
                          {r.title}
                        </div>
                        <div className="text-xs text-[#8C7B73]">
                          {r.eventType}
                          {r.occasionTime ? ` • ${r.occasionTime}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs font-medium text-[#4E3F3A]">
                        {formatIST(r.occasionDate, "EEE, dd MMM yyyy")}
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge tone="emerald">{r.present}</Badge>
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge tone="brass">{r.excused}</Badge>
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge tone="crimson">{r.absent}</Badge>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-[#EFE8DC]">
                            <div
                              style={{ width: `${pct}%` }}
                              className="h-full rounded-full bg-[#2A6041]"
                            />
                          </div>
                          <span className="font-mono text-xs font-semibold text-[#3D2E2A]">
                            {pct}%
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link href={`/admin/attendance-details/${r.eventId}`}>
                          <Button size="xs" variant="secondary">
                            Roll Call <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
