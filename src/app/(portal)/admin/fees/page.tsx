import { connection } from "next/server";
import { db } from "@sezsec/db";
import { requireServerPathAccess } from "@sezsec/rbac/rbac.server";
import { formatIST, MONTH_NAMES_SHORT } from "@sezsec/shared";
import { PageHeader } from "@sezsec/ui";
import { FeesAdminClient } from "./fees-admin-client";

export default async function AdminManageFeesPage() {
  await connection();
  await requireServerPathAccess("/admin/fees");

  const [users, feeRecords, contributions, transactions] = await Promise.all([
    db.user.findMany({
      orderBy: { name: "asc" },
      include: { feeConfig: true },
    }),
    db.feeRecord.findMany({
      orderBy: [{ year: "desc" }, { month: "desc" }],
    }),
    db.eventContribution.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true, username: true, its: true } },
      },
    }),
    db.feeTransaction.findMany({
      orderBy: { date: "desc" },
      take: 150,
      include: {
        user: { select: { name: true, username: true, its: true } },
        allocations: {
          include: { feeRecord: true, eventContribution: true },
        },
      },
    }),
  ]);

  const now = new Date();

  return (
    <div className="w-full space-y-6">
      <PageHeader
        eyebrow="Finance & Ledger Operations"
        title="Manage Monthly Fees, Event Funds & Payments"
        subtitle="Generate monthly dues, launch miqaat contribution campaigns, record settlements, or safely revoke transactions."
      />

      <FeesAdminClient
        currentMonth={now.getMonth()}
        currentYear={now.getFullYear()}
        members={users.map((u) => ({
          id: u.id,
          name: u.name || u.username,
          username: u.username,
          its: u.its || "",
          monthlyRate: u.feeConfig?.amount ?? 0,
        }))}
        feeRecords={feeRecords.map((r) => ({
          id: r.id,
          userId: r.userId,
          month: r.month,
          year: r.year,
          amount: r.amount,
          paidAmount: r.paidAmount,
          status: r.status,
        }))}
        contributions={contributions.map((c) => ({
          id: c.id,
          userId: c.userId,
          memberName: c.user.name || c.user.username,
          its: c.user.its || c.user.username,
          title: c.title,
          amount: c.amount,
          paidAmount: c.paidAmount,
          status: c.status,
          createdFormatted: formatIST(c.createdAt, "dd MMM yyyy"),
        }))}
        transactions={transactions.map((t) => ({
          id: t.id,
          memberName: t.user.name || t.user.username,
          its: t.user.its || t.user.username,
          amount: t.amount,
          mode: t.mode,
          reference: t.reference || "",
          note: t.note || "",
          dateFormatted: formatIST(t.date, "dd MMM yyyy, hh:mm a"),
          allocationsText: t.allocations
            .map((a) =>
              a.feeRecord
                ? `${MONTH_NAMES_SHORT[a.feeRecord.month]} ${a.feeRecord.year} (₹${a.allocatedAmount})`
                : a.eventContribution
                  ? `${a.eventContribution.title} (₹${a.allocatedAmount})`
                  : `₹${a.allocatedAmount}`
            )
            .join(", "),
        }))}
      />
    </div>
  );
}
