"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Edit2, Plus, RefreshCw, Trash2, X } from "lucide-react";
import {
  deleteRbacModuleAction,
  generateHallAndChargesModulesAction,
  upsertRbacModuleAction,
} from "@/app/actions/rbac.actions";
import {
  Badge,
  Button,
  ConfirmDialog,
  Input,
  Modal,
  SearchInput,
  notify,
} from "@sezsec/ui";

interface ModuleRow {
  id: string;
  name: string;
  description: string;
  icon: string;
  userCount: number;
  links: Array<{ id: string; path: string; label: string }>;
}

export function ModulesAdminClient({ modules }: { modules: ModuleRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [syncingBridge, setSyncingBridge] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [form, setForm] = useState({
    id: "",
    name: "",
    description: "",
    icon: "Layers",
    links: [{ path: "", label: "" }],
  });

  const [deletingMod, setDeletingMod] = useState<ModuleRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return modules;
    return modules.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.links.some((l) => l.path.toLowerCase().includes(q))
    );
  }, [modules, search]);

  async function handleGenerateFromBridge() {
    setSyncingBridge(true);
    try {
      const res = await generateHallAndChargesModulesAction();
      if (!res.ok) {
        notify.error("Could not sync modules", res.error);
        return;
      }
      notify.success(
        "Capabilities synced",
        `Verified ${res.hallCount} Jamaat halls + event_charges (${res.createdCount} newly added)`
      );
      router.refresh();
    } finally {
      setSyncingBridge(false);
    }
  }

  function openNew() {
    setIsEditingExisting(false);
    setForm({
      id: "",
      name: "",
      description: "",
      icon: "Layers",
      links: [{ path: "/admin/", label: "" }],
    });
    setModalOpen(true);
  }

  function openEdit(m: ModuleRow) {
    setIsEditingExisting(true);
    setForm({
      id: m.id,
      name: m.name,
      description: m.description,
      icon: m.icon,
      links:
        m.links.length > 0
          ? m.links.map((l) => ({ path: l.path, label: l.label }))
          : [],
    });
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await upsertRbacModuleAction({
        id: form.id || undefined,
        name: form.name,
        description: form.description,
        icon: form.icon,
        links: form.links.filter((l) => l.path.trim().startsWith("/")),
      });
      if (!res.ok) {
        notify.error("Save failed", res.error);
        return;
      }
      notify.success("Module saved");
      setModalOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingMod) return;
    setDeleting(true);
    try {
      const res = await deleteRbacModuleAction(deletingMod.id);
      if (!res.ok) {
        notify.error("Delete failed", res.error);
        return;
      }
      notify.info("Module deleted");
      setDeletingMod(null);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:max-w-md">
          <SearchInput
            placeholder="Filter modules by name, ID, or route path…"
            value={search}
            onChange={setSearch}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="brass"
            size="sm"
            loading={syncingBridge}
            onClick={handleGenerateFromBridge}
            icon={<RefreshCw className="h-4 w-4" />}
          >
            Sync Halls &amp; Charges Modules
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={openNew}
            icon={<Plus className="h-4 w-4" />}
          >
            New Module
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#E5DDD0] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#E5DDD0] bg-[#FAF7F2] text-xs font-bold uppercase tracking-wider text-[#6E5D55]">
                <th className="px-5 py-3.5">Module &amp; Identifier</th>
                <th className="px-4 py-3.5">Protected Routes</th>
                <th className="px-4 py-3.5">Granted Members</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE8DC]">
              {filtered.map((m) => (
                <tr
                  key={m.id}
                  className="transition-colors hover:bg-[#FAF7F2]/60"
                >
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-[#231917]">{m.name}</div>
                    <div className="font-mono text-[11px] text-[#8C7B73]">
                      {m.id}
                    </div>
                    {m.description ? (
                      <div className="mt-0.5 text-xs text-[#5E4F4A]">
                        {m.description}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3.5">
                    {m.links.length === 0 ? (
                      <Badge tone="brass">Capability Flag (No Route)</Badge>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {m.links.map((l) => (
                          <span
                            key={l.id}
                            className="rounded-md border border-[#E5DDD0] bg-[#FAF7F2] px-2 py-0.5 font-mono text-xs text-[#3D2E2A]"
                          >
                            {l.path}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3.5 font-mono text-xs font-semibold text-[#231917]">
                    {m.userCount}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={() => openEdit(m)}
                        icon={<Edit2 className="h-3.5 w-3.5" />}
                      >
                        Edit
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => setDeletingMod(m)}
                        icon={<Trash2 className="h-3.5 w-3.5 text-[#991B1B]" />}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={isEditingExisting ? "Edit RBAC Module" : "Create RBAC Module"}
        size="lg"
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
              Save Module
            </Button>
          </>
        }
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Module Display Name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Input
              label="Module ID (Slug)"
              placeholder="Auto-generated if left blank"
              disabled={isEditingExisting}
              value={form.id}
              onChange={(e) => setForm({ ...form, id: e.target.value })}
            />
          </div>

          <Input
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#3D2E2A]">
                Protected Route Links (Leave empty for capability-only flags like
                event_charges)
              </span>
              <button
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    links: [...form.links, { path: "", label: "" }],
                  })
                }
                className="text-xs font-semibold text-[#6A1B1B] hover:underline cursor-pointer"
              >
                + Add Route
              </button>
            </div>
            {form.links.map((lnk, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="/admin/example"
                    value={lnk.path}
                    onChange={(e) => {
                      const next = [...form.links];
                      next[idx] = { ...next[idx], path: e.target.value };
                      setForm({ ...form, links: next });
                    }}
                  />
                </div>
                <div className="flex-1">
                  <Input
                    placeholder="Sidebar Label"
                    value={lnk.label}
                    onChange={(e) => {
                      const next = [...form.links];
                      next[idx] = { ...next[idx], label: e.target.value };
                      setForm({ ...form, links: next });
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      links: form.links.filter((_, i) => i !== idx),
                    })
                  }
                  className="rounded-lg p-2 text-[#8C7B73] hover:text-[#991B1B] cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingMod)}
        onClose={() => setDeletingMod(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Module?"
        description={
          <>
            Delete module <strong>{deletingMod?.name}</strong> (
            <code>{deletingMod?.id}</code>)?
          </>
        }
      />
    </div>
  );
}
