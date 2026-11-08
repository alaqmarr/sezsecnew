"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Edit3,
  Plus,
  Receipt,
  RotateCcw,
  Sparkles,
  Trash2,
  Wallet,
} from "lucide-react";
import {
  createEventContributionCampaignAction,
  deleteContributionCampaignByTitleAction,
  deleteEventContributionAction,
  generateMonthlyFeesAction,
  recordMemberPaymentAction,
  revokeFeeTransactionAction,
  updateMemberMonthlyFeeConfigAction,
} from "@/app/actions/finance.actions";
import {
  formatRupees,
  MONTH_NAMES_FULL,
  MONTH_NAMES_SHORT,
} from "@sezsec/shared";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  Drawer,
  Input,
  Modal,
  SearchInput,
  Select,
  Tabs,
  notify,
} from "@sezsec/ui";

interface AdminMemberRow {
  id: string;
  name: string;
  username: string;
  its: string;
  monthlyRate: number;
}

interface AdminFeeRec {
  id: string;
  userId: string;
  month: number;
  year: number;
  amount: number;
  paidAmount: number;
  status: "PENDING" | "PARTIAL" | "PAID";
}

interface AdminContribRec {
  id: string;
  userId: string;
  memberName: string;
  its: string;
  title: string;
  amount: number;
  paidAmount: number;
  status: "PENDING" | "PARTIAL" | "PAID";
  createdFormatted: string;
}

interface AdminTxRec {
  id: string;
  memberName: string;
  its: string;
  amount: number;
  mode: string;
  reference: string;
  note: string;
  dateFormatted: string;
  allocationsText: string;
}

