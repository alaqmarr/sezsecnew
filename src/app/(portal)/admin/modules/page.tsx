import { connection } from "next/server";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { db } from "@sezsec/db";
import {
  ensureDefaultModulesSeeded,
  requireServerPathAccess,
} from "@sezsec/rbac/rbac.server";
import { Button, PageHeader } from "@sezsec/ui";
import { ModulesAdminClient } from "./modules-admin-client";

export default async function RbacModulesAdminPage() {
  await connection();
  await requireServerPathAccess("/admin/modules");
  await ensureDefaultModulesSeeded();

  const modules = await db.module.findMany({
    orderBy: { name: "asc" },
    include: {
      links: { orderBy: { order: "asc" } },
      _count: { select: { userAccess: true } },
    },
  });

  const serialized = modules.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description || "",
    icon: m.icon || "Layers",
    userCount: m._count.userAccess,
    links: m.links.map((l) => ({
      id: l.id,
      path: l.path,
      label: l.label || "",
    })),
  }));

  return (
    <div className="w-full space-y-6">
      <PageHeader
        eyebrow="Access Control"
        title="RBAC Modules & Capabilities"
        subtitle="Define portal navigation modules, hall thaal entry capabilities, and the shared event_charges OTP permission."
        actions={
          <Link href="/admin/manage-access">
            <Button
              variant="secondary"
              size="sm"
              icon={<ShieldCheck className="h-4 w-4" />}
            >
              Assign Member Access
            </Button>
          </Link>
        }
      />

      <ModulesAdminClient modules={serialized} />
    </div>
  );
}
