import Link from "next/link";
import { connection } from "next/server";
import { FileSpreadsheet, Wallet } from "lucide-react";
import { db } from "@sezsec/db";
import { requireServerPathAccess } from "@sezsec/rbac/rbac.server";
import { formatIST, getISTDayBounds, getISTTodayString, MONTH_NAMES_SHORT } from "@sezsec/shared";
import { Button, PageHeader } from "@sezsec/ui";
import { AccountsClient } from "./accounts-client";

export default async function AdminAccountsOverviewPage() {
  await connection();
  await requireServerPathAccess("/admin/accounts");

  const todayIso = getISTTodayString();
  const { startOfDay } = getISTDayBounds(todayIso);

  const [users, recentTransactions, todayAgg] = await Promise.all([
    db.user.findMany({
      orderBy: { name: "asc" },
      include: {
        feeConfig: true,
        feeRecords: true,
        eventContributions: true,
      },
    }),
    db.feeTransaction.findMany({
      orderBy: { date: "desc" },
      take: 30,
      include: {
        user: { select: { name: true, username: true, its: true } },
        allocations: {
          include: { feeRecord: true, eventContribution: true },
        },
      },
    }),
    db.feeTransaction.aggregate({
      where: { date: { gte: startOfDay } },
      _sum: { amount: true },
    }),
  ]);

  const memberStandings = users.map((u) => {
    const monthlyBilled = u.feeRecords.reduce((s, r) => s + r.amount, 0);
    const monthlyPaid = u.feeRecords.reduce((s, r) => s + r.paidAmount, 0);
    const monthlyDue = Math.max(0, monthlyBilled - monthlyPaid);

    const eventBilled = u.eventContributions.reduce((s, c) => s + c.amount, 0);
    const eventPaid = u.eventContributions.reduce(
      (s, c) => s + c.paidAmount,
      0
    );
    const eventDue = Math.max(0, eventBilled - eventPaid);

    return {
      id: u.id,
      name: u.name || u.username,
      username: u.username,
      its: u.its || "",
      mobile: u.mobile || "",
      monthlyRate: u.feeConfig?.amount ?? 0,
      monthlyPaid,
      monthlyDue,
      eventPaid,
      eventDue,
      totalDue: monthlyDue + eventDue,
    };
  });

  const totalCollected = memberStandings.reduce(
    (s, m) => s + m.monthlyPaid + m.eventPaid,
    0
  );
  const totalMonthlyPending = memberStandings.reduce(
    (s, m) => s + m.monthlyDue,
    0
  );
  const totalEventPending = memberStandings.reduce(
    (s, m) => s + m.eventDue,
    0
  );

  return (
    <div className="w-full space-y-6">
      <PageHeader
        eyebrow="Treasury & Collections"
        title="Accounts & Member Financial Standing"
        subtitle="Real-time summary of committee monthly contributions, event funds, and member balances."
        actions={
          <>
            <a href="/api/exports?type=ACCOUNTS">
              <Button
                variant="secondary"
                size="sm"
                icon={<FileSpreadsheet className="h-4 w-4" />}
              >
                Export Standing (.xlsx)
              </Button>
            </a>
            <Link href="/admin/fees">
              <Button
                variant="primary"
                size="sm"
                icon={<Wallet className="h-4 w-4" />}
              >
                Manage Fees &amp; Record Payments
              </Button>
            </Link>
          </>
        }
      />

      <AccountsClient
        summary={{
          totalCollected,
          totalMonthlyPending,
          totalEventPending,
          todayCollected: todayAgg._sum.amount ?? 0,
        }}
        members={memberStandings}
        recentTransactions={recentTransactions.map((t) => ({
          id: t.id,
          memberName: t.user.name || t.user.username,
          its: t.user.its || t.user.username,
          amount: t.amount,
          mode: t.mode,
          reference: t.reference || "",
          dateFormatted: formatIST(t.date, "dd MMM yyyy, hh:mm a"),
          summary: t.allocations
            .map((a) =>
              a.feeRecord
                ? `${MONTH_NAMES_SHORT[a.feeRecord.month]} ${a.feeRecord.year}`
                : a.eventContribution
                  ? a.eventContribution.title
                  : ""
            )
            .filter(Boolean)
            .join(", "),
        }))}
      />
    </div>
  );
}
