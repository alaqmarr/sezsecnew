import { connection } from "next/server";
import { db } from "@sezsec/db";
import { requireServerPathAccess } from "@sezsec/rbac/rbac.server";
import { PageHeader } from "@sezsec/ui";
import { KhidmatQueueClient } from "./khidmat-queue-client";

export default async function KhidmatRequestsAdminPage() {
  await connection();
  await requireServerPathAccess("/admin/khidmat");

  const requests = await db.khidmatRequest.findMany({
    orderBy: { date: "desc" },
  });

  const serialized = requests.map((r) => ({
    id: r.id,
    miqat: r.miqat,
    name: r.name,
    phone: r.phone,
    date: r.date.toISOString(),
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="w-full space-y-6">
      <PageHeader
        eyebrow="Khidmat-ul-Mumineen"
        title="Khidmat Invitations Queue"
        subtitle="Manage requests from Mumineen families inviting SEZ Secunderabad brothers for occasion jaman khidmat."
      />

      <KhidmatQueueClient requests={serialized} />
    </div>
  );
}
