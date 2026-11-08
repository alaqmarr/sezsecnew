import { connection } from "next/server";
import Link from "next/link";
import { Users } from "lucide-react";
import { db } from "@sezsec/db";
import { requireServerPathAccess } from "@sezsec/rbac/rbac.server";
import { Button, PageHeader } from "@sezsec/ui";
import { EditUserClient } from "./edit-user-client";

export default async function EditUserAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  await connection();
  const actor = await requireServerPathAccess("/admin/edit-user");
  const { id } = await searchParams;

  const users = await db.user.findMany({
    orderBy: [{ name: "asc" }, { username: "asc" }],
    include: {
      feeConfig: { select: { amount: true } },
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
    dob: u.dob ? u.dob.toISOString().slice(0, 10) : "",
    occupation: u.occupation || "",
    quranHifz: u.quranHifz || "",
    sports: u.sports || "",
  }));

  return (
    <div className="w-full space-y-6">
      <PageHeader
        eyebrow="Account Editor"
        title="Edit Member Profile & Credentials"
        subtitle="Modify login credentials, ITS numbers, monthly contribution rates, or reset member passwords."
        actions={
          <Link href="/admin/users">
            <Button
              variant="secondary"
              size="sm"
              icon={<Users className="h-4 w-4" />}
            >
              Full Directory
            </Button>
          </Link>
        }
      />

      <EditUserClient
        users={serialized}
        initialSelectedId={id || serialized[0]?.id || ""}
        isSuperAdmin={actor.role === "ADMIN"}
      />
    </div>
  );
}
