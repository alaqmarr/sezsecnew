"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Save, ShieldCheck } from "lucide-react";
import type { Role } from "@/generated/prisma/client";
import { updateMemberAccountAction } from "@/app/actions/users.actions";
import {
  Badge,
  Button,
  Input,
  SearchInput,
  Select,
  notify,
} from "@sezsec/ui";

interface EditableMember {
  id: string;
  username: string;
  name: string;
  its: string;
  email: string;
  mobile: string;
  role: Role;
  monthlyFee: number;
  dob: string;
  occupation: string;
  quranHifz: string;
  sports: string;
}

const ROLE_OPTIONS: Array<{ value: Role; label: string }> = [
  { value: "USER", label: "Member (USER)" },
  { value: "STAFF", label: "Staff (STAFF)" },
  { value: "WATCHER", label: "Watcher (WATCHER)" },
  { value: "MANAGER", label: "Manager (MANAGER)" },
  { value: "ADMIN_CUSTOM", label: "Custom Admin (ADMIN_CUSTOM)" },
  { value: "ADMIN", label: "Super Admin (ADMIN)" },
];

export function EditUserClient({
  users,
  initialSelectedId,
  isSuperAdmin,
}: {
  users: EditableMember[];
  initialSelectedId: string;
  isSuperAdmin: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [saving, setSaving] = useState(false);

  const selected = useMemo(
    () => users.find((u) => u.id === selectedId) || users[0] || null,
    [users, selectedId]
  );

  const [form, setForm] = useState(() => ({
    username: selected?.username ?? "",
    name: selected?.name ?? "",
    its: selected?.its ?? "",
    email: selected?.email ?? "",
    mobile: selected?.mobile ?? "",
    role: (selected?.role ?? "USER") as Role,
    monthlyFee: String(selected?.monthlyFee ?? 0),
    newPassword: "",
    dob: selected?.dob ?? "",
    occupation: selected?.occupation ?? "",
    quranHifz: selected?.quranHifz ?? "",
    sports: selected?.sports ?? "",
  }));

  function handleSelectMember(u: EditableMember) {
    setSelectedId(u.id);
    setForm({
      username: u.username,
      name: u.name,
      its: u.its,
      email: u.email,
      mobile: u.mobile,
      role: u.role,
      monthlyFee: String(u.monthlyFee),
      newPassword: "",
      dob: u.dob,
      occupation: u.occupation,
      quranHifz: u.quranHifz,
      sports: u.sports,
    });
  }

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.its.toLowerCase().includes(q)
    );
  }, [users, search]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    try {
      const res = await updateMemberAccountAction({
        userId: selected.id,
        username: form.username,
        name: form.name,
        its: form.its,
        email: form.email,
        mobile: form.mobile,
        role: form.role,
        monthlyFee: Number(form.monthlyFee) || 0,
        newPassword: form.newPassword || undefined,
        dob: form.dob,
        occupation: form.occupation,
        quranHifz: form.quranHifz,
        sports: form.sports,
      });
      if (!res.ok) {
        notify.error("Could not save changes", res.error);
        return;
      }
      notify.success(
        "Member updated",
        "Changes saved & synced with Jamaat Events (:3333)"
      );
      setForm((f) => ({ ...f, newPassword: "" }));
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left Selector Rail */}
      <div className="space-y-3 rounded-2xl border border-[#E5DDD0] bg-white p-4 lg:col-span-4">
        <SearchInput
          placeholder="Find member by name or ITS…"
          value={search}
          onChange={setSearch}
        />
        <div className="max-h-[560px] divide-y divide-[#EFE8DC] overflow-y-auto rounded-xl border border-[#EFE8DC]">
          {filteredList.map((u) => {
            const active = selected?.id === u.id;
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => handleSelectMember(u)}
                className={`flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left transition-colors cursor-pointer ${
                  active ? "bg-[#FBF6EB]" : "hover:bg-[#FAF7F2]"
                }`}
              >
                <div className="min-w-0">
                  <p
                    className={`truncate text-sm font-semibold ${
                      active ? "text-[#6A1B1B]" : "text-[#231917]"
                    }`}
                  >
                    {u.name || u.username}
                  </p>
                  <p className="truncate text-xs text-[#7B6B63]">
                    {u.its ? `ITS ${u.its}` : `@${u.username}`}
                  </p>
                </div>
                {u.role !== "USER" ? (
                  <Badge tone="brass">{u.role}</Badge>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Full Editor */}
      <div className="rounded-2xl border border-[#E5DDD0] bg-white p-6 lg:col-span-8">
        {!selected ? (
          <p className="text-sm text-[#7B6B63]">Select a member to edit.</p>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAE2D6] pb-4">
              <div>
                <h2 className="font-editorial text-2xl font-bold text-[#231917]">
                  {selected.name || selected.username}
                </h2>
                <p className="text-xs text-[#7B6B63]">
                  Account ID: {selected.id}
                </p>
              </div>
              <Link href={`/admin/manage-access/${selected.id}`}>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  icon={<ShieldCheck className="h-4 w-4" />}
                >
                  Module Permissions
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Full Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <Input
                label="8-Digit ITS Number"
                value={form.its}
                onChange={(e) => setForm({ ...form, its: e.target.value })}
              />
              <Input
                label="Login Username"
                required
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
              <Input
                label="Reset Password (Optional)"
                type="password"
                placeholder="Leave blank to keep existing password"
                value={form.newPassword}
                onChange={(e) =>
                  setForm({ ...form, newPassword: e.target.value })
                }
              />
              <Input
                label="Email Address"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <Input
                label="Mobile Number"
                value={form.mobile}
                onChange={(e) => setForm({ ...form, mobile: e.target.value })}
              />
              <Select
                label="System Role"
                value={form.role}
                onChange={(val) => setForm({ ...form, role: val as Role })}
                disabled={!isSuperAdmin && selected.role === "ADMIN"}
                options={
                  isSuperAdmin
                    ? ROLE_OPTIONS
                    : ROLE_OPTIONS.filter((r) => r.value !== "ADMIN")
                }
              />
              <Input
                label="Monthly Contribution Rate (₹)"
                type="number"
                min={0}
                value={form.monthlyFee}
                onChange={(e) =>
                  setForm({ ...form, monthlyFee: e.target.value })
                }
              />
              <Input
                label="Date of Birth"
                type="date"
                value={form.dob}
                onChange={(e) => setForm({ ...form, dob: e.target.value })}
              />
              <Input
                label="Occupation / Profession"
                value={form.occupation}
                onChange={(e) =>
                  setForm({ ...form, occupation: e.target.value })
                }
              />
              <Input
                label="Quran Hifz Status"
                value={form.quranHifz}
                onChange={(e) =>
                  setForm({ ...form, quranHifz: e.target.value })
                }
              />
              <Input
                label="Sports & Interests"
                value={form.sports}
                onChange={(e) => setForm({ ...form, sports: e.target.value })}
              />
            </div>

            <div className="flex justify-end border-t border-[#EAE2D6] pt-4">
              <Button
                type="submit"
                variant="primary"
                loading={saving}
                icon={<Save className="h-4 w-4" />}
              >
                Save Member Changes
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
