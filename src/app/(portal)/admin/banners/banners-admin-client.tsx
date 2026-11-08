"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Crosshair, Edit2, Plus, Trash2 } from "lucide-react";
import {
  deleteBannerAction,
  saveBannerAction,
  toggleBannerActiveAction,
} from "@/app/actions/community.actions";
import { cn, formatIST } from "@sezsec/shared";
import {
  Badge,
  Button,
  ConfirmDialog,
  ImageUploader,
  Input,
  Modal,
  Select,
  Toggle,
  notify,
} from "@sezsec/ui";

interface BannerItem {
  id: string;
  imageUrl: string;
  href: string;
  isActive: boolean;
  countdownTarget: string | null;
  countdownLabel: string;
  x: number;
  y: number;
  countdownSize: string;
  countdownColor: string;
  createdAt: string;
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function BannersAdminClient({ banners }: { banners: BannerItem[] }) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingBanner, setDeletingBanner] = useState<BannerItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({
    id: "" as string | undefined,
    imageUrl: "",
    href: "",
    isActive: true,
    countdownTargetLocal: "",
    countdownLabel: "",
    x: 50,
    y: 50,
    countdownSize: "normal",
    countdownColor: "gold",
  });

  function openNew() {
    setForm({
      id: undefined,
      imageUrl: "",
      href: "",
      isActive: true,
      countdownTargetLocal: "",
      countdownLabel: "",
      x: 50,
      y: 50,
      countdownSize: "normal",
      countdownColor: "gold",
    });
    setModalOpen(true);
  }

  function openEdit(b: BannerItem) {
    setForm({
      id: b.id,
      imageUrl: b.imageUrl,
      href: b.href,
      isActive: b.isActive,
      countdownTargetLocal: toDatetimeLocal(b.countdownTarget),
      countdownLabel: b.countdownLabel,
      x: b.x,
      y: b.y,
      countdownSize: b.countdownSize,
      countdownColor: b.countdownColor,
    });
    setModalOpen(true);
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const pctX = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const pctY = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    setForm((prev) => ({
      ...prev,
      x: Math.min(95, Math.max(5, pctX)),
      y: Math.min(92, Math.max(8, pctY)),
    }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.imageUrl.trim()) {
      notify.error("Please upload or paste a banner image");
      return;
    }
    setSaving(true);
    try {
      const res = await saveBannerAction({
        id: form.id,
        imageUrl: form.imageUrl,
        href: form.href,
        isActive: form.isActive,
        countdownTarget: form.countdownTargetLocal
          ? new Date(form.countdownTargetLocal).toISOString()
          : null,
        countdownLabel: form.countdownLabel,
        x: form.x,
        y: form.y,
        countdownSize: form.countdownSize,
        countdownColor: form.countdownColor,
      });
      if (!res.ok) {
        notify.error("Save failed", res.error);
        return;
      }
      notify.success("Banner saved");
      setModalOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(banner: BannerItem, next: boolean) {
    setTogglingId(banner.id);
    try {
      const res = await toggleBannerActiveAction({
        bannerId: banner.id,
        isActive: next,
      });
      if (!res.ok) {
        notify.error("Toggle failed", res.error);
        return;
      }
      router.refresh();
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete() {
    if (!deletingBanner) return;
    setDeleting(true);
    try {
      const res = await deleteBannerAction(deletingBanner.id);
      if (!res.ok) {
        notify.error("Delete failed", res.error);
        return;
      }
      notify.info("Banner removed");
      setDeletingBanner(null);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E5DDD0] bg-white px-5 py-4">
        <span className="text-sm text-[#4E3F3A]">
          Active banners appear on the homepage in a strict{" "}
          <strong>4:1 ratio</strong> so 100% of the artwork stays fully visible
          across every mobile, tablet, and desktop screen size.
        </span>
        <Button
          variant="primary"
          size="sm"
          icon={<Plus className="h-4 w-4" />}
          onClick={openNew}
        >
          Add Banner
        </Button>
      </div>

      {banners.length === 0 ? (
        <div className="rounded-2xl border border-[#E5DDD0] bg-white px-6 py-12 text-center text-sm text-[#7B6B63]">
          No banners uploaded yet.
        </div>
      ) : (
        <div className="divide-y divide-[#E5DDD0] rounded-2xl border border-[#E5DDD0] bg-white">
          {banners.map((b) => (
            <div
              key={b.id}
              className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="aspect-[4/1] w-full shrink-0 overflow-hidden rounded-xl border border-[#DCD2C2] bg-[#F3EFE6] sm:w-80">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={b.imageUrl}
                    alt={b.countdownLabel || "Banner"}
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#231917]">
                      {b.countdownLabel || "Homepage Banner"}
                    </span>
                    <Badge tone={b.isActive ? "emerald" : "neutral"}>
                      {b.isActive ? "Active" : "Hidden"}
                    </Badge>
                  </div>
                  {b.countdownTarget ? (
                    <p className="text-xs text-[#5E4F4A]">
                      Countdown to{" "}
                      <strong>
                        {formatIST(b.countdownTarget, "dd MMM yyyy, hh:mm a")}
                      </strong>{" "}
                      at ({Math.round(b.x)}%, {Math.round(b.y)}%)
                    </p>
                  ) : (
                    <p className="text-xs text-[#8C7B73]">
                      Static banner (no countdown timer)
                    </p>
                  )}
                  {b.href ? (
                    <p className="text-xs text-[#6A1B1B]">{b.href}</p>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <Toggle
                  checked={b.isActive}
                  loading={togglingId === b.id}
                  onChange={(next) => handleToggle(b, next)}
                  label="Live"
                />
                <Button
                  size="xs"
                  variant="secondary"
                  icon={<Edit2 className="h-3.5 w-3.5" />}
                  onClick={() => openEdit(b)}
                >
                  Edit
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => setDeletingBanner(b)}
                  icon={<Trash2 className="h-3.5 w-3.5 text-[#991B1B]" />}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.id ? "Edit Banner" : "New Homepage Banner"}
        size="xl"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setModalOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              Save Banner
            </Button>
          </>
        }
      >
        <form onSubmit={handleSave} className="space-y-4">
          <ImageUploader
            label="Banner Image — 4:1 Ratio (100% Visible Across All Screen Sizes)"
            aspectRatio={4}
            hint="Upload any banner image (4:1 ratio recommended, e.g. 1920×480 px)"
            value={form.imageUrl}
            onChange={(url) => setForm({ ...form, imageUrl: url })}
          />

          {form.imageUrl && form.countdownTargetLocal ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-[#5E4F4A]">
                <span className="inline-flex items-center gap-1.5 font-semibold text-[#6A1B1B]">
                  <Crosshair className="h-3.5 w-3.5" />
                  Click anywhere on the 4:1 preview to place countdown (
                  {form.x}%, {form.y}%)
                </span>
              </div>
              <div
                onClick={handleCanvasClick}
                className="relative aspect-[4/1] w-full overflow-hidden rounded-xl border border-[#D9C398] bg-[#F3EFE6] cursor-crosshair select-none"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.imageUrl}
                  alt="Countdown placement preview"
                  className="h-full w-full object-contain"
                />
                <div
                  style={{
                    left: `${form.x}%`,
                    top: `${form.y}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                  className={cn(
                    "pointer-events-none absolute flex flex-col items-center justify-center rounded-full border px-4 py-2 text-center font-bold backdrop-blur-md shadow-lg",
                    form.countdownColor === "wine" ||
                      form.countdownColor === "maroon"
                      ? "border-[#E2BD75]/40 bg-[#6A1B1B]/95 text-[#F5DFB0]"
                      : form.countdownColor === "white"
                        ? "border-[#D9C398] bg-white/95 text-[#231917]"
                        : "border-white/30 bg-[#D4AF37]/92 text-[#2B0F14]"
                  )}
                >
                  {form.countdownLabel ? (
                    <div className="mb-0.5 text-[9px] font-bold uppercase tracking-widest opacity-85">
                      {form.countdownLabel}
                    </div>
                  ) : null}
                  <div className="font-mono text-xs font-bold leading-none tabular-nums">
                    00:00:00
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Optional Click Link (URL or /path)"
              placeholder="e.g. /events or https://..."
              value={form.href}
              onChange={(e) => setForm({ ...form, href: e.target.value })}
            />
            <Input
              label="Countdown Label (Optional)"
              placeholder="e.g. Starts In"
              value={form.countdownLabel}
              onChange={(e) =>
                setForm({ ...form, countdownLabel: e.target.value })
              }
            />
            <Input
              label="Countdown Target Date & Time (Optional)"
              type="datetime-local"
              value={form.countdownTargetLocal}
              onChange={(e) =>
                setForm({ ...form, countdownTargetLocal: e.target.value })
              }
            />
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Timer Theme"
                value={form.countdownColor}
                onChange={(v) => setForm({ ...form, countdownColor: v })}
                options={[
                  { value: "gold", label: "Gold" },
                  { value: "wine", label: "Wine / Maroon" },
                  { value: "white", label: "Ivory Light" },
                ]}
              />
              <Select
                label="Timer Size"
                value={form.countdownSize}
                onChange={(v) => setForm({ ...form, countdownSize: v })}
                options={[
                  { value: "small", label: "Small" },
                  { value: "normal", label: "Normal" },
                  { value: "large", label: "Large" },
                  { value: "xl", label: "Extra Large" },
                ]}
              />
            </div>
          </div>

          <div className="rounded-xl border border-[#EAE2D6] bg-[#FAF7F2] px-4 py-3">
            <Toggle
              checked={form.isActive}
              onChange={(next) => setForm({ ...form, isActive: next })}
              label="Publish as active homepage banner"
            />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingBanner)}
        onClose={() => setDeletingBanner(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Banner?"
        description="Remove this banner permanently from the homepage showcase?"
      />
    </div>
  );
}