export function FeesAdminClient({
  currentMonth,
  currentYear,
  members,
  feeRecords,
  contributions,
  transactions,
}: {
  currentMonth: number;
  currentYear: number;
  members: AdminMemberRow[];
  feeRecords: AdminFeeRec[];
  contributions: AdminContribRec[];
  transactions: AdminTxRec[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"MONTHLY" | "CAMPAIGNS" | "TRANSACTIONS">(
    "MONTHLY"
  );
  const [selectedMonth, setSelectedMonth] = useState(String(currentMonth));
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [query, setQuery] = useState("");
  const [generating, setGenerating] = useState(false);

  // Edit member rate modal
  const [rateTarget, setRateTarget] = useState<AdminMemberRow | null>(null);
  const [newRateValue, setNewRateValue] = useState("");
  const [savingRate, setSavingRate] = useState(false);

  // Record payment drawer
  const [payMember, setPayMember] = useState<AdminMemberRow | null>(null);
  const [payFeeIds, setPayFeeIds] = useState<string[]>([]);
  const [payContribIds, setPayContribIds] = useState<string[]>([]);
  const [payMode, setPayMode] = useState<"CASH" | "UPI" | "BANK">("CASH");
  const [payRef, setPayRef] = useState("");
  const [payNote, setPayNote] = useState("");
  const [recordingPay, setRecordingPay] = useState(false);

  // Campaign creation modal
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [campaignTitle, setCampaignTitle] = useState("");
  const [campaignAmount, setCampaignAmount] = useState("");
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [selectedCampaignFilter, setSelectedCampaignFilter] = useState("ALL");

  // Revoke transaction confirmation
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  const monthNum = Number(selectedMonth);
  const yearNum = Number(selectedYear);

  const feeByUserForPeriod = useMemo(() => {
    const map = new Map<string, AdminFeeRec>();
    for (const r of feeRecords) {
      if (r.month === monthNum && r.year === yearNum) {
        map.set(r.userId, r);
      }
    }
    return map;
  }, [feeRecords, monthNum, yearNum]);

  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.username.toLowerCase().includes(q) ||
        m.its.toLowerCase().includes(q)
    );
  }, [members, query]);

  const campaignTitles = useMemo(
    () => [...new Set(contributions.map((c) => c.title))],
    [contributions]
  );

  const filteredContribs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contributions.filter((c) => {
      if (
        selectedCampaignFilter !== "ALL" &&
        c.title !== selectedCampaignFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        c.memberName.toLowerCase().includes(q) ||
        c.its.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q)
      );
    });
  }, [contributions, selectedCampaignFilter, query]);

  const memberPendingFees = useMemo(
    () =>
      payMember
        ? feeRecords.filter(
            (r) => r.userId === payMember.id && r.amount - r.paidAmount > 0
          )
        : [],
    [payMember, feeRecords]
  );

  const memberPendingContribs = useMemo(
    () =>
      payMember
        ? contributions.filter(
            (c) => c.userId === payMember.id && c.amount - c.paidAmount > 0
          )
        : [],
    [payMember, contributions]
  );

  async function handleGenerateMonth() {
    setGenerating(true);
    try {
      const res = await generateMonthlyFeesAction({
        month: monthNum,
        year: yearNum,
      });
      if (!res.ok) {
        notify.error("Generation failed", res.error);
        return;
      }
      notify.success(
        `Generated ${res.createdCount} record(s) for ${MONTH_NAMES_FULL[monthNum]} ${yearNum}`
      );
      router.refresh();
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveMemberRate(e: React.FormEvent) {
    e.preventDefault();
    if (!rateTarget) return;
    setSavingRate(true);
    try {
      const res = await updateMemberMonthlyFeeConfigAction({
        userId: rateTarget.id,
        amount: Number(newRateValue || 0),
      });
      if (!res.ok) {
        notify.error("Could not update rate", res.error);
        return;
      }
      notify.success(`Updated monthly rate for ${rateTarget.name}`);
      setRateTarget(null);
      router.refresh();
    } finally {
      setSavingRate(false);
    }
  }

  function openPaymentDrawer(member: AdminMemberRow) {
    setPayMember(member);
    const currentRec = feeByUserForPeriod.get(member.id);
    setPayFeeIds(
      currentRec && currentRec.amount > currentRec.paidAmount
        ? [currentRec.id]
        : []
    );
    setPayContribIds([]);
    setPayMode("CASH");
    setPayRef("");
    setPayNote("");
  }

  async function handleRecordAdminPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payMember) return;
    setRecordingPay(true);
    try {
      const res = await recordMemberPaymentAction({
        userId: payMember.id,
        feeRecordIds: payFeeIds,
        contributionIds: payContribIds,
        mode: payMode,
        reference: payRef,
        note: payNote,
      });
      if (!res.ok) {
        notify.error("Could not record payment", res.error);
        return;
      }
      notify.success(`Payment recorded for ${payMember.name}`);
      setPayMember(null);
      router.refresh();
    } finally {
      setRecordingPay(false);
    }
  }

  async function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault();
    setCreatingCampaign(true);
    try {
      const res = await createEventContributionCampaignAction({
        title: campaignTitle,
        amount: Number(campaignAmount || 0),
      });
      if (!res.ok) {
        notify.error("Failed to create campaign", res.error);
        return;
      }
      notify.success(
        `Assigned "${campaignTitle}" to ${res.createdCount} members`
      );
      setCampaignTitle("");
      setCampaignAmount("");
      setCampaignOpen(false);
      router.refresh();
    } finally {
      setCreatingCampaign(false);
    }
  }

  async function handleConfirmRevoke() {
    if (!revokeId) return;
    setRevoking(true);
    try {
      const res = await revokeFeeTransactionAction(revokeId);
      if (!res.ok) {
        notify.error("Could not revoke transaction", res.error);
        return;
      }
      notify.success("Transaction revoked & member balances restored");
      setRevokeId(null);
      router.refresh();
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          tabs={[
            {
              id: "MONTHLY",
              label: "Monthly Fee Matrix",
              count: members.length,
              icon: <Wallet className="h-3.5 w-3.5" />,
            },
            {
              id: "CAMPAIGNS",
              label: "Event Contribution Funds",
              count: contributions.length,
              icon: <Receipt className="h-3.5 w-3.5" />,
            },
            {
              id: "TRANSACTIONS",
              label: "Transactions & Revocation",
              count: transactions.length,
            },
          ]}
          activeTab={tab}
          onChange={setTab}
        />

        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search member or campaign…"
          className="w-full sm:w-80"
        />
      </div>

      {tab === "MONTHLY" ? (
        <Card>
          <CardHeader
            title={`${MONTH_NAMES_FULL[monthNum]} ${yearNum} — Monthly Contributions`}
            subtitle="Configure monthly rates, generate bills for the selected month, or record direct settlements"
            action={
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-36">
                  <Select
                    value={selectedMonth}
                    onChange={setSelectedMonth}
                    options={MONTH_NAMES_FULL.map((m, idx) => ({
                      value: String(idx),
                      label: m,
                    }))}
                  />
                </div>
                <div className="w-28">
                  <Select
                    value={selectedYear}
                    onChange={setSelectedYear}
                    options={[
                      currentYear - 2,
                      currentYear - 1,
                      currentYear,
                      currentYear + 1,
                    ].map((y) => ({
                      value: String(y),
                      label: String(y),
                    }))}
                  />
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  loading={generating}
                  icon={<Sparkles className="h-3.5 w-3.5" />}
                  onClick={handleGenerateMonth}
                >
                  Generate {MONTH_NAMES_SHORT[monthNum]} Bills
                </Button>
              </div>
            }
          />
          <CardBody className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#EAE2D6] text-[11px] font-bold uppercase tracking-wider text-[#7B6B63]">
                  <th className="py-2.5 pr-4">Member</th>
                  <th className="py-2.5 px-4 text-right">Monthly Rate</th>
                  <th className="py-2.5 px-4 text-right"> Period Bill</th>
                  <th className="py-2.5 px-4 text-right">Paid</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 pl-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0E9DD]">
                {filteredMembers.map((m) => {
                  const rec = feeByUserForPeriod.get(m.id);
                  return (
                    <tr key={m.id} className="hover:bg-[#FAF7F2]/60">
                      <td className="py-3 pr-4">
                        <div className="font-bold text-[#231917]">{m.name}</div>
                        <div className="text-[11px] text-[#7B6B63]">
                          {m.its ? `ITS ${m.its}` : `@${m.username}`}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                        {formatRupees(m.monthlyRate)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                        {rec ? formatRupees(rec.amount) : "—"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-[#166534] tabular-nums">
                        {rec ? formatRupees(rec.paidAmount) : "—"}
                      </td>
                      <td className="py-3 px-4">
                        {rec ? (
                          <Badge
                            tone={
                              rec.status === "PAID"
                                ? "success"
                                : rec.status === "PARTIAL"
                                  ? "warning"
                                  : "danger"
                            }
                          >
                            {rec.status}
                          </Badge>
                        ) : (
                          <Badge tone="neutral">Not Billed</Badge>
                        )}
                      </td>
                      <td className="py-3 pl-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Button
                            size="xs"
                            variant="secondary"
                            icon={<Edit3 className="h-3 w-3" />}
                            onClick={() => {
                              setRateTarget(m);
                              setNewRateValue(String(m.monthlyRate));
                            }}
                          >
                            Rate
                          </Button>
                          <Button
                            size="xs"
                            variant="brass"
                            onClick={() => openPaymentDrawer(m)}
                          >
                            Collect
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardBody>
        </Card>
      ) : null}

      {tab === "CAMPAIGNS" ? (
        <Card>
          <CardHeader
            title="Event & Miqaat Contribution Funds"
            subtitle="Create ad-hoc contribution campaigns across committee members"
            action={
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-56">
                  <Select
                    value={selectedCampaignFilter}
                    onChange={setSelectedCampaignFilter}
                    options={[
                      { value: "ALL", label: "All Campaigns" },
                      ...campaignTitles.map((t) => ({ value: t, label: t })),
                    ]}
                  />
                </div>
                {selectedCampaignFilter !== "ALL" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      const res = await deleteContributionCampaignByTitleAction(
                        selectedCampaignFilter
                      );
                      if (res.ok) {
                        notify.success(
                          `Removed ${res.deletedCount} unpaid records`
                        );
                        setSelectedCampaignFilter("ALL");
                        router.refresh();
                      }
                    }}
                  >
                    Clean Unpaid
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="primary"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() => setCampaignOpen(true)}
                >
                  New Event Fund
                </Button>
              </div>
            }
          />
          <CardBody className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#EAE2D6] text-[11px] font-bold uppercase tracking-wider text-[#7B6B63]">
                  <th className="py-2.5 pr-4">Campaign</th>
                  <th className="py-2.5 px-4">Member</th>
                  <th className="py-2.5 px-4 text-right">Amount</th>
                  <th className="py-2.5 px-4 text-right">Paid</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 pl-4 text-right">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0E9DD]">
                {filteredContribs.map((c) => (
                  <tr key={c.id}>
                    <td className="py-3 pr-4 font-semibold text-[#231917]">
                      {c.title}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-[#231917]">
                        {c.memberName}
                      </div>
                      <div className="text-[11px] text-[#7B6B63]">{c.its}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {formatRupees(c.amount)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-[#166534] tabular-nums">
                      {formatRupees(c.paidAmount)}
                    </td>
                    <td className="py-3 px-4">
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
                    <td className="py-3 pl-4 text-right">
                      <Button
                        size="xs"
                        variant="ghost"
                        disabled={c.paidAmount > 0}
                        onClick={async () => {
                          const res = await deleteEventContributionAction(c.id);
                          if (res.ok) {
                            notify.info("Contribution entry removed");
                            router.refresh();
                          }
                        }}
                        icon={<Trash2 className="h-3.5 w-3.5 text-[#991B1B]" />}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      ) : null}

      {tab === "TRANSACTIONS" ? (
        <Card>
          <CardHeader
            title="Recorded Payment Transactions"
            subtitle="Revoking a transaction safely restores unpaid balances on every linked monthly fee or event fund"
          />
          <CardBody className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#EAE2D6] text-[11px] font-bold uppercase tracking-wider text-[#7B6B63]">
                  <th className="py-2.5 pr-4">Date</th>
                  <th className="py-2.5 px-4">Member</th>
                  <th className="py-2.5 px-4">Allocations</th>
                  <th className="py-2.5 px-4">Mode / Ref</th>
                  <th className="py-2.5 px-4 text-right">Amount</th>
                  <th className="py-2.5 pl-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0E9DD]">
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td className="py-3 pr-4 text-xs text-[#5E4F4A] whitespace-nowrap">
                      {t.dateFormatted}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#231917]">
                        {t.memberName}
                      </div>
                      <div className="text-[11px] text-[#7B6B63]">{t.its}</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-[#3D2E2A]">
                      {t.allocationsText || t.note || "—"}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <Badge tone="brass">{t.mode}</Badge>
                      {t.reference ? (
                        <span className="ml-2 font-mono text-[#7B6B63]">
                          {t.reference}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[#166534] tabular-nums">
                      {formatRupees(t.amount)}
                    </td>
                    <td className="py-3 pl-4 text-right">
                      <Button
                        size="xs"
                        variant="secondary"
                        icon={<RotateCcw className="h-3 w-3 text-[#991B1B]" />}
                        onClick={() => setRevokeId(t.id)}
                      >
                        Revoke
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      ) : null}

      {/* Edit Rate Modal */}
      <Modal
        open={Boolean(rateTarget)}
        onClose={() => setRateTarget(null)}
        title={`Monthly Contribution Rate — ${rateTarget?.name || ""}`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRateTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={savingRate}
              onClick={handleSaveMemberRate}
            >
              Save Rate
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveMemberRate} className="space-y-4">
          <Input
            label="Default Monthly Contribution (INR)"
            type="number"
            min={0}
            value={newRateValue}
            onChange={(e) => setNewRateValue(e.target.value)}
            required
          />
        </form>
      </Modal>

      {/* New Campaign Modal */}
      <Modal
        open={campaignOpen}
        onClose={() => setCampaignOpen(false)}
        title="Launch Event Contribution Fund"
        subtitle="Creates a pending contribution entry for all committee members"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCampaignOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={creatingCampaign}
              onClick={handleCreateCampaign}
            >
              Assign to All Members
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateCampaign} className="space-y-4">
          <Input
            label="Campaign / Occasion Title"
            placeholder="e.g. Shehrullah Khidmat Fund 1448H"
            value={campaignTitle}
            onChange={(e) => setCampaignTitle(e.target.value)}
            required
          />
          <Input
            label="Per-Member Contribution Amount (INR)"
            type="number"
            min={1}
            placeholder="e.g. 1000"
            value={campaignAmount}
            onChange={(e) => setCampaignAmount(e.target.value)}
            required
          />
        </form>
      </Modal>

      {/* Collect Payment Drawer */}
      <Drawer
        open={Boolean(payMember)}
        onClose={() => setPayMember(null)}
        title={`Collect Payment — ${payMember?.name || ""}`}
        subtitle={payMember?.its ? `ITS ${payMember.its}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPayMember(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={recordingPay}
              disabled={payFeeIds.length === 0 && payContribIds.length === 0}
              onClick={handleRecordAdminPayment}
            >
              Record Settlement
            </Button>
          </>
        }
      >
        <form onSubmit={handleRecordAdminPayment} className="space-y-5">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-[#6A1B1B]">
              Unpaid Monthly Fees
            </p>
            {memberPendingFees.length === 0 ? (
              <p className="text-xs text-[#7B6B63]">No pending monthly bills.</p>
            ) : (
              memberPendingFees.map((f) => {
                const due = f.amount - f.paidAmount;
                return (
                  <label
                    key={f.id}
                    className="flex items-center justify-between rounded-xl border border-[#EAE2D6] px-3.5 py-2.5 text-xs cursor-pointer"
                  >
                    <span className="flex items-center gap-2 font-semibold">
                      <input
                        type="checkbox"
                        checked={payFeeIds.includes(f.id)}
                        onChange={() =>
                          setPayFeeIds((prev) =>
                            prev.includes(f.id)
                              ? prev.filter((x) => x !== f.id)
                              : [...prev, f.id]
                          )
                        }
                        className="accent-[#6A1B1B]"
                      />
                      {MONTH_NAMES_FULL[f.month]} {f.year}
                    </span>
                    <span className="font-mono font-bold text-[#6A1B1B]">
                      {formatRupees(due)}
                    </span>
                  </label>
                );
              })
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-[#6A1B1B]">
              Unpaid Event Funds
            </p>
            {memberPendingContribs.length === 0 ? (
              <p className="text-xs text-[#7B6B63]">No pending event funds.</p>
            ) : (
              memberPendingContribs.map((c) => {
                const due = c.amount - c.paidAmount;
                return (
                  <label
                    key={c.id}
                    className="flex items-center justify-between rounded-xl border border-[#EAE2D6] px-3.5 py-2.5 text-xs cursor-pointer"
                  >
                    <span className="flex items-center gap-2 font-semibold">
                      <input
                        type="checkbox"
                        checked={payContribIds.includes(c.id)}
                        onChange={() =>
                          setPayContribIds((prev) =>
                            prev.includes(c.id)
                              ? prev.filter((x) => x !== c.id)
                              : [...prev, c.id]
                          )
                        }
                        className="accent-[#6A1B1B]"
                      />
                      {c.title}
                    </span>
                    <span className="font-mono font-bold text-[#6A1B1B]">
                      {formatRupees(due)}
                    </span>
                  </label>
                );
              })
            )}
          </div>

          <Select
            label="Payment Mode"
            value={payMode}
            onChange={(v) => setPayMode(v as "CASH" | "UPI" | "BANK")}
            options={[
              { value: "CASH", label: "Cash" },
              { value: "UPI", label: "UPI Transfer" },
              { value: "BANK", label: "Bank Transfer" },
            ]}
          />
          <Input
            label="UTR / Receipt Reference (Optional)"
            value={payRef}
            onChange={(e) => setPayRef(e.target.value)}
          />
          <Input
            label="Admin Note (Optional)"
            value={payNote}
            onChange={(e) => setPayNote(e.target.value)}
          />
        </form>
      </Drawer>

      {/* Revoke Transaction Dialog */}
      <ConfirmDialog
        open={Boolean(revokeId)}
        onClose={() => setRevokeId(null)}
        onConfirm={handleConfirmRevoke}
        loading={revoking}
        title="Revoke Payment Transaction?"
        confirmLabel="Revoke & Restore Balances"
        description="This reverses every allocation from this transaction and sets the corresponding monthly fees or event funds back to Pending / Partial."
      />
    </div>
  );
}
