"use client";

import React, { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import {
  Download,
  FileSpreadsheet,
  Plus,
  ShieldCheck,
  Trash2,
  UserCog,
} from "lucide-react";
import type { Role } from "@/generated/prisma/client";
import {
  bulkImportMembersAction,
  createMemberAccountAction,
  deleteMemberAccountAction,
} from "@/app/actions/users.actions";
import { ROLE_LABELS, formatRupees } from "@sezsec/shared";
import {
  Badge,
  Button,
  ConfirmDialog,
  Input,
  Modal,
  Pagination,
  SearchInput,
  Select,
  notify,
} from "@sezsec/ui";

interface MemberRow {
  id: string;
  username: string;
  name: string;
  its: string;
  email: string;
  mobile: string;
  role: Role;
  monthlyFee: number;
  moduleCount: number;
}

const ROLE_OPTIONS: Array<{ value: Role; label: string }> = [
  { value: "USER", label: "Member (USER)" },
  { value: "STAFF", label: "Staff (STAFF)" },
  { value: "WATCHER", label: "Watcher (WATCHER)" },
  { value: "MANAGER", label: "Manager (MANAGER)" },
  { value: "ADMIN_CUSTOM", label: "Custom Admin (ADMIN_CUSTOM)" },
  { value: "ADMIN", label: "Super Admin (ADMIN)" },
];

const PAGE_SIZE = 25;

export function UsersAdminClient({
  users,
  actorId,
  isSuperAdmin,
}: {
  users: MemberRow[];
  actorId: string;
  isSuperAdmin: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  const [addOpen, setAddOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    its: "",
    username: "",
    password: "",
    email: "",
    mobile: "",
    role: "USER" as Role,
    monthlyFee: "200",
  });

  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parsedRows, setParsedRows] = useState<
    Array<{
      username?: string;
      its?: string;
      name?: string;
      email?: string;
      mobile?: string;
      role?: string;
      password?: string;
      monthlyFee?: number;
    }>
  >([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deletingUser, setDeletingUser] = useState<MemberRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
      if (
        q &&
        !u.name.toLowerCase().includes(q) &&
        !u.username.toLowerCase().includes(q) &&
        !u.its.toLowerCase().includes(q) &&
        !u.email.toLowerCase().includes(q) &&
        !u.mobile.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [users, search, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  async function handleCreateMember(e: React.FormEvent) {
    e.preventDefault();
    const effectiveUsername = form.username.trim() || form.its.trim();
    const effectivePassword = form.password.trim() || effectiveUsername;
    if (!effectiveUsername) {
      notify.error("Enter an ITS number or username");
      return;
    }
    setCreating(true);
    try {
      const res = await createMemberAccountAction({
        username: effectiveUsername,
        password: effectivePassword,
        name: form.name,
        its: form.its,
        email: form.email,
        mobile: form.mobile,
        role: form.role,
        monthlyFee: Number(form.monthlyFee) || 0,
      });
      if (!res.ok) {
        notify.error("Could not create member", res.error);
        return;
      }
      notify.success(
        "Member account created",
        "Synchronized automatically with Jamaat Events (:3333)"
      );
      setAddOpen(false);
      setForm({
        name: "",
        its: "",
        username: "",
        password: "",
        email: "",
        mobile: "",
        role: "USER",
        monthlyFee: "200",
      });
      router.refresh();
    } finally {
      setCreating(false);
    }
  }

  function handleSpreadsheetSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rawJson = XLSX.utils.sheet_to_json<Record<string, unknown>>(
          sheet,
          { defval: "" }
        );
        const mapped = rawJson.map((r) => ({
          its: String(r.ITS ?? r.its ?? "").trim(),
          username: String(
            r.Username ?? r.username ?? r.ITS ?? r.its ?? ""
          ).trim(),
          name: String(r.Name ?? r.name ?? "").trim(),
          email: String(r.Email ?? r.email ?? "").trim(),
          mobile: String(
            r.Mobile ?? r.mobile ?? r.Phone ?? r.phone ?? ""
          ).trim(),
          role: String(r.Role ?? r.role ?? "USER").trim(),
          password: String(r.Password ?? r.password ?? "").trim(),
          monthlyFee: Number(
            r["Monthly Fee"] ?? r.monthlyFee ?? r.Fee ?? 0
          ),
        }));
        setParsedRows(mapped.filter((m) => m.username || m.its));
      } catch {
        notify.error("Invalid Excel or CSV file");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleRunImport() {
    if (parsedRows.length === 0) return;
    setImporting(true);
    try {
      const res = await bulkImportMembersAction(parsedRows);
      if (!res.ok) {
        notify.error("Import failed", res.error);
        return;
      }
      notify.success(
        "Bulk import completed",
        `${res.createdCount} created, ${res.updatedCount} updated (${res.skippedCount} skipped)`
      );
      setImportOpen(false);
      setParsedRows([]);
      router.refresh();
    } finally {
      setImporting(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deletingUser) return;
    setDeleting(true);
    try {
      const res = await deleteMemberAccountAction(deletingUser.id);
      if (!res.ok) {
        notify.error("Delete failed", res.error);
        return;
      }
      notify.success("Member deleted");
      setDeletingUser(null);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="w-full space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <SearchInput
              placeholder="Search by name, 8-digit ITS, username, email, or phone…"
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
            />
          </div>
          <Select
            value={roleFilter}
            onChange={(v) => {
              setRoleFilter(v);
              setPage(1);
            }}
            options={[
              { value: "ALL", label: `All Roles (${users.length})` },
              ...ROLE_OPTIONS,
            ]}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <a href="/api/exports?type=USERS">
            <Button
              variant="secondary"
              size="sm"
              icon={<Download className="h-4 w-4" />}
            >
              Export .xlsx
            </Button>
          </a>
          <Button
            variant="secondary"
            size="sm"
            icon={<FileSpreadsheet className="h-4 w-4" />}
            onClick={() => {
              setParsedRows([]);
              setImportOpen(true);
            }}
          >
            Bulk Import
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setAddOpen(true)}
          >
            Add Member
          </Button>
        </div>
      </div>

      {/* Directory Table */}
      <div className="overflow-hidden rounded-2xl border border-[#E5DDD0] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#E5DDD0] bg-[#FAF7F2] text-xs font-bold uppercase tracking-wider text-[#6E5D55]">
                <th className="px-5 py-3.5">Member</th>
                <th className="px-4 py-3.5">ITS / Username</th>
                <th className="px-4 py-3.5">Contact</th>
                <th className="px-4 py-3.5">Role</th>
                <th className="px-4 py-3.5">Monthly Rate</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE8DC]">
              {visible.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center text-sm text-[#7B6B63]"
                  >
                    No members match your filter criteria.
                  </td>
                </tr>
              ) : (
                visible.map((u) => (
                  <tr
                    key={u.id}
                    className="transition-colors hover:bg-[#FAF7F2]/60"
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-[#231917]">
                        {u.name || u.username}
                      </div>
                      {u.moduleCount > 0 ? (
                        <div className="text-[11px] text-[#7B6B63]">
                          {u.moduleCount} module
                          {u.moduleCount === 1 ? "" : "s"} granted
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-mono text-xs font-semibold text-[#231917]">
                        {u.its || "—"}
                      </div>
                      <div className="text-xs text-[#8C7B73]">@{u.username}</div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[#4E3F3A]">
                      <div>{u.mobile || "—"}</div>
                      <div className="truncate max-w-[200px] text-[#7B6B63]">
                        {u.email || ""}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge
                        tone={
                          u.role === "ADMIN"
                            ? "maroon"
                            : u.role === "USER"
                              ? "neutral"
                              : "brass"
                        }
                      >
                        {ROLE_LABELS[u.role] || u.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs font-semibold text-[#231917]">
                      {u.monthlyFee > 0 ? formatRupees(u.monthlyFee) : "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/admin/edit-user?id=${u.id}`}>
                          <Button
                            size="xs"
                            variant="secondary"
                            icon={<UserCog className="h-3.5 w-3.5" />}
                          >
                            Edit
                          </Button>
                        </Link>
                        <Link href={`/admin/manage-access/${u.id}`}>
                          <Button
                            size="xs"
                            variant="ghost"
                            icon={<ShieldCheck className="h-3.5 w-3.5" />}
                            title="Module Permissions"
                          >
                            Access
                          </Button>
                        </Link>
                        {isSuperAdmin && u.id !== actorId ? (
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => setDeletingUser(u)}
                            icon={
                              <Trash2 className="h-3.5 w-3.5 text-[#991B1B]" />
                            }
                          />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination
        page={safePage}
        totalPages={totalPages}
        totalItems={filtered.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />

      {/* Add Member Modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Create Member Account"
        subtitle="Creates a local account and syncs credentials to Jamaat Events (:3333)."
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setAddOpen(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateMember}
              loading={creating}
            >
              Create Member
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateMember} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Full Name"
            placeholder="e.g. Murtaza Bhai"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Input
            label="8-Digit ITS Number"
            placeholder="e.g. 30405060"
            value={form.its}
            onChange={(e) =>
              setForm({
                ...form,
                its: e.target.value,
                username: form.username || e.target.value,
              })
            }
          />
          <Input
            label="Login Username"
            placeholder="Defaults to ITS number"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
          />
          <Input
            label="Initial Password"
            placeholder="Defaults to ITS / username if blank"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <Input
            label="Email Address"
            type="email"
            placeholder="member@gmail.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            label="Mobile Number"
            placeholder="98XXXXXXXX"
            value={form.mobile}
            onChange={(e) => setForm({ ...form, mobile: e.target.value })}
          />
          <Select
            label="System Role"
            value={form.role}
            onChange={(val) => setForm({ ...form, role: val as Role })}
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
            onChange={(e) => setForm({ ...form, monthlyFee: e.target.value })}
          />
        </form>
      </Modal>

      {/* Bulk Import Modal */}
      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Bulk Import Members (.xlsx / .csv)"
        subtitle="Upload an Excel sheet to create or update committee members in batch."
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setImportOpen(false)}
              disabled={importing}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={parsedRows.length === 0}
              loading={importing}
              onClick={handleRunImport}
            >
              Import {parsedRows.length > 0 ? `${parsedRows.length} Rows` : ""}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#EAE2D6] bg-[#FAF7F2] px-4 py-3 text-xs text-[#4E3F3A]">
            <span>
              Columns supported:{" "}
              <strong>ITS, Username, Name, Email, Mobile, Role, Monthly Fee</strong>
            </span>
            <a
              href="/api/exports?type=TEMPLATE_USERS"
              className="font-semibold text-[#6A1B1B] underline"
            >
              Download Sample Template (.xlsx)
            </a>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleSpreadsheetSelect}
            className="block w-full text-sm text-[#4E3F3A] file:mr-4 file:rounded-xl file:border-0 file:bg-[#6A1B1B] file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-[#521414]"
          />

          {parsedRows.length > 0 ? (
            <div className="rounded-xl border border-[#E5DDD0] bg-white p-3 text-xs">
              <p className="font-semibold text-[#231917]">
                Ready to import {parsedRows.length} member row(s):
              </p>
              <ul className="mt-2 max-h-44 space-y-1 overflow-y-auto text-[#5E4F4A]">
                {parsedRows.slice(0, 12).map((r, i) => (
                  <li key={i}>
                    • <strong>{r.name || r.username}</strong> ({r.its || r.username})
                  </li>
                ))}
                {parsedRows.length > 12 ? (
                  <li className="italic">
                    …and {parsedRows.length - 12} more rows
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingUser)}
        onClose={() => setDeletingUser(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        title="Delete Member Account?"
        description={
          <>
            Permanently delete{" "}
            <strong>{deletingUser?.name || deletingUser?.username}</strong>? This
            also removes their synced access from Jamaat Events (:3333).
          </>
        }
        confirmLabel="Delete Account"
      />
    </div>
  );
}
