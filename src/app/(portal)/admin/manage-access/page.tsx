import { connection } from "next/server";
import Link from "next/link";
import { Blocks } from "lucide-react";
import { db } from "@sezsec/db";
import { EVENT_CHARGES_MODULE_ID } from "@sezsec/rbac/rbac.constants";
import { requireServerPathAccess } from "@sezsec/rbac/rbac.server";
import { Button, PageHeader } from "@sezsec/ui";
import { ManageAccessListClient } from "./manage-access-list-client";

export default async function ManageAccessDirectoryPage() {
  await connection();
  await requireServerPathAccess("/admin/manage-access");

  const users = await db.user.findMany({
    orderBy: [{ name: "asc" }, { username: "asc" }],
    include: {
      moduleAccess: {
        include: { module: { select: { id: true, name: true } } },
      },
    },
  });

  const serialized = users.map((u) => ({
    id: u.id,
    name: u.name || u.username,
    username: u.username,
    its: u.its || "",
    role: u.role,
    moduleCount: u.moduleAccess.length,
    hasEventCharges:
      u.role === "ADMIN" ||
      u.moduleAccess.some((ma) => ma.moduleId === EVENT_CHARGES_MODULE_ID),
    sampleModules: u.moduleAccess.slice(0, 3).map((ma) => ma.module.name),
  }));

  return (
    <div className="w-full space-y-6">
      <PageHeader
        eyebrow="Permissions Matrix"
        title="Member Module Access"
        subtitle="Grant or revoke granular portal modules, hall thaal entry permissions, and Jamaat Events OTP charges access."
        actions={
          <Link href="/admin/modules">
            <Button
              variant="secondary"
              size="sm"
              icon={<Blocks className="h-4 w-4" />}
            >
              Configure Modules
            </Button>
          </Link>
        }
      />

      <ManageAccessListClient users={serialized} />
    </div>
  );
}
