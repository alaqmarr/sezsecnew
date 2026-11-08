"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  Edit3,
  Lock,
  MapPin,
  Sparkles,
  Utensils,
} from "lucide-react";
import { updateMenuThaalCountAction } from "@/app/actions/public.actions";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Drawer,
  Input,
  KeelArchBanner,
  StatTile,
  notify,
} from "@sezsec/ui";

interface MenuEventViewProps {
  id: string;
  title: string;
  dateFormatted: string;
  isToday: boolean;
  occasionTime: string;
  misriEn: string;
  misriAr: string;
  menuText: string;
  halls: string[];
  expectedThaals: number;
  totalThaalsDone: number | null;
  hallCounts: Record<string, number>;
  revealTimestampMs: number;
}

export function MenuThaalClient({
  event,
  canAdminOverrideTotal,
  editableHalls,
  isSignedIn,
}: {
  event: MenuEventViewProps;
  canAdminOverrideTotal: boolean;
  editableHalls: string[];
  isSignedIn: boolean;
}) {
  const router = useRouter();
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftCounts, setDraftCounts] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const h of event.halls) {
      map[h] =
        event.hallCounts[h] !== undefined ? String(event.hallCounts[h]) : "";
    }
    return map;
  });
  const [manualOverride, setManualOverride] = useState<string>(
    event.totalThaalsDone !== null ? String(event.totalThaalsDone) : ""
  );
  const [useOverride, setUseOverride] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const canEditThaals = editableHalls.length > 0 || canAdminOverrideTotal;
  const msUntilReveal = event.revealTimestampMs - nowMs;
  const isRevealedToPublic = msUntilReveal <= 0;
  const within24Hours = msUntilReveal > 0 && msUntilReveal <= 24 * 3_600_000;

  const menuLines = event.menuText
    .split(/\r?\n|,/)
    .map((s) => s.trim())
    .filter(Boolean);

  const computedHallSum = Object.values(event.hallCounts).reduce(
    (s, n) => s + (Number(n) || 0),
    0
  );
  const actualServed = event.totalThaalsDone ?? computedHallSum;

  const countdownParts =
    msUntilReveal > 0
      ? {
          hours: Math.floor(msUntilReveal / 3_600_000),
          mins: Math.floor((msUntilReveal % 3_600_000) / 60_000),
          secs: Math.floor((msUntilReveal % 60_000) / 1000),
        }
      : null;

  async function handleSaveThaals(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const hallCountsPayload: Record<string, number> = {};
      for (const h of editableHalls) {
        if (draftCounts[h] !== undefined && draftCounts[h] !== "") {
          hallCountsPayload[h] = Math.max(0, Math.round(Number(draftCounts[h]) || 0));
        }
      }

      const res = await updateMenuThaalCountAction({
        eventId: event.id,
        hallCounts: hallCountsPayload,
        ...(canAdminOverrideTotal && useOverride && manualOverride !== ""
          ? { totalOverride: Math.max(0, Math.round(Number(manualOverride) || 0)) }
          : {}),
      });

      if (!res.ok) {
        notify.error("Could not update thaal count", res.error);
        return;
      }

      notify.success("Thaal counts updated on Jamaat Events");
      setDrawerOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top KPI Strip — Full Width */}
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Occasion Timing"
          value={event.occasionTime}
          sublabel={event.dateFormatted}
          icon={<Clock className="h-5 w-5" />}
          tone="maroon"
        />
        <StatTile
          label="Expected Thaals"
          value={event.expectedThaals}
          sublabel="Planned Jamaat capacity"
          icon={<Utensils className="h-5 w-5" />}
          tone="brass"
        />
        <StatTile
          label="Actual Thaals Served"
          value={actualServed > 0 ? actualServed : "—"}
          sublabel={
            actualServed > 0
              ? `${Math.round((actualServed / Math.max(1, event.expectedThaals)) * 100)}% of expected`
              : "Updated during jaman"
          }
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="sage"
        />
        <StatTile
          label="Allocated Halls"
          value={event.halls.length}
          sublabel={event.halls.join(", ") || "Jamaat Khana"}
          icon={<MapPin className="h-5 w-5" />}
        />
      </div>

      {/* Main 12-Column Split: Menu Card + Hall-wise Thaal Table */}
      <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Menu Card */}
        <Card doubleFrame className="lg:col-span-6">
          <CardHeader
            icon={<Utensils className="h-4 w-4" />}
            title="Mawaid / Niyaz Menu"
            subtitle={event.misriEn}
            action={
              <span dir="rtl" className="font-arabic text-lg text-[#6A1B1B]">
                {event.misriAr}
              </span>
            }
          />
          <CardBody className="space-y-4">
            <KeelArchBanner
              arabicTitle="بسم الله الرحمن الرحيم"
              subtitle={event.title}
            />

            {isRevealedToPublic || canEditThaals ? (
              <div className="space-y-3">
                {!isRevealedToPublic && canEditThaals ? (
                  <div className="flex items-center gap-2 rounded-xl border border-[#D9C398] bg-[#FBF6EB] px-3.5 py-2 text-xs font-semibold text-[#6A1B1B]">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>
                      Committee Preview — Public reveal opens 30 minutes before{" "}
                      {event.occasionTime}.
                    </span>
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {menuLines.map((item, idx) => (
                    <div
                      key={`${item}-${idx}`}
                      className="flex items-center gap-3 rounded-xl border border-[#EAE2D6] bg-[#FAF7F2] px-4 py-3"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#6A1B1B] text-[11px] font-bold text-[#FAF7F2]">
                        {idx + 1}
                      </span>
                      <span className="text-sm font-semibold text-[#231917]">
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-[#D9C398] bg-[#FBF6EB] px-6 py-10 text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#6A1B1B] text-[#FAF7F2]">
                  <Lock className="h-5 w-5" />
                </div>
                <h3 className="font-editorial text-2xl font-bold text-[#231917]">
                  Menu Opens 30 Minutes Before Jaman
                </h3>
                <p className="mt-1 text-xs text-[#5E4F4A]">
                  Scheduled for {event.dateFormatted} at {event.occasionTime}.
                </p>
                {within24Hours && countdownParts ? (
                  <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#D9C398] bg-white px-4 py-2 font-mono text-base font-bold text-[#6A1B1B] tabular-nums">
                    <span>
                      {String(countdownParts.hours).padStart(2, "0")}h
                    </span>
                    <span>:</span>
                    <span>{String(countdownParts.mins).padStart(2, "0")}m</span>
                    <span>:</span>
                    <span>{String(countdownParts.secs).padStart(2, "0")}s</span>
                  </div>
                ) : null}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Hall-Wise Thaal Counts Table */}
        <Card className="lg:col-span-6">
          <CardHeader
            icon={<MapPin className="h-4 w-4" />}
            title="Hall-Wise Thaals Served"
            subtitle="Live floor tally synchronized with Jamaat Bookings"
            action={
              canEditThaals ? (
                <Button
                  size="sm"
                  variant="primary"
                  icon={<Edit3 className="h-3.5 w-3.5" />}
                  onClick={() => setDrawerOpen(true)}
                >
                  Enter Thaal Count
                </Button>
              ) : !isSignedIn ? (
                <Link href="/login?callbackUrl=/menu">
                  <Button size="xs" variant="secondary">
                    Floor In-Charge Sign In
                  </Button>
                </Link>
              ) : null
            }
          />
          <CardBody>
            {event.halls.length === 0 ? (
              <p className="text-sm text-[#7B6B63]">
                No specific halls listed for this occasion.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#EAE2D6] text-[11px] font-bold uppercase tracking-wider text-[#7B6B63]">
                      <th className="py-2.5 pr-4">Hall / Floor Venue</th>
                      <th className="py-2.5 px-4">Access</th>
                      <th className="py-2.5 pl-4 text-right">Thaals Done</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0E9DD]">
                    {event.halls.map((hallName) => {
                      const val = event.hallCounts[hallName];
                      const canEditThis = editableHalls.includes(hallName);
                      return (
                        <tr key={hallName}>
                          <td className="py-3 pr-4 font-semibold text-[#231917]">
                            {hallName}
                          </td>
                          <td className="py-3 px-4">
                            {canEditThis ? (
                              <Badge tone="success">Editable</Badge>
                            ) : (
                              <Badge tone="neutral">View Only</Badge>
                            )}
                          </td>
                          <td className="py-3 pl-4 text-right font-mono font-bold text-[#6A1B1B] tabular-nums">
                            {val !== undefined ? val : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-[#D9C398] bg-[#FBF6EB]">
                      <td
                        colSpan={2}
                        className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-[#6A1B1B]"
                      >
                        Total Thaals Served
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-base font-bold text-[#6A1B1B] tabular-nums">
                        {actualServed}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Thaal Count Entry Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Update Actual Thaals Served"
        subtitle={event.title}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setDrawerOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={saving}
              onClick={handleSaveThaals}
            >
              Save Thaal Counts
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveThaals} className="space-y-4">
          <p className="text-xs leading-relaxed text-[#5E4F4A]">
            Enter the actual number of thaals served in your assigned hall(s).
            Updates sync immediately over the internal server bridge to Jamaat
            Events.
          </p>

          <div className="space-y-3">
            {event.halls.map((hallName) => {
              const editable = editableHalls.includes(hallName);
              return (
                <Input
                  key={hallName}
                  label={hallName}
                  type="number"
                  min={0}
                  disabled={!editable}
                  placeholder={editable ? "Enter thaal count" : "Restricted hall"}
                  value={draftCounts[hallName] ?? ""}
                  onChange={(e) =>
                    setDraftCounts((prev) => ({
                      ...prev,
                      [hallName]: e.target.value,
                    }))
                  }
                  hint={
                    !editable
                      ? "Requires hall-specific permission module"
                      : undefined
                  }
                />
              );
            })}
          </div>

          {canAdminOverrideTotal ? (
            <div className="space-y-2.5 rounded-xl border border-[#D9C398] bg-[#FBF6EB] p-4">
              <label className="flex items-center gap-2 text-xs font-bold text-[#6A1B1B] cursor-pointer">
                <input
                  type="checkbox"
                  checked={useOverride}
                  onChange={(e) => setUseOverride(e.target.checked)}
                  className="rounded border-[#B8924A]"
                />
                <span>Override Total Thaals Manually (Admin Only)</span>
              </label>
              {useOverride ? (
                <Input
                  type="number"
                  min={0}
                  value={manualOverride}
                  onChange={(e) => setManualOverride(e.target.value)}
                  placeholder="Total thaals served across all halls"
                />
              ) : null}
            </div>
          ) : null}
        </form>
      </Drawer>
    </div>
  );
}
