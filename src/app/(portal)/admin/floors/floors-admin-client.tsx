"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Edit2, Plus, Trash2, UserPlus, X } from "lucide-react";
import {
  createFloorAction,
  deleteFloorAction,
  renameFloorAction,
  updateFloorAssignmentAction,
} from "@/app/actions/floors-attendance.actions";
import {
  Badge,
  Button,
  ConfirmDialog,
  Drawer,
  Input,
  IosSpinner,
  Modal,
  SearchInput,
  Tabs,
  notify,
} from "@sezsec/ui";

interface BasicUser {
  id: string;
  name: string | null;
  username: string;
  its: string | null;
}

interface FloorItem {
  id: string;
  name: string;
  heads: BasicUser[];
  subHeads: BasicUser[];
  members: BasicUser[];
}

type Tier = "HEAD" | "SUBHEAD" | "MEMBER";

export function FloorsAdminClient({
  floors,
  allUsers,
}: {
  floors: FloorItem[];
  allUsers: BasicUser[];
}) {
  const router = useRouter();
  const [newFloorName, setNewFloorName] = useState("");
  const [creating, setCreating] = useState(false);

  const [renamingFloor, setRenamingFloor] = useState<FloorItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);

  const [deletingFloor, setDeletingFloor] = useState<FloorItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [assignFloorId, setAssignFloorId] = useState<string | null>(null);
  const [assignTier, setAssignTier] = useState<Tier>("MEMBER");
  const [memberSearch, setMemberSearch] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const activeAssignFloor = useMemo(
    () => floors.find((f) => f.id === assignFloorId) || null,
    [floors, assignFloorId]
  );

  async function handleCreateFloor(e: React.FormEvent) {
    e.preventDefault();
    if (!newFloorName.trim()) return;
    setCreating(true);
    try {
      const res = await createFloorAction(newFloorName);
      if (!res.ok) {
        notify.error("Could not create floor", res.error);
        return;
      }
      notify.success("Floor created");
      setNewFloorName("");
      router.refresh();
    } finally {
      setCreating(false);
    }
  }

  async function handleRenameFloor(e: React.FormEvent) {
    e.preventDefault();
    if (!renamingFloor || !renameValue.trim()) return;
    setRenaming(true);
    try {
      const res = await renameFloorAction({
        floorId: renamingFloor.id,
        name: renameValue,
      });
      if (!res.ok) {
        notify.error("Rename failed", res.error);
        return;
      }
      notify.success("Floor renamed");
      setRenamingFloor(null);
      router.refresh();
    } finally {
      setRenaming(false);
    }
  }

  async function handleDeleteFloor() {
    if (!deletingFloor) return;
    setDeleting(true);
    try {
      const res = await deleteFloorAction(deletingFloor.id);
      if (!res.ok) {
        notify.error("Delete failed", res.error);
        return;
      }
      notify.success("Floor deleted");
      setDeletingFloor(null);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  async function handleAssignment(
    floorId: string,
    userId: string,
    tier: Tier,
    mode: "ADD" | "REMOVE"
  ) {
    const key = `${floorId}:${tier}:${userId}`;
    setBusyKey(key);
    try {
      const res = await updateFloorAssignmentAction({
        floorId,
        userId,
        tier,
        mode,
      });
      if (!res.ok) {
        notify.error("Assignment failed", res.error);
        return;
      }
      router.refresh();
    } finally {
      setBusyKey(null);
    }
  }

  const drawerTierSet = useMemo(() => {
    if (!activeAssignFloor) return new Set<string>();
    const arr =
      assignTier === "HEAD"
        ? activeAssignFloor.heads
        : assignTier === "SUBHEAD"
          ? activeAssignFloor.subHeads
          : activeAssignFloor.members;
    return new Set(arr.map((u) => u.id));
  }, [activeAssignFloor, assignTier]);

  const filteredDrawerUsers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return allUsers;
    return allUsers.filter(
      (u) =>
        (u.name || "").toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.its || "").toLowerCase().includes(q)
    );
  }, [allUsers, memberSearch]);

  const renderTierPills = (
    floorId: string,
    tier: Tier,
    label: string,
    users: BasicUser[]
  ) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#6E5D55]">
          {label} ({users.length})
        </span>
        <button
          type="button"
          onClick={() => {
            setAssignFloorId(floorId);
            setAssignTier(tier);
            setMemberSearch("");
          }}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#6A1B1B] hover:underline cursor-pointer"
        >
          <UserPlus className="h-3.5 w-3.5" />
          <span>Manage</span>
        </button>
      </div>

      {users.length === 0 ? (
        <p className="text-xs italic text-[#9E8E85]">None assigned</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {users.map((u) => {
            const k = `${floorId}:${tier}:${u.id}`;
            return (
              <span
                key={u.id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5DDD0] bg-[#FAF7F2] px-2.5 py-1 text-xs font-medium text-[#231917]"
              >
                <span>{u.name || u.username}</span>
                <button
                  type="button"
                  disabled={busyKey === k}
                  onClick={() => handleAssignment(floorId, u.id, tier, "REMOVE")}
                  title="Remove from floor"
                  className="text-[#8C7B73] hover:text-[#991B1B] cursor-pointer"
                >
                  {busyKey === k ? (
                    <IosSpinner size="xs" tone="maroon" />
                  ) : (
                    <X className="h-3 w-3" />
                  )}
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="w-full space-y-6">
      {/* Create New Floor Bar */}
      <form
        onSubmit={handleCreateFloor}
        className="flex flex-col gap-3 rounded-2xl border border-[#E5DDD0] bg-white p-4 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <Input
            label="Create New Floor / Section"
            placeholder="e.g. Ground Floor Sehan, 1st Floor Mawaid, Masjid Section…"
            value={newFloorName}
            onChange={(e) => setNewFloorName(e.target.value)}
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          loading={creating}
          icon={<Plus className="h-4 w-4" />}
        >
          Add Floor
        </Button>
      </form>

      {/* Floors List */}
      {floors.length === 0 ? (
        <div className="rounded-2xl border border-[#E5DDD0] bg-white px-6 py-12 text-center text-sm text-[#7B6B63]">
          No floors created yet. Add your first Jamaat floor above.
        </div>
      ) : (
        <div className="divide-y divide-[#E5DDD0] rounded-2xl border border-[#E5DDD0] bg-white">
          {floors.map((floor) => (
            <div key={floor.id} className="space-y-4 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EFE8DC] pb-3">
                <div className="flex items-center gap-3">
                  <h2 className="font-editorial text-2xl font-bold text-[#231917]">
                    {floor.name}
                  </h2>
                  <Badge tone="brass">
                    {floor.heads.length +
                      floor.subHeads.length +
                      floor.members.length}{" "}
                    assigned
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="xs"
                    variant="secondary"
                    icon={<UserPlus className="h-3.5 w-3.5" />}
                    onClick={() => {
                      setAssignFloorId(floor.id);
                      setAssignTier("MEMBER");
                    }}
                  >
                    Assign Members
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    icon={<Edit2 className="h-3.5 w-3.5" />}
                    onClick={() => {
                      setRenamingFloor(floor);
                      setRenameValue(floor.name);
                    }}
                  >
                    Rename
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    icon={<Trash2 className="h-3.5 w-3.5 text-[#991B1B]" />}
                    onClick={() => setDeletingFloor(floor)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {renderTierPills(floor.id, "HEAD", "Floor Heads", floor.heads)}
                {renderTierPills(
                  floor.id,
                  "SUBHEAD",
                  "Floor Sub-Heads",
                  floor.subHeads
                )}
                {renderTierPills(
                  floor.id,
                  "MEMBER",
                  "Floor Members",
                  floor.members
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Member Assignment Drawer */}
      <Drawer
        open={Boolean(activeAssignFloor)}
        onClose={() => setAssignFloorId(null)}
        title={
          activeAssignFloor
            ? `Assign Brothers — ${activeAssignFloor.name}`
            : "Assign Brothers"
        }
        subtitle="Toggle Heads, Sub-Heads, or Floor Members directly."
        widthClass="max-w-xl"
      >
        {activeAssignFloor ? (
          <div className="space-y-4">
            <Tabs<Tier>
              activeTab={assignTier}
              onChange={setAssignTier}
              tabs={[
                {
                  id: "HEAD",
                  label: "Heads",
                  count: activeAssignFloor.heads.length,
                },
                {
                  id: "SUBHEAD",
                  label: "Sub-Heads",
                  count: activeAssignFloor.subHeads.length,
                },
                {
                  id: "MEMBER",
                  label: "Members",
                  count: activeAssignFloor.members.length,
                },
              ]}
            />

            <SearchInput
              placeholder="Search member by name, ITS, or username…"
              value={memberSearch}
              onChange={setMemberSearch}
            />

            <div className="divide-y divide-[#EFE8DC] rounded-xl border border-[#E5DDD0]">
              {filteredDrawerUsers.map((u) => {
                const assigned = drawerTierSet.has(u.id);
                const k = `${activeAssignFloor.id}:${assignTier}:${u.id}`;
                const busy = busyKey === k;
                return (
                  <div
                    key={u.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#231917]">
                        {u.name || u.username}
                      </p>
                      <p className="text-xs text-[#7B6B63]">
                        {u.its ? `ITS ${u.its}` : u.username}
                      </p>
                    </div>
                    <Button
                      size="xs"
                      variant={assigned ? "danger" : "secondary"}
                      loading={busy}
                      onClick={() =>
                        handleAssignment(
                          activeAssignFloor.id,
                          u.id,
                          assignTier,
                          assigned ? "REMOVE" : "ADD"
                        )
                      }
                    >
                      {assigned ? "Remove" : "Add"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </Drawer>

      {/* Rename Floor Modal */}
      <Modal
        open={Boolean(renamingFloor)}
        onClose={() => setRenamingFloor(null)}
        title="Rename Floor"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setRenamingFloor(null)}
              disabled={renaming}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleRenameFloor}
              loading={renaming}
            >
              Save Name
            </Button>
          </>
        }
      >
        <form onSubmit={handleRenameFloor}>
          <Input
            label="Floor Name"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            required
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingFloor)}
        onClose={() => setDeletingFloor(null)}
        onConfirm={handleDeleteFloor}
        loading={deleting}
        title="Delete Floor?"
        description={
          <>
            Delete floor <strong>{deletingFloor?.name}</strong>? Member user
            accounts will not be deleted, only their assignment to this floor.
          </>
        }
        confirmLabel="Delete Floor"
      />
    </div>
  );
}
