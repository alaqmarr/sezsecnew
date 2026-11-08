import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@sezsec/db";
import {
  ensureDefaultModulesSeeded,
  requireServerPathAccess,
} from "@sezsec/rbac/rbac.server";
import { ROLE_LABELS } from "@sezsec/shared";
import { Button, PageHeader } from "@sezsec/ui";
import { UserAccessMatrixClient } from "./user-access-matrix-client";

export default async function UserModuleMatrixPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  await connection();
  const { userId } = await params;
  await requireServerPathAccess(`/admin/manage-access/${userId}`);
  await ensureDefaultModulesSeeded();

  const [targetUser, modules] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      include: { moduleAccess: { select: { moduleId: true } } },
    }),
    db.module.findMany({
      orderBy: { name: "asc" },
      include: { links: { orderBy: { order: "asc" } } },
    }),
  ]);

  if (!targetUser) {
    notFound();
  }

  const grantedIds = targetUser.moduleAccess.map((m) => m.moduleId);

  const serializedModules = modules.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description || "",
    routes: m.links.map((l) => l.path),
  }));

  return (
    <div className="w-full space-y-6">
      <PageHeader
        eyebrow="Member Access Matrix"
        title={targetUser.name || targetUser.username}
        subtitle={`${ROLE_LABELS[targetUser.role] || targetUser.role}${
          targetUser.its ? ` • ITS ${targetUser.its}` : ""
        } — Changes sync immediately over loopback to Jamaat Events (:3333).`}
        actions={
          <Link href="/admin/manage-access">
            <Button
              variant="secondary"
              size="sm"
              icon={<ArrowLeft className="h-4 w-4" />}
            >
              All Members
            </Button>
          </Link>
        }
      />

      <UserAccessMatrixClient
        userId={targetUser.id}
        isTargetSuperAdmin={targetUser.role === "ADMIN"}
        modules={serializedModules}
        initialGrantedIds={grantedIds}
      />
    </div>
  );
}
