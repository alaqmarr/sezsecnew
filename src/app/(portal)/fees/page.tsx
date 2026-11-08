import { connection } from "next/server";
import { db } from "@sezsec/db";
import { getPortalRuntimeConfig } from "@sezsec/notifications";
import { requireServerSession } from "@sezsec/rbac/rbac.server";
import { formatIST, MONTH_NAMES_FULL, MONTH_NAMES_SHORT } from "@sezsec/shared";
import { PageHeader } from "@sezsec/ui";
import { MemberFeesClient } from "./member-fees-client";

export async function renderMemberFeesView(defaultTab: "PENDING" | "HISTORY" = "PENDING") {
  await connection();
  const session = await requireServerSession();

  const [feeConfig, feeRecords, contributions, transactions, runtimeCfg, notices] =
    await Promise.all([
      db.userFeeConfig.findUnique({ where: { userId: session.id } }),
      db.feeRecord.findMany({
        where: { userId: session.id },
        orderBy: [{ year: "desc" }, { month: "desc" }],
      }),
      db.eventContribution.findMany({
        where: { userId: session.id },
        orderBy: { createdAt: "desc" },
      }),
      db.feeTransaction.findMany({
        where: { userId: session.id },
        orderBy: { date: "desc" },
        include: {
          allocations: {
            include: {
              feeRecord: true,
              eventContribution: true,
            },
          },
        },
      }),
      getPortalRuntimeConfig(),
      db.communityMessage.findMany({
        where: { isPinned: true },
        orderBy: { createdAt: "desc" },
        take: 2,
      }),
    ]);

  return (
    <div className="w-full space-y-6">
      <PageHeader
        eyebrow="Member Contributions & Ledger"
        title="My Monthly Contributions & Event Funds"
        subtitle="Select pending items to pay instantly via UPI QR or review your verified contribution receipts."
      />

      <MemberFeesClient
        defaultTab={defaultTab}
        memberUsername={session.its || session.username}
        memberName={session.name || session.username}
        monthlyRate={feeConfig?.amount ?? 0}
        upiId={runtimeCfg.upiId}
        upiPayeeName={runtimeCfg.upiPayeeName}
        userId={session.id}
        pinnedNotices={notices.map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          date: formatIST(n.createdAt, "dd MMM yyyy"),
        }))}
        feeRecords={feeRecords.map((r) => ({
          id: r.id,
          label: `${MONTH_NAMES_FULL[r.month] || r.month} ${r.year}`,
          shortLabel: `${MONTH_NAMES_SHORT[r.month] || r.month}-${String(r.year).slice(-2)}`,
          amount: r.amount,
          paidAmount: r.paidAmount,
          due: Math.max(0, r.amount - r.paidAmount),
          status: r.status,
        }))}
        contributions={contributions.map((c) => ({
          id: c.id,
          title: c.title,
          amount: c.amount,
          paidAmount: c.paidAmount,
          due: Math.max(0, c.amount - c.paidAmount),
          status: c.status,
          createdFormatted: formatIST(c.createdAt, "dd MMM yyyy"),
        }))}
        transactions={transactions.map((t) => ({
          id: t.id,
          amount: t.amount,
          mode: t.mode,
          reference: t.reference || "",
          note: t.note || "",
          dateFormatted: formatIST(t.date, "dd MMM yyyy, hh:mm a"),
          itemsSummary: t.allocations
            .map((a) => {
              if (a.feeRecord) {
                return `${MONTH_NAMES_SHORT[a.feeRecord.month]} ${a.feeRecord.year} (₹${a.allocatedAmount})`;
              }
              if (a.eventContribution) {
                return `${a.eventContribution.title} (₹${a.allocatedAmount})`;
              }
              return `₹${a.allocatedAmount}`;
            })
            .join(", "),
        }))}
      />
    </div>
  );
}

export default async function MemberFeesPage() {
  return renderMemberFeesView("PENDING");
}
