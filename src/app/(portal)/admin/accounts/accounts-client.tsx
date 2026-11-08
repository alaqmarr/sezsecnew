"use client";

import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  IndianRupee,
  Landmark,
  Receipt,
} from "lucide-react";
import { formatRupees } from "@sezsec/shared";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  Pagination,
  SearchInput,
  StatTile,
  Tabs,
} from "@sezsec/ui";

interface MemberStandingRow {
  id: string;
  name: string;
  username: string;
  its: string;
  mobile: string;
  monthlyRate: number;
  monthlyPaid: number;
  monthlyDue: number;
  eventPaid: number;
  eventDue: number;
  totalDue: number;
}

interface RecentTxItem {
  id: string;
  memberName: string;
  its: string;
  amount: number;
  mode: string;
  reference: string;
  dateFormatted: string;
  summary: string;
}

const PAGE_SIZE = 20;

export function AccountsClient({
  summary,
  members,
  recentTransactions,
}: {
  summary: {
    totalCollected: number;
    totalMonthlyPending: number;
    totalEventPending: number;
    todayCollected: number;
  };
  members: MemberStandingRow[];
  recentTransactions: RecentTxItem[];
}) {
  const [filter, setFilter] = useState<"ALL" | "OWING" | "CLEAR">("ALL");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      if (filter === "OWING" && m.totalDue <= 0) return false;
      if (filter === "CLEAR" && m.totalDue > 0) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.username.toLowerCase().includes(q) ||
        m.its.toLowerCase().includes(q) ||
        m.mobile.toLowerCase().includes(q)
      );
    });
  }, [members, filter, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  return (
    <div className="space-y-6">
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Total Collected"
          value={formatRupees(summary.totalCollected)}
          sublabel="Monthly + Event settlements"
          icon={<Landmark className="h-5 w-5" />}
          tone="sage"
        />
        <StatTile
          label="Pending Monthly Dues"
          value={formatRupees(summary.totalMonthlyPending)}
          sublabel="Unpaid monthly contributions"
          icon={<AlertCircle className="h-5 w-5" />}
          tone="maroon"
        />
        <StatTile
          label="Pending Event Funds"
          value={formatRupees(summary.totalEventPending)}
          sublabel="Unpaid miqaat campaigns"
          icon={<Receipt className="h-5 w-5" />}
          tone="brass"
        />
        <StatTile
          label="Collected Today (IST)"
          value={formatRupees(summary.todayCollected)}
          sublabel="Recorded since midnight IST"
          icon={<IndianRupee className="h-5 w-5" />}
        />
      </div>

      <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left 8 Cols: Member Standing Table */}
        <Card className="xl:col-span-8">
          <CardHeader
            title="Member Financial Standing"
            subtitle="Complete breakdown of monthly and event balances"
            action={
              <SearchInput
                value={query}
                onChange={(val) => {
                  setQuery(val);
                  setPage(1);
                }}
                placeholder="Search name, ITS, mobile…"
                className="w-64"
              />
            }
          />
          <CardBody className="space-y-4">
            <Tabs
              tabs={[
                { id: "ALL", label: "All Members", count: members.length },
                {
                  id: "OWING",
                  label: "Pending Balance",
                  count: members.filter((m) => m.totalDue > 0).length,
                },
                {
                  id: "CLEAR",
                  label: "Settled / Clear",
                  count: members.filter((m) => m.totalDue === 0).length,
                },
              ]}
              activeTab={filter}
              onChange={(next) => {
                setFilter(next);
                setPage(1);
              }}
            />

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#EAE2D6] text-[11px] font-bold uppercase tracking-wider text-[#7B6B63]">
                    <th className="py-2.5 pr-3">Member</th>
                    <th className="py-2.5 px-3 text-right">Rate/Mo</th>
                    <th className="py-2.5 px-3 text-right">Monthly Due</th>
                    <th className="py-2.5 px-3 text-right">Event Due</th>
                    <th className="py-2.5 pl-3 text-right">Total Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0E9DD]">
                  {pageItems.map((m) => (
                    <tr key={m.id} className="hover:bg-[#FAF7F2]/70">
                      <td className="py-3 pr-3">
                        <div className="font-bold text-[#231917]">{m.name}</div>
                        <div className="text-[11px] text-[#7B6B63]">
                          {m.its ? `ITS ${m.its}` : `@${m.username}`}
                          {m.mobile ? ` • ${m.mobile}` : ""}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-xs text-[#5E4F4A] tabular-nums">
                        {formatRupees(m.monthlyRate)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-xs text-[#5E4F4A] tabular-nums">
                        {formatRupees(m.monthlyDue)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-xs text-[#5E4F4A] tabular-nums">
                        {formatRupees(m.eventDue)}
                      </td>
                      <td className="py-3 pl-3 text-right">
                        {m.totalDue > 0 ? (
                          <span className="font-mono font-bold text-[#991B1B] tabular-nums">
                            {formatRupees(m.totalDue)}
                          </span>
                        ) : (
                          <Badge tone="success">
                            <CheckCircle2 className="h-3 w-3" /> Clear
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={safePage}
              totalPages={totalPages}
              totalItems={filtered.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </CardBody>
        </Card>

        {/* Right 4 Cols: Recent Ledger Entries */}
        <Card className="xl:col-span-4">
          <CardHeader
            title="Recent Receipts"
            subtitle="Latest 30 recorded settlements"
          />
          <CardBody className="max-h-[680px] space-y-2.5 overflow-y-auto">
            {recentTransactions.length === 0 ? (
              <p className="py-8 text-center text-xs text-[#7B6B63]">
                No transactions recorded yet.
              </p>
            ) : (
              recentTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="rounded-xl border border-[#EAE2D6] bg-[#FAF7F2]/70 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-[#231917]">
                        {tx.memberName}
                      </p>
                      <p className="truncate text-[11px] text-[#7B6B63]">
                        {tx.summary || "Contribution Settlement"}
                      </p>
                    </div>
                    <span className="font-mono text-xs font-bold text-[#166534] tabular-nums">
                      +{formatRupees(tx.amount)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-[#8C7B73]">
                    <span>{tx.dateFormatted}</span>
                    <span>
                      {tx.mode}
                      {tx.reference ? ` • ${tx.reference}` : ""}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
