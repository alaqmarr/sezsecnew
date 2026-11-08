import { connection } from "next/server";
import Link from "next/link";
import { Network } from "lucide-react";
import { db } from "@sezsec/db";
import { requireServerPathAccess } from "@sezsec/rbac/rbac.server";
import { Button, PageHeader } from "@sezsec/ui";
import { FloorsAdminClient } from "./floors-admin-client";

export default async function FloorsAdminPage() {
  await connection();
  await requireServerPathAccess("/admin/floors");

  const [floors, users] = await Promise.all([
    db.floorConfig.findMany({
      orderBy: { name: "asc" },
      include: {
        heads: {
          select: { id: true, name: true, username: true, its: true },
          orderBy: { name: "asc" },
        },
        subHeads: {
          select: { id: true, name: true, username: true, its: true },
          orderBy: { name: "asc" },
        },
        members: {
          select: { id: true, name: true, username: true, its: true },
          orderBy: { name: "asc" },
        },
      },
    }),
    db.user.findMany({
      orderBy: [{ name: "asc" }, { username: "asc" }],
      select: { id: true, name: true, username: true, its: true },
    }),
  ]);

  return (
    <div className="w-full space-y-6">
      <PageHeader
        eyebrow="Umoor Mawarid Bashariya"
        title="Floor Hierarchy & Leadership"
        subtitle="Configure Jamaat dining & khidmat floors and assign Floor Heads, Sub-Heads, and team members."
        actions={
          <Link href="/admin/team">
            <Button
              variant="secondary"
              size="sm"
              icon={<Network className="h-4 w-4" />}
            >
              View Hierarchy Tree
            </Button>
          </Link>
        }
      />

      <FloorsAdminClient floors={floors} allUsers={users} />
    </div>
  );
}
