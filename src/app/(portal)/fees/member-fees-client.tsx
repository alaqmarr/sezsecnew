"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "react-qr-code";
import {
  CheckCircle2,
  History,
  IndianRupee,
  Megaphone,
  QrCode,
  Receipt,
  Wallet,
} from "lucide-react";
import { recordMemberPaymentAction } from "@/app/actions/finance.actions";
import { cn, formatRupees } from "@sezsec/shared";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Drawer,
  Input,
  SearchInput,
  StatTile,
  Tabs,
  notify,
} from "@sezsec/ui";

interface MemberFeeRow {
  id: string;
  label: string;
  shortLabel: string;
  amount: number;
  paidAmount: number;
  due: number;
  status: "PENDING" | "PARTIAL" | "PAID";
}

interface MemberContributionRow {
  id: string;
  title: string;
  amount: number;
  paidAmount: number;
  due: number;
  status: "PENDING" | "PARTIAL" | "PAID";
  createdFormatted: string;
}

interface MemberTxRow {
  id: string;
  amount: number;
  mode: string;
  reference: string;
  note: string;
  dateFormatted: string;
  itemsSummary: string;
}

export function MemberFeesClient({
  defaultTab,
  userId,
  memberUsername,
  monthlyRate,
  upiId,
  upiPayeeName,
  pinnedNotices,
  feeRecords,
  contributions,
  transactions,
}: {
  defaultTab: "PENDING" | "HISTORY";
  userId: string;
  memberUsername: string;
  memberName: string;
  monthlyRate: number;
  upiId: string;
  upiPayeeName: string;
  pinnedNotices: Array<{ id: string; title: string; body: string; date: string }>;
  feeRecords: MemberFeeRow[];
  contributions: MemberContributionRow[];
  transactions: MemberTxRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"PENDING" | "ALL" | "HISTORY">(defaultTab);
  const [selectedFeeIds, setSelectedFeeIds] = useState<string[]>([]);
  const [selectedContribIds, setSelectedContribIds] = useState<string[]>([]);
  const [payDrawerOpen, setPayDrawerOpen] = useState(false);
  const [utrReference, setUtrReference] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [txQuery, setTxQuery] = useState("");

  const pendingFees = useMemo(
    () => feeRecords.filter((f) => f.due > 0),
    [feeRecords]
  );
  const pendingContribs = useMemo(
    () => contributions.filter((c) => c.due > 0),
    [contributions]
  );

  const totalPendingMonthly = useMemo(
    () => pendingFees.reduce((s, r) => s + r.due, 0),
    [pendingFees]
  );
  const totalPendingContribs = useMemo(
    () => pendingContribs.reduce((s, c) => s + c.due, 0),
    [pendingContribs]
  );
  const totalLifetimePaid = useMemo(
    () => transactions.reduce((s, t) => s + t.amount, 0),
    [transactions]
  );

  const selectedTotal = useMemo(() => {
    const fSum = pendingFees
      .filter((f) => selectedFeeIds.includes(f.id))
      .reduce((s, f) => s + f.due, 0);
    const cSum = pendingContribs
      .filter((c) => selectedContribIds.includes(c.id))
      .reduce((s, c) => s + c.due, 0);
    return fSum + cSum;
  }, [pendingFees, pendingContribs, selectedFeeIds, selectedContribIds]);

  const upiNote = useMemo(() => {
    const labels = [
      ...pendingFees
        .filter((f) => selectedFeeIds.includes(f.id))
        .map((f) => f.shortLabel),
      ...pendingContribs
        .filter((c) => selectedContribIds.includes(c.id))
        .map((c) => c.title.slice(0, 14)),
    ];
    return `VC | ${labels.slice(0, 3).join(",")} | ${memberUsername}`.slice(
      0,
      75
    );
  }, [pendingFees, pendingContribs, selectedFeeIds, selectedContribIds, memberUsername]);

  const upiDeepLink = useMemo(() => {
    const params = new URLSearchParams({
      pa: upiId,
      pn: upiPayeeName,
      am: String(selectedTotal),
      cu: "INR",
      tn: upiNote,
    });
    return `upi://pay?${params.toString()}`;
  }, [upiId, upiPayeeName, selectedTotal, upiNote]);

  const filteredTransactions = useMemo(() => {
    const q = txQuery.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter(
      (t) =>
        t.reference.toLowerCase().includes(q) ||
        t.itemsSummary.toLowerCase().includes(q) ||
        t.mode.toLowerCase().includes(q)
    );
  }, [transactions, txQuery]);

  function toggleFee(id: string) {
    setSelectedFeeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleContrib(id: string) {
    setSelectedContribIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function selectAllPending() {
    setSelectedFeeIds(pendingFees.map((f) => f.id));
    setSelectedContribIds(pendingContribs.map((c) => c.id));
  }

  async function handleConfirmUpiPayment(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await recordMemberPaymentAction({
        userId,
        feeRecordIds: selectedFeeIds,
        contributionIds: selectedContribIds,
        mode: "UPI",
        reference: utrReference,
        note,
      });
      if (!res.ok) {
        notify.error("Payment submission failed", res.error);
        return;
      }
      notify.success("Payment recorded! JazakAllah Khair.");
      setSelectedFeeIds([]);
      setSelectedContribIds([]);
      setUtrReference("");
      setNote("");
      setPayDrawerOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Pinned Notices */}
      {pinnedNotices.length > 0 ? (
        <div className="grid w-full grid-cols-1 gap-3 lg:grid-cols-2">
          {pinnedNotices.map((n) => (
            <div
              key={n.id}
              className="flex items-start gap-3 rounded-2xl border border-[#D9C398] bg-[#FBF6EB] p-4"
            >
              <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-[#6A1B1B]" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#6A1B1B]">
                    {n.title}
                  </span>
                  <span className="text-[11px] text-[#8C7B73]">{n.date}</span>
                </div>
                <p className="mt-0.5 text-xs text-[#3D2E2A]">{n.body}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Full-Width Financial KPI Tiles */}
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Total Outstanding"
          value={formatRupees(totalPendingMonthly + totalPendingContribs)}
          sublabel={`${pendingFees.length + pendingContribs.length} unpaid item(s)`}
          icon={<IndianRupee className="h-5 w-5" />}
          tone="maroon"
        />
        <StatTile
          label="Pending Monthly Fees"
          value={formatRupees(totalPendingMonthly)}
          sublabel={
            monthlyRate > 0
              ? `Monthly rate: ${formatRupees(monthlyRate)}/mo`
              : "Monthly contribution"
          }
          icon={<Wallet className="h-5 w-5" />}
          tone="brass"
        />
        <StatTile
          label="Pending Event Funds"
          value={formatRupees(totalPendingContribs)}
          sublabel={`${pendingContribs.length} active campaign(s)`}
          icon={<Receipt className="h-5 w-5" />}
        />
        <StatTile
          label="Total Contributed"
          value={formatRupees(totalLifetimePaid)}
          sublabel={`${transactions.length} recorded payment(s)`}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="sage"
        />
      </div>

      {/* Tabs + Quick Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          tabs={[
            {
              id: "PENDING",
              label: "Pending Dues",
              count: pendingFees.length + pendingContribs.length,
            },
            {
              id: "ALL",
              label: "All Assigned Records",
              count: feeRecords.length + contributions.length,
            },
            {
              id: "HISTORY",
              label: "Payment Receipts",
              count: transactions.length,
              icon: <History className="h-3.5 w-3.5" />,
            },
          ]}
          activeTab={tab}
          onChange={setTab}
        />

        {tab === "PENDING" &&
        (pendingFees.length > 0 || pendingContribs.length > 0) ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={selectAllPending}>
              Select All Pending
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={selectedTotal <= 0}
              icon={<QrCode className="h-4 w-4" />}
              onClick={() => setPayDrawerOpen(true)}
            >
              Scan &amp; Pay{" "}
              {selectedTotal > 0 ? formatRupees(selectedTotal) : "Selected"}
            </Button>
          </div>
        ) : null}
      </div>

      {tab === "PENDING" ? (
        <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Monthly Contributions Column */}
          <Card className="lg:col-span-6">
            <CardHeader
              icon={<Wallet className="h-4 w-4" />}
              title="Pending Monthly Contributions"
              subtitle="Check months to include in a single UPI payment"
            />
            <CardBody>
              {pendingFees.length === 0 ? (
                <div className="rounded-xl border border-[#BBF7D0] bg-[#ECFDF5] p-6 text-center text-xs font-semibold text-[#166534]">
                  Alhamdulillah! You have no pending monthly contributions.
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingFees.map((f) => {
                    const checked = selectedFeeIds.includes(f.id);
                    return (
                      <label
                        key={f.id}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors cursor-pointer",
                          checked
                            ? "border-[#6A1B1B] bg-[#FBF6EB]"
                            : "border-[#EAE2D6] bg-white hover:border-[#B8924A]"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleFee(f.id)}
                            className="h-4 w-4 rounded border-[#B8924A] accent-[#6A1B1B]"
                          />
                          <div>
                            <p className="text-sm font-bold text-[#231917]">
                              {f.label}
                            </p>
                            {f.paidAmount > 0 ? (
                              <p className="text-[11px] text-[#7B6B63]">
                                Paid {formatRupees(f.paidAmount)} of{" "}
                                {formatRupees(f.amount)}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            tone={f.status === "PARTIAL" ? "warning" : "danger"}
                          >
                            {f.status}
                          </Badge>
                          <span className="font-mono text-sm font-bold text-[#6A1B1B] tabular-nums">
                            {formatRupees(f.due)}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Event Contributions Column */}
          <Card className="lg:col-span-6">
            <CardHeader
              icon={<Receipt className="h-4 w-4" />}
              title="Pending Event & Miqaat Funds"
              subtitle="Ad-hoc committee & miqaat contributions"
            />
            <CardBody>
              {pendingContribs.length === 0 ? (
                <div className="rounded-xl border border-[#BBF7D0] bg-[#ECFDF5] p-6 text-center text-xs font-semibold text-[#166534]">
                  No pending event contributions assigned to your account.
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingContribs.map((c) => {
                    const checked = selectedContribIds.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors cursor-pointer",
                          checked
                            ? "border-[#6A1B1B] bg-[#FBF6EB]"
                            : "border-[#EAE2D6] bg-white hover:border-[#B8924A]"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleContrib(c.id)}
                            className="h-4 w-4 rounded border-[#B8924A] accent-[#6A1B1B]"
                          />
                          <div>
                            <p className="text-sm font-bold text-[#231917]">
                              {c.title}
                            </p>
                            <p className="text-[11px] text-[#7B6B63]">
                              Assigned {c.createdFormatted}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            tone={c.status === "PARTIAL" ? "warning" : "danger"}
                          >
                            {c.status}
                          </Badge>
                          <span className="font-mono text-sm font-bold text-[#6A1B1B] tabular-nums">
                            {formatRupees(c.due)}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      ) : null}

      {tab === "ALL" ? (
        <Card>
          <CardHeader
            title="Complete Monthly & Event Contribution Schedule"
            subtitle="All billed items and current settlement status"
          />
          <CardBody className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#EAE2D6] text-[11px] font-bold uppercase tracking-wider text-[#7B6B63]">
                  <th className="py-2.5 pr-4">Type</th>
                  <th className="py-2.5 px-4">Period / Campaign</th>
                  <th className="py-2.5 px-4 text-right">Assigned</th>
                  <th className="py-2.5 px-4 text-right">Paid</th>
                  <th className="py-2.5 px-4 text-right">Balance</th>
                  <th className="py-2.5 pl-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0E9DD]">
                {feeRecords.map((f) => (
                  <tr key={f.id}>
                    <td className="py-2.5 pr-4 text-xs text-[#7B6B63]">
                      Monthly Fee
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-[#231917]">
                      {f.label}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                      {formatRupees(f.amount)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-[#166534] tabular-nums">
                      {formatRupees(f.paidAmount)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-[#6A1B1B] tabular-nums">
                      {formatRupees(f.due)}
                    </td>
                    <td className="py-2.5 pl-4 text-right">
                      <Badge
                        tone={
                          f.status === "PAID"
                            ? "success"
                            : f.status === "PARTIAL"
                              ? "warning"
                              : "danger"
                        }
                      >
                        {f.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {contributions.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2.5 pr-4 text-xs text-[#7B6B63]">
                      Event Fund
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-[#231917]">
                      {c.title}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                      {formatRupees(c.amount)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-[#166534] tabular-nums">
                      {formatRupees(c.paidAmount)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-[#6A1B1B] tabular-nums">
                      {formatRupees(c.due)}
                    </td>
                    <td className="py-2.5 pl-4 text-right">
                      <Badge
                        tone={
                          c.status === "PAID"
                            ? "success"
                            : c.status === "PARTIAL"
                              ? "warning"
                              : "danger"
                        }
                      >
                        {c.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      ) : null}

      {tab === "HISTORY" ? (
        <Card>
          <CardHeader
            title="Payment Receipts & Transaction Ledger"
            subtitle="All recorded UPI & cash payments allocated to your account"
            action={
              <SearchInput
                value={txQuery}
                onChange={setTxQuery}
                placeholder="Search UTR or month…"
                className="w-64"
              />
            }
          />
          <CardBody className="overflow-x-auto">
            {filteredTransactions.length === 0 ? (
              <p className="py-8 text-center text-xs text-[#7B6B63]">
                No payment transactions recorded yet.
              </p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#EAE2D6] text-[11px] font-bold uppercase tracking-wider text-[#7B6B63]">
                    <th className="py-2.5 pr-4">Date &amp; Time</th>
                    <th className="py-2.5 px-4">Allocated Items</th>
                    <th className="py-2.5 px-4">Mode</th>
                    <th className="py-2.5 px-4">UTR / Reference</th>
                    <th className="py-2.5 pl-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0E9DD]">
                  {filteredTransactions.map((t) => (
                    <tr key={t.id}>
                      <td className="py-3 pr-4 text-xs text-[#5E4F4A] whitespace-nowrap">
                        {t.dateFormatted}
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-[#231917]">
                        {t.itemsSummary || t.note || "Contribution Payment"}
                      </td>
                      <td className="py-3 px-4">
                        <Badge tone="brass">{t.mode}</Badge>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-[#5E4F4A]">
                        {t.reference || "—"}
                      </td>
                      <td className="py-3 pl-4 text-right font-mono font-bold text-[#166534] tabular-nums">
                        {formatRupees(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>
      ) : null}

      {/* Unified UPI QR Scan & Pay Drawer */}
      <Drawer
        open={payDrawerOpen}
        onClose={() => setPayDrawerOpen(false)}
        title="Scan & Pay via UPI"
        subtitle={`${upiPayeeName} (${upiId})`}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setPayDrawerOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={submitting}
              onClick={handleConfirmUpiPayment}
            >
              Submit Payment &amp; UTR
            </Button>
          </>
        }
      >
        <form onSubmit={handleConfirmUpiPayment} className="space-y-5">
          <div className="flex flex-col items-center rounded-2xl border border-[#D9C398] bg-[#FBF6EB] p-5 text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-[#6A1B1B]">
              Total Payable Amount
            </p>
            <p className="mt-1 font-mono text-3xl font-bold text-[#231917] tabular-nums">
              {formatRupees(selectedTotal)}
            </p>
            <div className="my-4 rounded-2xl border border-[#E5DDD0] bg-white p-4 shadow-xs">
              <QRCode value={upiDeepLink} size={184} />
            </div>
            <p className="text-xs font-semibold text-[#3D2E2A]">
              UPI ID: <span className="font-mono">{upiId}</span>
            </p>
            <p className="mt-0.5 text-[11px] text-[#7B6B63]">
              Remark: <span className="font-mono">{upiNote}</span>
            </p>
          </div>

          <Input
            label="12-Digit UPI UTR / Transaction Reference"
            placeholder="Enter UTR after completing payment in GPay / PhonePe"
            value={utrReference}
            onChange={(e) => setUtrReference(e.target.value)}
            required
          />

          <Input
            label="Optional Note"
            placeholder="Any additional remark"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </form>
      </Drawer>
    </div>
  );
}
