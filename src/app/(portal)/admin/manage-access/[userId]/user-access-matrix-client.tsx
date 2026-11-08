"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toggleUserModuleAccessAction } from "@/app/actions/rbac.actions";
import { SearchInput, Toggle, notify } from "@sezsec/ui";

interface MatrixModule {
  id: string;
  name: string;
  description: string;
  routes: string[];
}

export function UserAccessMatrixClient({
  userId,
  isTargetSuperAdmin,
  modules,
  initialGrantedIds,
}: {
  userId: string;
  isTargetSuperAdmin: boolean;
  modules: MatrixModule[];
  initialGrantedIds: string[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [grantedSet, setGrantedSet] = useState<Set<string>>(
    () => new Set(initialGrantedIds)
  );
  const [busyModuleId, setBusyModuleId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return modules;
    return modules.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.routes.some((r) => r.toLowerCase().includes(q))
    );
  }, [modules, search]);

  const capabilityModules = filtered.filter((m) => m.routes.length === 0);
  const routeModules = filtered.filter((m) => m.routes.length > 0);

  async function handleToggle(moduleId: string, nextGrant: boolean) {
    setBusyModuleId(moduleId);
    // Optimistic state update
    setGrantedSet((prev) => {
      const next = new Set(prev);
      if (nextGrant) next.add(moduleId);
      else next.delete(moduleId);
      return next;
    });

    try {
      const res = await toggleUserModuleAccessAction({
        userId,
        moduleId,
        grant: nextGrant,
      });
      if (!res.ok) {
        notify.error("Permission update failed", res.error);
        // Revert optimistic update
        setGrantedSet((prev) => {
          const reverted = new Set(prev);
          if (nextGrant) reverted.delete(moduleId);
          else reverted.add(moduleId);
          return reverted;
        });
        return;
      }
      router.refresh();
    } finally {
      setBusyModuleId(null);
    }
  }

  return (
    <div className="w-full space-y-6">
      {isTargetSuperAdmin ? (
        <div className="rounded-2xl border border-[#DFC99B] bg-[#FBF5E6] px-5 py-3.5 text-xs font-medium text-[#5E4F4A]">
          This member holds the <strong>Super Admin (ADMIN)</strong> role and
          automatically has unrestricted access to all modules on both portals.
        </div>
      ) : null}

      <div className="w-full sm:max-w-md">
        <SearchInput
          placeholder="Filter permissions by name, hall, or route…"
          value={search}
          onChange={setSearch}
        />
      </div>

      {/* Special Capabilities & Cross-App Permissions */}
      {capabilityModules.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-editorial text-2xl font-bold text-[#231917]">
            Bookings Bridge, Event Charges &amp; Hall Thaal Capabilities
          </h2>
          <div className="grid grid-cols-1 divide-y divide-[#E5DDD0] rounded-2xl border border-[#E5DDD0] bg-white md:grid-cols-2 md:divide-x md:divide-y-0">
            {capabilityModules.map((m) => (
              <div
                key={m.id}
                className="border-b border-[#E5DDD0] p-4 last:border-b-0"
              >
                <Toggle
                  checked={isTargetSuperAdmin || grantedSet.has(m.id)}
                  disabled={isTargetSuperAdmin}
                  loading={busyModuleId === m.id}
                  onChange={(next) => handleToggle(m.id, next)}
                  label={m.name}
                  description={m.description || m.id}
                  className="w-full"
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Portal Navigation Modules */}
      {routeModules.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-editorial text-2xl font-bold text-[#231917]">
            SEZ Portal Administration Modules
          </h2>
          <div className="divide-y divide-[#E5DDD0] rounded-2xl border border-[#E5DDD0] bg-white">
            {routeModules.map((m) => (
              <div key={m.id} className="p-4 sm:px-5">
                <Toggle
                  checked={isTargetSuperAdmin || grantedSet.has(m.id)}
                  disabled={isTargetSuperAdmin}
                  loading={busyModuleId === m.id}
                  onChange={(next) => handleToggle(m.id, next)}
                  label={m.name}
                  description={
                    m.description
                      ? `${m.description} (${m.routes.join(", ")})`
                      : m.routes.join(", ")
                  }
                  className="w-full"
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
