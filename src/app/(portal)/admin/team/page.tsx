import { connection } from "next/server";
import { db } from "@sezsec/db";
import { requireServerSession } from "@sezsec/rbac/rbac.server";
import { PageHeader } from "@sezsec/ui";
import { TeamTreeClient } from "./team-tree-client";

export default async function TeamHierarchyPage() {
  await connection();
  const session = await requireServerSession();

  const floors = await db.floorConfig.findMany({
    orderBy: { name: "asc" },
    include: {
      heads: {
        select: { id: true, name: true, username: true, its: true, mobile: true },
        orderBy: { name: "asc" },
      },
      subHeads: {
        select: { id: true, name: true, username: true, its: true, mobile: true },
        orderBy: { name: "asc" },
      },
      members: {
        select: { id: true, name: true, username: true, its: true, mobile: true },
        orderBy: { name: "asc" },
      },
    },
  });

  return (
    <div className="w-full space-y-6">
      <PageHeader
        eyebrow="Floor Organization"
        title="Committee Floor Hierarchy & Teams"
        subtitle="Floor Heads, Sub-Heads, and assigned committee members across Secunderabad Jamaat venues."
      />
      <TeamTreeClient floors={floors} currentUserId={session.id} />
    </div>
  );
}
