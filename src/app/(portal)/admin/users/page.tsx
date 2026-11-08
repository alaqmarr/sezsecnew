import { connection } from "next/server";
import { db } from "@sezsec/db";
import { requireServerPathAccess } from "@sezsec/rbac/rbac.server";
import { PageHeader } from "@sezsec/ui";
import { UsersAdminClient } from "./users-admin-client";

export default async function UsersAdminPage() {
  await connection();
  const actor = await requireServerPathAccess("/admin/users");

  const users = await db.user.findMany({
    orderBy: [{ name: "asc" }, { username: "asc" }],
    include: {
      feeConfig: { select: { amount: true } },
      _count: { select: { moduleAccess: true } },
    },
  });

  const serialized = users.map((u) => ({
    id: u.id,
    username: u.username,
    name: u.name || "",
    its: u.its || "",
    email: u.email || "",
    mobile: u.mobile || "",
    role: u.role,
    monthlyFee: u.feeConfig?.amount ?? 0,
    moduleCount: u._count.moduleAccess,
  }));

  return (
    <div className="w-full space-y-6">
      <PageHeader
        eyebrow="Member Directory"
        title="Committee Members & Accounts"
        subtitle="Manage SEZ Secunderabad member accounts, ITS numbers, monthly contribution rates, and bulk Excel imports."
      />

      <UsersAdminClient
        users={serialized}
        actorId={actor.id}
        isSuperAdmin={actor.role === "ADMIN"}
      />
    </div>
  );
}
